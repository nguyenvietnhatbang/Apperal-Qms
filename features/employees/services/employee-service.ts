import { query, queryOne, transaction } from "@/lib/db";
import { EmployeeAccountService } from "@/features/personal/services/employee-account-service";

export interface EmployeeData {
  id?: string;
  factoryId: string;
  employeeCode: string;
  fullName: string;
  gender?: string | null;
  departmentName?: string | null;
  positionTitle?: string | null;
  joinedDate?: string | Date | null;
  status?: "active" | "inactive" | "terminated";
  dependentCount?: number;
  hasChildUnder6?: boolean;
}

export class EmployeeService {
  /**
   * Get all active employees (optionally filtered by search query)
   */
  static async getEmployees(factoryId: string, search?: string) {
    let sql = `SELECT id, employee_code as "employeeCode", full_name as "fullName", gender, 
                      department_name as "departmentName", position_title as "positionTitle", 
                      joined_date as "joinedDate", status, dependent_count as "dependentCount", 
                      has_child_under_6 as "hasChildUnder6"
               FROM employees
               WHERE deleted_at IS NULL AND factory_id = $1`;
    const params: any[] = [factoryId];

    if (search) {
      sql += ` AND (employee_code ILIKE $2 OR full_name ILIKE $2 OR department_name ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC`;

    return await query(sql, params);
  }

  /**
   * Get employee by ID
   */
  static async getEmployeeById(id: string, factoryId: string) {
    return await queryOne(
      `SELECT id, employee_code as "employeeCode", full_name as "fullName", gender, 
              department_name as "departmentName", position_title as "positionTitle", 
              joined_date as "joinedDate", status, dependent_count as "dependentCount", 
              has_child_under_6 as "hasChildUnder6"
       FROM employees
       WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
      [id, factoryId]
    );
  }

  /**
   * Get employee by Code
   */
  static async getEmployeeByCode(code: string, factoryId: string) {
    return await queryOne(
      `SELECT id, employee_code as "employeeCode", full_name as "fullName", gender, 
              department_name as "departmentName", position_title as "positionTitle", 
              joined_date as "joinedDate", status, dependent_count as "dependentCount", 
              has_child_under_6 as "hasChildUnder6"
       FROM employees
       WHERE employee_code = $1 AND factory_id = $2 AND deleted_at IS NULL`,
      [code, factoryId]
    );
  }

  /**
   * Create employee
   */
  static async createEmployee(data: EmployeeData) {
    return await transaction(async (client) => {
      const employeeResult = await client.query(
      `INSERT INTO employees (factory_id, employee_code, full_name, gender, department_name, position_title,
                              joined_date, status, dependent_count, has_child_under_6)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, employee_code as "employeeCode", full_name as "fullName", gender, 
                 department_name as "departmentName", position_title as "positionTitle", 
                 joined_date as "joinedDate", status, dependent_count as "dependentCount", 
                 has_child_under_6 as "hasChildUnder6"`,
        [
        data.factoryId,
        data.employeeCode,
        data.fullName,
        data.gender || null,
        data.departmentName || null,
        data.positionTitle || null,
        data.joinedDate || null,
        data.status || "active",
        data.dependentCount !== undefined ? data.dependentCount : 0,
        data.hasChildUnder6 !== undefined ? data.hasChildUnder6 : false,
        ]
      );
      const employee = employeeResult.rows[0];
      await EmployeeAccountService.createForEmployee(client, {
        id: employee.id,
        factoryId: data.factoryId,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
      });
      return employee;
    });
  }

  /**
   * Update employee details
   */
  static async updateEmployee(id: string, data: EmployeeData) {
    return await queryOne(
      `UPDATE employees 
       SET employee_code = $1, full_name = $2, gender = $3, department_name = $4, position_title = $5, 
           joined_date = $6, status = $7, dependent_count = $8, has_child_under_6 = $9, updated_at = now()
       WHERE id = $10 AND factory_id = $11 AND deleted_at IS NULL
       RETURNING id, employee_code as "employeeCode", full_name as "fullName", gender, 
                 department_name as "departmentName", position_title as "positionTitle", 
                 joined_date as "joinedDate", status, dependent_count as "dependentCount", 
                 has_child_under_6 as "hasChildUnder6"`,
      [
        data.employeeCode,
        data.fullName,
        data.gender || null,
        data.departmentName || null,
        data.positionTitle || null,
        data.joinedDate || null,
        data.status || "active",
        data.dependentCount !== undefined ? data.dependentCount : 0,
        data.hasChildUnder6 !== undefined ? data.hasChildUnder6 : false,
        id,
        data.factoryId,
      ]
    );
  }

  /**
   * Soft delete employee
   */
  static async deleteEmployee(id: string, factoryId: string) {
    await query(
      `UPDATE employees 
       SET deleted_at = now(), status = 'inactive' 
       WHERE id = $1 AND factory_id = $2`,
      [id, factoryId]
    );
    return true;
  }
}
