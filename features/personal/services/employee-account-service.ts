import { hashPassword } from "@/lib/auth-session";

const DEFAULT_EMPLOYEE_PASSWORD = "payroll1234";

interface EmployeeAccountInput {
  id: string;
  factoryId: string;
  employeeCode: string;
  fullName: string;
}

export class EmployeeAccountService {
  static async createForEmployee(client: any, employee: EmployeeAccountInput) {
    const existingAccount = await client.query(
      `SELECT id FROM app_users WHERE employee_id = $1 AND deleted_at IS NULL`,
      [employee.id]
    );
    if (existingAccount.rowCount > 0) return existingAccount.rows[0];

    const personalDepartmentResult = await client.query(
      `INSERT INTO departments (factory_id, code, name, description, is_admin, is_active)
       VALUES ($1, 'personal', 'Nhân viên', 'Quyền self-service cho nhân viên.', false, true)
       ON CONFLICT (factory_id, code) DO UPDATE SET is_active = true, updated_at = now()
       RETURNING id`,
      [employee.factoryId]
    );
    const personalDepartmentId = personalDepartmentResult.rows[0].id;

    await client.query(
      `INSERT INTO department_module_permissions (
         department_id, module_id, can_view, can_create, can_update, can_delete, can_approve
       )
       SELECT $1, id, true, false, false, false, false
       FROM modules WHERE code = 'personal' AND is_active = true
       ON CONFLICT (department_id, module_id) DO UPDATE SET can_view = true, updated_at = now()`,
      [personalDepartmentId]
    );

    const accountResult = await client.query(
      `INSERT INTO app_users (
         factory_id, employee_id, department_id, username, display_name, password_hash, status, is_admin
       ) VALUES ($1, $2, $3, $4, $5, $6, 'active', false)
       RETURNING id, username`,
      [
        employee.factoryId,
        employee.id,
        personalDepartmentId,
        employee.employeeCode,
        employee.fullName,
        hashPassword(DEFAULT_EMPLOYEE_PASSWORD),
      ]
    );
    const account = accountResult.rows[0];

    await client.query(
      `INSERT INTO user_factory_memberships (user_id, factory_id, department_id, is_default, is_active)
       VALUES ($1, $2, $3, true, true)
       ON CONFLICT (user_id, factory_id) WHERE deleted_at IS NULL DO UPDATE
       SET department_id = EXCLUDED.department_id, is_default = true, is_active = true, updated_at = now()`,
      [account.id, employee.factoryId, personalDepartmentId]
    );

    return account;
  }
}

