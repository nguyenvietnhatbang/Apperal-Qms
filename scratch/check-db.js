const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function check() {
  const envContent = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
  const databaseUrlLine = envContent.split("\n").find(l => l.startsWith("DATABASEURL="));
  const databaseUrl = databaseUrlLine.split("=")[1].trim().replace(/"/g, "").replace(/'/g, "");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== EMPLOYEES ===");
  const emps = await client.query("SELECT id, employee_code, full_name, status FROM employees LIMIT 5");
  console.log(JSON.stringify(emps.rows, null, 2));

  console.log("=== IMPORTS ===");
  const imps = await client.query("SELECT id, file_name, status, total_rows, valid_rows, invalid_rows, error_summary FROM attendance_imports LIMIT 5");
  console.log(JSON.stringify(imps.rows, null, 2));

  console.log("=== RAW ROWS ===");
  const raws = await client.query("SELECT id, import_id, row_number, raw_data, validation_errors FROM attendance_raw_rows LIMIT 5");
  console.log(JSON.stringify(raws.rows, null, 2));

  console.log("=== CLEANED RECORDS ===");
  const records = await client.query("SELECT id, employee_code, employee_name, work_date, workday_count, work_hours FROM attendance_records LIMIT 5");
  console.log(JSON.stringify(records.rows, null, 2));

  await client.end();
}

check().catch(console.error);
