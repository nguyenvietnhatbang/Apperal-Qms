import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import pg from "pg";

const { Pool } = pg;

const args = new Set(process.argv.slice(2));
const getArgValue = (name, fallback) => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const apply = args.has("--apply");
const csvPath = getArgValue("--file", "docs/Bangluong.csv");
const factoryCode = getArgValue("--factory-code", "default");
const factoryIdArg = getArgValue("--factory-id", "");
const effectiveFromArg = getArgValue("--effective-from", "");

function loadEnvLocal() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u2007/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toMoney(value) {
  const cleaned = cleanText(value)
    .replace(/[,\s]/g, "")
    .replace(/[₫đĐ]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "–") return 0;
  const numberValue = Number(cleaned);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function parseSheetDate(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  const parts = cleaned.split(/[/-]/).map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;

  const [month, day, year] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferEffectiveFrom(rows) {
  if (effectiveFromArg) return effectiveFromArg;

  for (const row of rows.slice(0, 8)) {
    const text = row.map(cleanText).join(" ");
    const match = text.match(/THÁNG\s+(\d{1,2})\/(\d{4})/i);
    if (match) {
      return `${match[2]}-${String(Number(match[1])).padStart(2, "0")}-01`;
    }
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function parseEmployeeRows(rows) {
  return rows
    .slice(8)
    .map((row, index) => {
      const employeeCode = cleanText(row[1]);
      const fullName = cleanText(row[2]);
      if (!employeeCode || !fullName) return null;
      if (!/^\d/.test(cleanText(row[0]))) return null;

      const isMale = toMoney(row[3]) > 0;
      const childAllowance = toMoney(row[40]);
      return {
        sourceRow: index + 9,
        employeeCode,
        fullName,
        gender: isMale ? "Nam" : "Nữ",
        departmentName: null,
        positionTitle: cleanText(row[5]) || null,
        joinedDate: parseSheetDate(row[6]),
        dependentCount: Math.max(0, Math.trunc(toMoney(row[48]))),
        hasChildUnder6: childAllowance > 0,
        salary: {
          totalSalary: toMoney(row[7]),
          insuranceSalary: toMoney(row[8]),
          baseSalary: toMoney(row[9]),
          positionAllowance: toMoney(row[10]),
          responsibilityAllowance: toMoney(row[11]),
          seniorityAllowance: toMoney(row[12]),
          safetyAllowance: toMoney(row[13]),
          phoneAllowance: toMoney(row[14]),
          travelAllowance: toMoney(row[18]),
          housingAllowance: toMoney(row[19]),
          attendanceBonus: toMoney(row[20]),
          otherBonus: toMoney(row[15]),
          mealAllowance: 0,
        },
      };
    })
    .filter(Boolean);
}

function validateRows(rows) {
  const errors = [];
  const seenCodes = new Set();
  for (const row of rows) {
    if (seenCodes.has(row.employeeCode)) {
      errors.push(`Dòng ${row.sourceRow}: trùng mã nhân viên ${row.employeeCode}.`);
    }
    seenCodes.add(row.employeeCode);

    if (!row.joinedDate) {
      errors.push(`Dòng ${row.sourceRow}: ngày gia nhập không hợp lệ.`);
    }
    if (row.salary.insuranceSalary < 0 || row.salary.baseSalary < 0 || row.salary.totalSalary < 0) {
      errors.push(`Dòng ${row.sourceRow}: giá trị lương không hợp lệ.`);
    }
  }
  return errors;
}

async function resolveFactory(client) {
  if (factoryIdArg) {
    const result = await client.query(
      `SELECT id, code, name FROM factories WHERE id = $1 AND deleted_at IS NULL`,
      [factoryIdArg]
    );
    return result.rows[0] || null;
  }

  const result = await client.query(
    `SELECT id, code, name FROM factories WHERE code = $1 AND deleted_at IS NULL`,
    [factoryCode]
  );
  return result.rows[0] || null;
}

async function upsertRows(client, factoryId, rows, effectiveFrom) {
  let insertedEmployees = 0;
  let updatedEmployees = 0;
  let insertedSalaryConfigs = 0;
  let updatedSalaryConfigs = 0;

  for (const row of rows) {
    const employeeResult = await client.query(
      `INSERT INTO employees (
         factory_id, employee_code, full_name, gender, department_name, position_title,
         joined_date, status, dependent_count, has_child_under_6
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9)
       ON CONFLICT (factory_id, employee_code) WHERE deleted_at IS NULL DO UPDATE
       SET full_name = EXCLUDED.full_name,
           gender = EXCLUDED.gender,
           department_name = EXCLUDED.department_name,
           position_title = EXCLUDED.position_title,
           joined_date = EXCLUDED.joined_date,
           status = 'active',
           dependent_count = EXCLUDED.dependent_count,
           has_child_under_6 = EXCLUDED.has_child_under_6,
           updated_at = now()
       RETURNING id, (xmax = 0) as inserted`,
      [
        factoryId,
        row.employeeCode,
        row.fullName,
        row.gender,
        row.departmentName,
        row.positionTitle,
        row.joinedDate,
        row.dependentCount,
        row.hasChildUnder6,
      ]
    );

    const employee = employeeResult.rows[0];
    if (employee.inserted) insertedEmployees += 1;
    else updatedEmployees += 1;

    const existingConfig = await client.query(
      `SELECT id FROM employee_salary_configs WHERE employee_id = $1 AND effective_from = $2::date LIMIT 1`,
      [employee.id, effectiveFrom]
    );

    const values = [
      row.salary.totalSalary,
      row.salary.insuranceSalary,
      row.salary.baseSalary,
      row.salary.positionAllowance,
      row.salary.responsibilityAllowance,
      row.salary.seniorityAllowance,
      row.salary.safetyAllowance,
      row.salary.phoneAllowance,
      row.salary.travelAllowance,
      row.salary.housingAllowance,
      row.salary.attendanceBonus,
      row.salary.otherBonus,
      row.salary.mealAllowance,
      `Import từ ${csvPath} dòng ${row.sourceRow}`,
    ];

    if (existingConfig.rowCount > 0) {
      await client.query(
        `UPDATE employee_salary_configs
         SET total_salary = $2,
             insurance_salary = $3,
             base_salary = $4,
             position_allowance = $5,
             responsibility_allowance = $6,
             seniority_allowance = $7,
             safety_allowance = $8,
             phone_allowance = $9,
             travel_allowance = $10,
             housing_allowance = $11,
             attendance_bonus = $12,
             other_bonus = $13,
             meal_allowance = $14,
             note = $15,
             updated_at = now()
         WHERE id = $1`,
        [existingConfig.rows[0].id, ...values]
      );
      updatedSalaryConfigs += 1;
    } else {
      await client.query(
        `INSERT INTO employee_salary_configs (
           employee_id, effective_from, effective_to, total_salary, insurance_salary, base_salary,
           position_allowance, responsibility_allowance, seniority_allowance, safety_allowance,
           phone_allowance, travel_allowance, housing_allowance, attendance_bonus, other_bonus, meal_allowance, note
         )
         VALUES ($1, $2::date, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [employee.id, effectiveFrom, ...values]
      );
      insertedSalaryConfigs += 1;
    }
  }

  return {
    insertedEmployees,
    updatedEmployees,
    insertedSalaryConfigs,
    updatedSalaryConfigs,
  };
}

async function main() {
  loadEnvLocal();
  const connectionString = process.env.DATABASEURL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Thiếu DATABASEURL hoặc DATABASE_URL.");

  const absoluteCsvPath = path.resolve(csvPath);
  if (!fs.existsSync(absoluteCsvPath)) throw new Error(`Không tìm thấy file ${csvPath}.`);

  const rows = parse(fs.readFileSync(absoluteCsvPath), {
    bom: true,
    relaxColumnCount: true,
    skipEmptyLines: false,
  });
  const effectiveFrom = inferEffectiveFrom(rows);
  const employees = parseEmployeeRows(rows);
  const errors = validateRows(employees);

  console.log(`File: ${csvPath}`);
  console.log(`Ngày hiệu lực cấu hình lương: ${effectiveFrom}`);
  console.log(`Số nhân viên đọc được: ${employees.length}`);

  if (errors.length > 0) {
    console.log("\nLỗi dữ liệu:");
    errors.slice(0, 20).forEach((error) => console.log(`- ${error}`));
    if (errors.length > 20) console.log(`... và ${errors.length - 20} lỗi khác`);
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") || connectionString.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : false,
  });

  const client = await pool.connect();
  try {
    const factory = await resolveFactory(client);
    if (!factory) throw new Error(`Không tìm thấy xưởng ${factoryIdArg || factoryCode}.`);
    console.log(`Xưởng: ${factory.name} (${factory.code})`);

    if (!apply) {
      console.log("\nDry-run: chưa ghi DB. Thêm --apply để import thật.");
      console.table(employees.slice(0, 5).map((employee) => ({
        ma: employee.employeeCode,
        ten: employee.fullName,
        gioiTinh: employee.gender,
        chucDanh: employee.positionTitle,
        tongLuong: employee.salary.totalSalary,
      })));
      return;
    }

    await client.query("BEGIN");
    const summary = await upsertRows(client, factory.id, employees, effectiveFrom);
    await client.query("COMMIT");

    console.log("\nImport hoàn tất:");
    console.table(summary);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Import thất bại:", error.message);
  process.exit(1);
});
