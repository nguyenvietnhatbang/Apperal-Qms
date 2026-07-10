import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import pg from "pg";

const { Pool } = pg;
const args = new Set(process.argv.slice(2));
const getArg = (name, fallback) => process.argv.slice(2).find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) || fallback;
const apply = args.has("--apply");
const csvPath = getArg("--file", "docs/Bangluong.csv");
const factoryCode = getArg("--factory-code", "default");
const cycleCode = getArg("--cycle-code", "2026-06");

function loadEnvLocal() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function cleanText(value) {
  return String(value || "").replace(/\u2007/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function numberValue(value) {
  const text = cleanText(value).replace(/[\s,]/g, "").replace(/[₫đĐ]/g, "");
  if (!text || text === "-" || text === "–") return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRows(rows) {
  return rows.slice(8)
    .filter((row) => /^\d+$/.test(cleanText(row[0])) && cleanText(row[2]))
    .map((row, index) => ({
      sourceRow: index + 9,
      fullName: cleanText(row[2]),
      annualLeaveTotal: numberValue(row[21]),
      paidLeaveDaysOverride: numberValue(row[22]),
      paidLeaveHours: numberValue(row[23]),
      annualLeaveUsedCumulative: numberValue(row[24]),
      annualLeaveRemaining: numberValue(row[25]),
      personalLeaveDays: numberValue(row[26]),
      personalLeaveAmount: numberValue(row[27]),
      holidayDaysOverride: numberValue(row[28]),
      actualWorkdaysOverride: numberValue(row[29]),
      overtimeNormalHoursOverride: numberValue(row[30]),
      overtimeSundayHoursOverride: numberValue(row[31]),
      overtimeHolidayHoursOverride: numberValue(row[32]),
      // These are already included in total_salary from the source payroll sheet.
      complianceBonus: 0,
      businessTripAllowance: 0,
      workTripSupport: numberValue(row[38]),
      menstrualAllowanceAmountOverride: numberValue(row[39]),
      childAllowanceAmountOverride: numberValue(row[40]),
      nightShiftHours: numberValue(row[59]),
      nightShiftAmount: numberValue(row[63]),
      excessOvertimeNormalHours: numberValue(row[56]),
      excessOvertimeSundayHours: numberValue(row[57]),
      excessOvertimeHolidayHours: numberValue(row[58]),
      excessOvertimeNormalAmount: numberValue(row[60]),
      excessOvertimeSundayAmount: numberValue(row[61]),
      excessOvertimeHolidayAmount: numberValue(row[62]),
      employeeInsuranceAmountOverride: numberValue(row[46]),
      unionFeeAmountOverride: numberValue(row[47]),
      personalIncomeTaxAmountOverride: numberValue(row[50]),
      advancePayment1: numberValue(row[52]),
      advancePayment2: numberValue(row[53]),
      pendingLeaveAdvance: numberValue(row[65]),
    }));
}

async function main() {
  loadEnvLocal();
  const connectionString = process.env.DATABASEURL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Thiếu DATABASEURL hoặc DATABASE_URL.");
  if (!fs.existsSync(path.resolve(csvPath))) throw new Error(`Không tìm thấy file ${csvPath}.`);

  const sourceRows = parseRows(parse(fs.readFileSync(path.resolve(csvPath)), { bom: true, relaxColumnCount: true, skipEmptyLines: false }));
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const factoryResult = await client.query("SELECT id, name FROM factories WHERE code = $1 AND deleted_at IS NULL", [factoryCode]);
    if (factoryResult.rowCount === 0) throw new Error(`Không tìm thấy xưởng ${factoryCode}.`);
    const factory = factoryResult.rows[0];
    const cycleResult = await client.query(
      "SELECT id, status FROM payroll_cycles WHERE factory_id = $1 AND code = $2",
      [factory.id, cycleCode]
    );
    if (cycleResult.rowCount === 0) throw new Error(`Không tìm thấy chu kỳ ${cycleCode} của xưởng này.`);
    const cycle = cycleResult.rows[0];
    if (["locked", "paid"].includes(cycle.status)) throw new Error("Không thể cập nhật chu kỳ đã khóa hoặc đã chi trả.");

    const employeesResult = await client.query(
      `SELECT DISTINCT e.id, e.full_name
       FROM employees e
       JOIN attendance_records ar ON ar.employee_id = e.id AND ar.payroll_cycle_id = $2
       WHERE e.factory_id = $1 AND e.deleted_at IS NULL`,
      [factory.id, cycle.id]
    );
    const employeeByName = new Map(employeesResult.rows.map((employee) => [normalizeName(employee.full_name), employee]));
    const matchedRows = [];
    const skippedRows = [];
    for (const row of sourceRows) {
      const employee = employeeByName.get(normalizeName(row.fullName));
      if (employee) matchedRows.push({ ...row, employeeId: employee.id });
      else skippedRows.push(row.fullName);
    }

    console.log(`Xưởng: ${factory.name}; chu kỳ: ${cycleCode}.`);
    console.log(`Bảng lương: ${sourceRows.length} nhân viên; import theo người có chấm công: ${matchedRows.length}; bỏ qua: ${skippedRows.length}.`);
    if (skippedRows.length) console.log(`Bỏ qua: ${skippedRows.join(", ")}`);
    if (!apply) {
      console.log("Dry-run hoàn tất. Chưa ghi dữ liệu. Chạy lại với --apply để import thật.");
      return;
    }

    await client.query("BEGIN");
    for (const row of matchedRows) {
      await client.query(
        `INSERT INTO payroll_adjustments (
           payroll_cycle_id, employee_id, annual_leave_total, paid_leave_hours,
           annual_leave_used_cumulative, annual_leave_remaining, personal_leave_days, personal_leave_amount,
           business_trip_allowance, compliance_bonus, work_trip_support, night_shift_hours, night_shift_amount,
           excess_overtime_normal_hours, excess_overtime_sunday_hours, excess_overtime_holiday_hours,
           excess_overtime_normal_amount, excess_overtime_sunday_amount, excess_overtime_holiday_amount,
           advance_payment_1, advance_payment_2, pending_leave_advance,
           actual_workdays_override, paid_leave_days_override, holiday_days_override,
           overtime_normal_hours_override, overtime_sunday_hours_override, overtime_holiday_hours_override,
           employee_insurance_amount_override, union_fee_amount_override, personal_income_tax_amount_override,
           menstrual_allowance_amount_override, child_allowance_amount_override, note
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
           $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34
         ) ON CONFLICT (payroll_cycle_id, employee_id) DO UPDATE SET
           annual_leave_total = EXCLUDED.annual_leave_total, paid_leave_hours = EXCLUDED.paid_leave_hours,
           annual_leave_used_cumulative = EXCLUDED.annual_leave_used_cumulative, annual_leave_remaining = EXCLUDED.annual_leave_remaining,
           personal_leave_days = EXCLUDED.personal_leave_days, personal_leave_amount = EXCLUDED.personal_leave_amount,
           business_trip_allowance = EXCLUDED.business_trip_allowance, compliance_bonus = EXCLUDED.compliance_bonus,
           work_trip_support = EXCLUDED.work_trip_support, night_shift_hours = EXCLUDED.night_shift_hours, night_shift_amount = EXCLUDED.night_shift_amount,
           excess_overtime_normal_hours = EXCLUDED.excess_overtime_normal_hours, excess_overtime_sunday_hours = EXCLUDED.excess_overtime_sunday_hours,
           excess_overtime_holiday_hours = EXCLUDED.excess_overtime_holiday_hours, excess_overtime_normal_amount = EXCLUDED.excess_overtime_normal_amount,
           excess_overtime_sunday_amount = EXCLUDED.excess_overtime_sunday_amount, excess_overtime_holiday_amount = EXCLUDED.excess_overtime_holiday_amount,
           advance_payment_1 = EXCLUDED.advance_payment_1, advance_payment_2 = EXCLUDED.advance_payment_2,
           pending_leave_advance = EXCLUDED.pending_leave_advance, actual_workdays_override = EXCLUDED.actual_workdays_override,
           paid_leave_days_override = EXCLUDED.paid_leave_days_override, holiday_days_override = EXCLUDED.holiday_days_override,
           overtime_normal_hours_override = EXCLUDED.overtime_normal_hours_override, overtime_sunday_hours_override = EXCLUDED.overtime_sunday_hours_override,
           overtime_holiday_hours_override = EXCLUDED.overtime_holiday_hours_override, employee_insurance_amount_override = EXCLUDED.employee_insurance_amount_override,
           union_fee_amount_override = EXCLUDED.union_fee_amount_override, personal_income_tax_amount_override = EXCLUDED.personal_income_tax_amount_override,
           menstrual_allowance_amount_override = EXCLUDED.menstrual_allowance_amount_override,
           child_allowance_amount_override = EXCLUDED.child_allowance_amount_override,
           note = EXCLUDED.note, updated_at = now()`,
        [
          cycle.id, row.employeeId, row.annualLeaveTotal, row.paidLeaveHours, row.annualLeaveUsedCumulative, row.annualLeaveRemaining,
          row.personalLeaveDays, row.personalLeaveAmount, row.businessTripAllowance, row.complianceBonus, row.workTripSupport,
          row.nightShiftHours, row.nightShiftAmount, row.excessOvertimeNormalHours, row.excessOvertimeSundayHours,
          row.excessOvertimeHolidayHours, row.excessOvertimeNormalAmount, row.excessOvertimeSundayAmount, row.excessOvertimeHolidayAmount,
          row.advancePayment1, row.advancePayment2, row.pendingLeaveAdvance, row.actualWorkdaysOverride, row.paidLeaveDaysOverride,
          row.holidayDaysOverride, row.overtimeNormalHoursOverride, row.overtimeSundayHoursOverride, row.overtimeHolidayHoursOverride,
          row.employeeInsuranceAmountOverride, row.unionFeeAmountOverride, row.personalIncomeTaxAmountOverride,
          row.menstrualAllowanceAmountOverride, row.childAllowanceAmountOverride,
          `Import chốt số liệu từ ${path.basename(csvPath)} dòng ${row.sourceRow}.`,
        ]
      );
    }

    await client.query("DELETE FROM payroll_items WHERE payroll_cycle_id = $1", [cycle.id]);
    await client.query("UPDATE payroll_cycles SET status = 'cleaned', calculated_at = NULL, updated_at = now() WHERE id = $1", [cycle.id]);
    await client.query(
      `INSERT INTO payroll_audit_logs (payroll_cycle_id, action, previous_status, next_status, payload)
       VALUES ($1, 'import_cycle_payroll_adjustments', $2, 'cleaned', $3::jsonb)`,
      [cycle.id, cycle.status, JSON.stringify({ sourceFile: path.basename(csvPath), importedEmployees: matchedRows.length, skippedEmployees: skippedRows.length })]
    );
    await client.query("COMMIT");
    console.log("Đã import số liệu chốt và xóa snapshot lương cũ. Chu kỳ ở trạng thái cleaned, sẵn sàng tính lại.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Import thất bại: ${error.message}`);
  process.exit(1);
});
