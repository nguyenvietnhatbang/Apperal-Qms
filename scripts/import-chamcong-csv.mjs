import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import pg from "pg";

const { Pool } = pg;
const args = new Set(process.argv.slice(2));
const getArgValue = (name, fallback) => {
  const prefix = `${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};

const apply = args.has("--apply");
const replaceExisting = args.has("--replace-existing");
const csvPath = getArgValue("--file", "docs/chamcong.csv");
const factoryCode = getArgValue("--factory-code", "default");
const factoryIdArg = getArgValue("--factory-id", "");

function loadEnvLocal() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function cleanText(value) {
  return String(value || "").replace(/\u2007/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return cleanText(value)
    .replace(/\([^)]*\)/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function parseDate(value) {
  const parts = cleanText(value).split("/").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;

  const [month, day, year] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTime(value) {
  const match = cleanText(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function elapsedHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [inHour, inMinute] = checkIn.slice(0, 5).split(":").map(Number);
  const [outHour, outMinute] = checkOut.slice(0, 5).split(":").map(Number);
  let minutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

function parseDecimal(value) {
  const text = cleanText(value).replace(",", ".");
  if (!text || text === "-") return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLeaveSymbol(annualLeave, sickLeave, unpaidLeave) {
  const annual = cleanText(annualLeave).toUpperCase();
  const sick = cleanText(sickLeave).toUpperCase();
  const unpaid = cleanText(unpaidLeave).toUpperCase();

  if (annual) return annual.includes("/2") ? "P/2" : "P";
  if (sick) return sick.includes("/2") ? "BH/2" : "BH";
  if (unpaid) return unpaid.includes("/2") ? "K/2" : "K";
  return null;
}

function leaveDayFraction(symbol) {
  return symbol?.endsWith("/2") ? 0.5 : symbol ? 1 : 0;
}

function inferCycle(records) {
  const dates = records.map((record) => record.workDate).sort();
  if (dates.length === 0) throw new Error("Không tìm thấy dòng chấm công hợp lệ trong file.");
  const start = dates[0];
  const end = dates.at(-1);
  const [year, month] = start.split("-");
  return {
    code: `${year}-${month}`,
    name: `Tháng ${month}/${year}`,
    periodStart: start,
    periodEnd: end,
  };
}

function parseRecords(rows) {
  const records = [];
  const errors = [];

  rows.forEach((row, rowIndex) => {
    if (!/^\d+$/.test(cleanText(row[0])) || !cleanText(row[2])) return;

    const sourceName = cleanText(row[1]);
    const workDate = parseDate(row[2]);
    if (!sourceName || !workDate) {
      errors.push(`Dòng ${rowIndex + 1}: thiếu tên hoặc ngày không hợp lệ.`);
      return;
    }

    const weekdayName = cleanText(row[3]) || null;
    const isSunday = weekdayName?.toUpperCase() === "CN";
    const checkIn1 = parseTime(row[4]);
    const checkOut1 = parseTime(row[5]);
    const hours = elapsedHours(checkIn1, checkOut1);
    const symbol = normalizeLeaveSymbol(row[9], row[10], row[11]);
    const normalOvertime = parseDecimal(row[7]);
    const sundayLabel = cleanText(row[8]).toUpperCase();
    const hasSundayWork = isSunday && (Boolean(checkIn1 && checkOut1) || sundayLabel.includes("CHỦ NHẬT"));

    records.push({
      sourceRow: rowIndex + 1,
      sourceData: row,
      sourceEmployeeCode: cleanText(row[0]),
      sourceName,
      normalizedName: normalizeName(sourceName),
      workDate,
      weekdayName,
      checkIn1,
      checkOut1,
      workHours: isSunday ? 0 : hours,
      workdayCount: isSunday ? 0 : (checkIn1 && checkOut1 ? 1 : (symbol ? leaveDayFraction(symbol) : 0)),
      overtimeNormalHours: isSunday ? 0 : normalOvertime,
      overtimeSundayHours: hasSundayWork ? hours : 0,
      symbol,
      totalHours: hours,
    });
  });

  return { records, errors };
}

function findEmployeeByName(record, employees) {
  const exact = employees.filter((employee) => employee.normalizedName === record.normalizedName);
  if (exact.length === 1) return exact[0];

  const sourceTokens = cleanText(record.sourceName)
    .replace(/\([^)]*\)/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

  const matches = employees.filter((employee) => {
    const targetTokens = employee.normalizedTokens;
    if (sourceTokens.length !== targetTokens.length) return false;
    return sourceTokens.every((token, index) => {
      const target = targetTokens[index];
      return token === target || (token.length <= 2 && target.startsWith(token)) || (target.length <= 2 && token.startsWith(target));
    });
  });

  return matches.length === 1 ? matches[0] : null;
}

async function resolveFactory(client) {
  const result = await client.query(
    factoryIdArg
      ? "SELECT id, code, name FROM factories WHERE id = $1 AND deleted_at IS NULL"
      : "SELECT id, code, name FROM factories WHERE code = $1 AND deleted_at IS NULL",
    [factoryIdArg || factoryCode]
  );
  return result.rows[0] || null;
}

async function persistImport(client, factory, cycle, records) {
  const existingCycle = await client.query(
    `SELECT id, status FROM payroll_cycles WHERE factory_id = $1 AND code = $2`,
    [factory.id, cycle.code]
  );
  let cycleId;
  let previousStatus = "draft";
  if (existingCycle.rowCount > 0) {
    if (!replaceExisting) {
      throw new Error(`Xưởng đã có chu kỳ ${cycle.code}. Dùng --replace-existing nếu muốn thay dữ liệu chấm công.`);
    }
    previousStatus = existingCycle.rows[0].status;
    if (["locked", "paid"].includes(previousStatus)) {
      throw new Error(`Không thể thay dữ liệu chấm công cho chu kỳ ${cycle.code} đã khóa hoặc đã chi trả.`);
    }
    cycleId = existingCycle.rows[0].id;
    await client.query(`DELETE FROM payroll_items WHERE payroll_cycle_id = $1`, [cycleId]);
    await client.query(`DELETE FROM audit_payroll_items WHERE payroll_cycle_id = $1`, [cycleId]);
    await client.query(`DELETE FROM audit_attendance_records WHERE payroll_cycle_id = $1`, [cycleId]);
    await client.query(`DELETE FROM attendance_records WHERE payroll_cycle_id = $1`, [cycleId]);
    await client.query(`DELETE FROM attendance_imports WHERE payroll_cycle_id = $1`, [cycleId]);
    await client.query(
      `UPDATE payroll_cycles
       SET period_start = $2::date, period_end = $3::date, standard_workdays = 26,
           standard_hours_per_day = 8, status = 'draft', calculated_at = NULL, updated_at = now()
       WHERE id = $1`,
      [cycleId, cycle.periodStart, cycle.periodEnd]
    );
  } else {
    const cycleResult = await client.query(
      `INSERT INTO payroll_cycles (
         factory_id, code, name, period_start, period_end, standard_workdays, standard_hours_per_day, note
       ) VALUES ($1, $2, $3, $4::date, $5::date, 26, 8, $6)
       RETURNING id`,
      [factory.id, cycle.code, cycle.name, cycle.periodStart, cycle.periodEnd, `Import từ ${csvPath}; Chủ nhật được tính tăng ca 200%.`]
    );
    cycleId = cycleResult.rows[0].id;
  }

  const importResult = await client.query(
    `INSERT INTO attendance_imports (
       payroll_cycle_id, file_name, source_kind, status, total_rows, valid_rows, invalid_rows, error_summary, processed_at
     ) VALUES ($1, $2, 'csv', 'processed', $3, $3, 0, '[]'::jsonb, now())
     RETURNING id`,
    [cycleId, path.basename(csvPath), records.length]
  );
  const importId = importResult.rows[0].id;

  await client.query(
    `INSERT INTO attendance_raw_rows (import_id, row_number, raw_data)
     SELECT $1, "sourceRow", "sourceData"
     FROM jsonb_to_recordset($2::jsonb) AS source_rows("sourceRow" integer, "sourceData" jsonb)`,
    [importId, JSON.stringify(records.map((record) => ({ sourceRow: record.sourceRow, sourceData: record.sourceData })))]
  );

  await client.query(
    `INSERT INTO attendance_records (
       payroll_cycle_id, import_id, employee_id, employee_code, employee_name, work_date, weekday_name,
       check_in_1, check_out_1, workday_count, work_hours, overtime_normal_hours, overtime_sunday_hours,
       total_hours, symbol, note
     )
     SELECT
       $1, $2, "employeeId", "employeeCode", "employeeName", "workDate", "weekdayName",
       "checkIn1", "checkOut1", "workdayCount", "workHours", "overtimeNormalHours", "overtimeSundayHours",
       "totalHours", symbol, 'Import từ chấm công thô theo tên nhân viên.'
     FROM jsonb_to_recordset($3::jsonb) AS attendance_data(
       "employeeId" uuid, "employeeCode" text, "employeeName" text, "workDate" date, "weekdayName" text,
       "checkIn1" time, "checkOut1" time, "workdayCount" numeric, "workHours" numeric,
       "overtimeNormalHours" numeric, "overtimeSundayHours" numeric, "totalHours" numeric, symbol text
     )`,
    [
      cycleId,
      importId,
      JSON.stringify(records.map((record) => ({
        employeeId: record.employee.id,
        employeeCode: record.employee.employeeCode,
        employeeName: record.employee.fullName,
        workDate: record.workDate,
        weekdayName: record.weekdayName,
        checkIn1: record.checkIn1,
        checkOut1: record.checkOut1,
        workdayCount: record.workdayCount,
        workHours: record.workHours,
        overtimeNormalHours: record.overtimeNormalHours,
        overtimeSundayHours: record.overtimeSundayHours,
        totalHours: record.totalHours,
        symbol: record.symbol,
      })))
    ]
  );

  await client.query(
    `INSERT INTO payroll_audit_logs (payroll_cycle_id, action, previous_status, next_status, payload)
     VALUES ($1, 'import_attendance_csv', $2, 'cleaned', $3::jsonb)`,
    [cycleId, previousStatus, JSON.stringify({
      fileName: path.basename(csvPath),
      importedRows: records.length,
      matchedBy: "employee_name_canonical_code",
      sourceCodesCorrected: records.filter((record) => record.sourceEmployeeCode !== record.employee.employeeCode).length,
    })]
  );
  await client.query(`UPDATE payroll_cycles SET status = 'cleaned', updated_at = now() WHERE id = $1`, [cycleId]);

  return { cycleId, importId };
}

async function main() {
  loadEnvLocal();
  const connectionString = process.env.DATABASEURL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Thiếu DATABASEURL hoặc DATABASE_URL.");
  if (!fs.existsSync(path.resolve(csvPath))) throw new Error(`Không tìm thấy file ${csvPath}.`);

  const rows = parse(fs.readFileSync(path.resolve(csvPath)), { bom: true, relaxColumnCount: true, skipEmptyLines: false });
  const { records, errors } = parseRecords(rows);
  const cycle = inferCycle(records);
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    try {
      const factory = await resolveFactory(client);
      if (!factory) throw new Error("Không tìm thấy xưởng cần import.");

      const employeeResult = await client.query(
        `SELECT id, employee_code, full_name
         FROM employees
         WHERE factory_id = $1 AND deleted_at IS NULL AND status = 'active'`,
        [factory.id]
      );
      const employees = employeeResult.rows.map((employee) => ({
        id: employee.id,
        employeeCode: employee.employee_code,
        fullName: employee.full_name,
        normalizedName: normalizeName(employee.full_name),
        normalizedTokens: cleanText(employee.full_name)
          .replace(/\([^)]*\)/g, "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/gi, "d")
          .toUpperCase()
          .split(/[^A-Z0-9]+/)
          .filter(Boolean),
      }));

      const unresolvedNames = new Set();
      for (const record of records) {
        record.employee = findEmployeeByName(record, employees);
        if (!record.employee) unresolvedNames.add(record.sourceName);
      }
      if (errors.length > 0 || unresolvedNames.size > 0) {
        throw new Error([
          ...errors,
          ...Array.from(unresolvedNames, (name) => `Không xác định được nhân viên theo tên: ${name}.`),
        ].join("\n"));
      }

      const sundayHours = records.reduce((total, record) => total + record.overtimeSundayHours, 0);
      const normalOvertimeHours = records.reduce((total, record) => total + record.overtimeNormalHours, 0);
      const mappedEmployeeCount = new Set(records.map((record) => record.employee.id)).size;
      console.log(`Xưởng: ${factory.name} (${factory.code})`);
      console.log(`Chu kỳ: ${cycle.name}, ${cycle.periodStart} đến ${cycle.periodEnd}, 26 công chuẩn.`);
      console.log(`Dòng chấm công: ${records.length}; nhân viên khớp theo tên: ${mappedEmployeeCount}; tăng ca thường: ${normalOvertimeHours.toFixed(2)}h; tăng ca Chủ nhật: ${sundayHours.toFixed(2)}h.`);

      if (!apply) {
        console.log("Dry-run hoàn tất. Chưa ghi dữ liệu. Chạy lại với --apply để import.");
        return;
      }

      await client.query("BEGIN");
      const result = await persistImport(client, factory, cycle, records);
      await client.query("COMMIT");
      console.log(`Đã import thành công. Cycle ID: ${result.cycleId}; Import ID: ${result.importId}.`);
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* No transaction was opened. */ }
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
