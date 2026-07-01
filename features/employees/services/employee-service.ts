import { query, queryOne } from "@/lib/db";

export interface EmployeeData {
  id?: string;
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
  static async getEmployees(search?: string) {
    let sql = `SELECT id, employee_code as "employeeCode", full_name as "fullName", gender, 
                      department_name as "departmentName", position_title as "positionTitle", 
                      joined_date as "joinedDate", status, dependent_count as "dependentCount", 
                      has_child_under_6 as "hasChildUnder6"
               FROM employees
               WHERE deleted_at IS NULL`;
    const params: any[] = [];

    if (search) {
      sql += ` AND (employee_code ILIKE $1 OR full_name ILIKE $1 OR department_name ILIKE $1)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC`;

    return await query(sql, params);
  }

  /**
   * Get employee by ID
   */
  static async getEmployeeById(id: string) {
    return await queryOne(
      `SELECT id, employee_code as "employeeCode", full_name as "fullName", gender, 
              department_name as "departmentName", position_title as "positionTitle", 
              joined_date as "joinedDate", status, dependent_count as "dependentCount", 
              has_child_under_6 as "hasChildUnder6"
       FROM employees
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
  }

  /**
   * Get employee by Code
   */
  static async getEmployeeByCode(code: string) {
    return await queryOne(
      `SELECT id, employee_code as "employeeCode", full_name as "fullName", gender, 
              department_name as "departmentName", position_title as "positionTitle", 
              joined_date as "joinedDate", status, dependent_count as "dependentCount", 
              has_child_under_6 as "hasChildUnder6"
       FROM employees
       WHERE employee_code = $1 AND deleted_at IS NULL`,
      [code]
    );
  }

  /**
   * Create employee
   */
  static async createEmployee(data: EmployeeData) {
    return await queryOne(
      `INSERT INTO employees (employee_code, full_name, gender, department_name, position_title, 
                              joined_date, status, dependent_count, has_child_under_6)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      ]
    );
  }

  /**
   * Update employee details
   */
  static async updateEmployee(id: string, data: EmployeeData) {
    return await queryOne(
      `UPDATE employees 
       SET employee_code = $1, full_name = $2, gender = $3, department_name = $4, position_title = $5, 
           joined_date = $6, status = $7, dependent_count = $8, has_child_under_6 = $9, updated_at = now()
       WHERE id = $10 AND deleted_at IS NULL
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
      ]
    );
  }

  /**
   * Soft delete employee
   */
  static async deleteEmployee(id: string) {
    await query(
      `UPDATE employees 
       SET deleted_at = now(), status = 'inactive' 
       WHERE id = $1`,
      [id]
    );
    return true;
  }
}
