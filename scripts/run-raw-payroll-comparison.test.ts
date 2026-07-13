import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { parse } from "csv-parse/sync";
import { query, transaction } from "@/lib/db";
import { PayrollCalculationService } from "@/features/payroll/services/payroll-calculation-service";

const SOURCE_CYCLE_CODE = "2026-06";
const RAW_CHECK_CYCLE_CODE = "2026-06-raw-check";
const SAMPLE_EMPLOYEE_CODE = "16NAT";
const shouldRunRawComparison = process.env.RUN_RAW_PAYROLL_COMPARISON === "1";

function loadLocalEnvironment() {
  const environmentPath = path.resolve(".env.local");
  if (!fs.existsSync(environmentPath)) return;

  for (const line of fs.readFileSync(environmentPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadLocalEnvironment();

interface SourcePayrollRow {
  employeeCode: string;
  employeeName: string;
  actualWorkdays: number;
  overtimeNormalHours: number;
  overtimeSundayHours: number;
  overtimeHolidayHours: number;
  grossIncome: number;
  netSalary: number;
}

function toNumber(value: unknown) {
  const normalized = String(value ?? "")
    .replace(/[\s,]/g, "")
    .replace(/[^0-9.-]/g, "");
  return Number(normalized) || 0;
}

function readSourcePayrollRows() {
  const filePath = path.resolve("docs/Bangluong.csv");
  const rows = parse(fs.readFileSync(filePath), {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];

  return new Map<string, SourcePayrollRow>(
    rows
      .filter((row) => /^\d+$/.test(String(row[0] || "").trim()))
      .map((row) => {
        const result: SourcePayrollRow = {
          employeeCode: String(row[1] || "").trim(),
          employeeName: String(row[2] || "").trim(),
          actualWorkdays: toNumber(row[29]),
          overtimeNormalHours: toNumber(row[30]),
          overtimeSundayHours: toNumber(row[31]),
          overtimeHolidayHours: toNumber(row[32]),
          grossIncome: toNumber(row[45]),
          netSalary: toNumber(row[51]),
        };
        return [result.employeeCode, result] as const;
      })
  );
}

async function prepareRawOnlyCycle() {
  return transaction(async (client) => {
    const sourceCycleResult = await client.query(
      `SELECT id, factory_id, period_start, period_end, standard_workdays, standard_hours_per_day
       FROM payroll_cycles
       WHERE code = $1
       LIMIT 1`,
      [SOURCE_CYCLE_CODE]
    );
    const sourceCycle = sourceCycleResult.rows[0];
    if (!sourceCycle) throw new Error(`Không tìm thấy chu kỳ nguồn ${SOURCE_CYCLE_CODE}.`);

    await client.query(
      `DELETE FROM payroll_cycles
       WHERE factory_id = $1 AND code = $2`,
      [sourceCycle.factory_id, RAW_CHECK_CYCLE_CODE]
    );

    const rawCycleResult = await client.query(
      `INSERT INTO payroll_cycles (
         factory_id, code, name, period_start, period_end, standard_workdays, standard_hours_per_day, note
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        sourceCycle.factory_id,
        RAW_CHECK_CYCLE_CODE,
        "Tháng 06/2026 - kiểm tra chấm công thô",
        sourceCycle.period_start,
        sourceCycle.period_end,
        sourceCycle.standard_workdays,
        sourceCycle.standard_hours_per_day,
        "Chỉ dùng chấm công thô; không có số override từ Bangluong.csv.",
      ]
    );
    const rawCycleId = rawCycleResult.rows[0].id as string;

    const rawImportResult = await client.query(
      `INSERT INTO attendance_imports (
         payroll_cycle_id, file_name, source_kind, status, total_rows, valid_rows, invalid_rows, error_summary, processed_at
       ) SELECT $1, file_name, source_kind, 'processed', total_rows, valid_rows, invalid_rows, error_summary, now()
       FROM attendance_imports
       WHERE payroll_cycle_id = $2
       ORDER BY imported_at DESC
       LIMIT 1
       RETURNING id`,
      [rawCycleId, sourceCycle.id]
    );
    const rawImportId = rawImportResult.rows[0]?.id as string | undefined;
    if (!rawImportId) throw new Error("Chu kỳ nguồn chưa có dữ liệu import chấm công.");

    await client.query(
      `INSERT INTO attendance_raw_rows (import_id, row_number, raw_data, validation_errors)
       SELECT $1, row_number, raw_data, validation_errors
       FROM attendance_raw_rows
       WHERE import_id = (
         SELECT id FROM attendance_imports WHERE payroll_cycle_id = $2 ORDER BY imported_at DESC LIMIT 1
       )`,
      [rawImportId, sourceCycle.id]
    );

    const attendanceResult = await client.query(
      `INSERT INTO attendance_records (
         payroll_cycle_id, import_id, employee_id, employee_code, employee_name, work_date, weekday_name,
         department_name, position_title, shift_name, check_in_1, check_out_1, check_in_2, check_out_2,
         check_in_3, check_out_3, workday_count, work_hours, extra_workday_count, extra_hours, late_minutes,
         early_leave_minutes, overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours,
         symbol, extra_symbol, total_hours, note
       )
       SELECT $1, $2, employee_id, employee_code, employee_name, work_date, weekday_name,
              department_name, position_title, shift_name, check_in_1, check_out_1, check_in_2, check_out_2,
              check_in_3, check_out_3, workday_count, work_hours, extra_workday_count, extra_hours, late_minutes,
              early_leave_minutes, overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours,
              symbol, extra_symbol, total_hours, 'Bản sao kiểm tra từ chấm công thô.'
       FROM attendance_records
       WHERE payroll_cycle_id = $3`,
      [rawCycleId, rawImportId, sourceCycle.id]
    );

    return {
      rawCycleId,
      factoryId: sourceCycle.factory_id as string,
      attendanceRows: attendanceResult.rowCount || 0,
    };
  });
}

function compareValues(
  computed: Record<string, unknown>,
  source: SourcePayrollRow
) {
  const fields = [
    ["actualWorkdays", "actual_workdays"],
    ["overtimeNormalHours", "overtime_normal_hours"],
    ["overtimeSundayHours", "overtime_sunday_hours"],
    ["overtimeHolidayHours", "overtime_holiday_hours"],
    ["grossIncome", "gross_income"],
    ["netSalary", "net_salary"],
  ] as const;

  return fields.filter(([sourceField, computedField]) =>
    toNumber(source[sourceField]) !== toNumber(computed[computedField])
  ).map(([sourceField]) => sourceField);
}

const rawComparisonTest = shouldRunRawComparison ? test : test.skip;

describe("raw attendance payroll comparison", () => {
  afterAll(async () => {
    const pool = await import("@/lib/db").then((module) => module.getDbPool());
    await pool.end();
  });

  rawComparisonTest("imports the raw attendance copy, calculates 57 employees, and compares it with the source payroll", async () => {
    const sourcePayrollByCode = readSourcePayrollRows();
    const { rawCycleId, factoryId, attendanceRows } = await prepareRawOnlyCycle();

    await PayrollCalculationService.calculateCyclePayroll(rawCycleId, null as unknown as string, factoryId);
    const rawPayrollItems = await query<Record<string, unknown>>(
      `SELECT employee_code, employee_name, actual_workdays, overtime_normal_hours, overtime_sunday_hours,
              overtime_holiday_hours, gross_income, net_salary
       FROM payroll_items
       WHERE payroll_cycle_id = $1
       ORDER BY employee_code`,
      [rawCycleId]
    );
    const rawExact = rawPayrollItems.filter((item) => {
      const source = sourcePayrollByCode.get(String(item.employee_code));
      return source && compareValues(item, source).length === 0;
    });
    const sampleSource = sourcePayrollByCode.get(SAMPLE_EMPLOYEE_CODE);
    const sampleRaw = rawPayrollItems.find((item) => item.employee_code === SAMPLE_EMPLOYEE_CODE);

    console.log("\nRaw-only payroll comparison");
    console.table({
      rawAttendanceRows: attendanceRows,
      rawPayrollEmployees: rawPayrollItems.length,
      rawExactMatches: rawExact.length,
    });
    console.log("\nMẫu so sánh: NGUYỄN ANH TÚ (16NAT)");
    console.table({
      bangLuong: sampleSource,
      rawOnly: sampleRaw,
    });

    expect(attendanceRows).toBe(1710);
    expect(rawPayrollItems).toHaveLength(57);
  }, 60_000);
});
