import crypto from "node:crypto";
import pg from "pg";

const connectionString = process.env.DATABASEURL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASEURL hoặc DATABASE_URL là bắt buộc.");

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require") || connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : false,
});

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, Buffer.from(salt, "hex"), 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:16384:8:1:${salt}:${hash.toString("hex")}`;
};

const employees = await pool.query(
  `SELECT e.id, e.factory_id, e.employee_code, e.full_name
   FROM employees e
   LEFT JOIN app_users u ON u.employee_id = e.id AND u.deleted_at IS NULL
   WHERE e.deleted_at IS NULL AND u.id IS NULL
   ORDER BY e.factory_id, e.employee_code`
);

let created = 0;
let skipped = 0;
for (const employee of employees.rows) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const duplicate = await client.query("SELECT id FROM app_users WHERE username = $1 AND deleted_at IS NULL", [employee.employee_code]);
    if (duplicate.rowCount > 0) {
      skipped += 1;
      await client.query("ROLLBACK");
      continue;
    }
    const department = await client.query(
      `INSERT INTO departments (factory_id, code, name, description, is_admin, is_active)
       VALUES ($1, 'personal', 'Nhân viên', 'Quyền self-service cho nhân viên.', false, true)
       ON CONFLICT (factory_id, code) DO UPDATE SET is_active = true, updated_at = now()
       RETURNING id`,
      [employee.factory_id]
    );
    const departmentId = department.rows[0].id;
    await client.query(
      `INSERT INTO department_module_permissions (department_id, module_id, can_view, can_create, can_update, can_delete, can_approve)
       SELECT $1, id, true, false, false, false, false FROM modules WHERE code = 'personal' AND is_active = true
       ON CONFLICT (department_id, module_id) DO UPDATE SET can_view = true, updated_at = now()`,
      [departmentId]
    );
    const account = await client.query(
      `INSERT INTO app_users (factory_id, employee_id, department_id, username, display_name, password_hash, status, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', false) RETURNING id`,
      [employee.factory_id, employee.id, departmentId, employee.employee_code, employee.full_name, hashPassword("payroll1234")]
    );
    await client.query(
      `INSERT INTO user_factory_memberships (user_id, factory_id, department_id, is_default, is_active)
       VALUES ($1, $2, $3, true, true)
       ON CONFLICT (user_id, factory_id) WHERE deleted_at IS NULL DO UPDATE
       SET department_id = EXCLUDED.department_id, is_default = true, is_active = true, updated_at = now()`,
      [account.rows[0].id, employee.factory_id, departmentId]
    );
    await client.query("COMMIT");
    created += 1;
  } catch (error) {
    await client.query("ROLLBACK");
    skipped += 1;
    console.error(`Không thể tạo tài khoản cho ${employee.employee_code}:`, error instanceof Error ? error.message : error);
  } finally {
    client.release();
  }
}

console.log(`Hoàn tất: tạo ${created} tài khoản, bỏ qua ${skipped} bản ghi.`);
await pool.end();
