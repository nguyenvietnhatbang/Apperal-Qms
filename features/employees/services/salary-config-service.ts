import { query, queryOne, transaction } from "@/lib/db";

export interface SalaryConfigData {
  id?: string;
  employeeId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  totalSalary: number;
  insuranceSalary: number;
  baseSalary: number;
  positionAllowance?: number;
  responsibilityAllowance?: number;
  seniorityAllowance?: number;
  safetyAllowance?: number;
  phoneAllowance?: number;
  travelAllowance?: number;
  housingAllowance?: number;
  attendanceBonus?: number;
  otherBonus?: number;
  mealAllowance?: number;
  note?: string | null;
}

export interface BulkSalaryConfigData extends Omit<SalaryConfigData, "employeeId" | "totalSalary"> {
  employeeIds: string[];
}

const salaryConfigSelectFields = `id, employee_id as "employeeId", effective_from as "effectiveFrom", effective_to as "effectiveTo",
  total_salary as "totalSalary", insurance_salary as "insuranceSalary", base_salary as "baseSalary",
  position_allowance as "positionAllowance", responsibility_allowance as "responsibilityAllowance",
  seniority_allowance as "seniorityAllowance", safety_allowance as "safetyAllowance",
  phone_allowance as "phoneAllowance", travel_allowance as "travelAllowance",
  housing_allowance as "housingAllowance", attendance_bonus as "attendanceBonus",
  other_bonus as "otherBonus", meal_allowance as "mealAllowance", note`;

function calculateTotalSalary(data: SalaryConfigData | BulkSalaryConfigData) {
  return Number(data.baseSalary) +
    Number(data.positionAllowance || 0) +
    Number(data.responsibilityAllowance || 0) +
    Number(data.seniorityAllowance || 0) +
    Number(data.safetyAllowance || 0) +
    Number(data.phoneAllowance || 0) +
    Number(data.travelAllowance || 0) +
    Number(data.housingAllowance || 0) +
    Number(data.attendanceBonus || 0) +
    Number(data.otherBonus || 0) +
    Number(data.mealAllowance || 0);
}

export class SalaryConfigService {
  /**
   * Get all salary configurations for an employee
   */
  static async getConfigsByEmployeeId(employeeId: string, factoryId: string) {
    return await query(
      `SELECT ${salaryConfigSelectFields}
       FROM employee_salary_configs
       WHERE employee_id = $1
         AND EXISTS (
           SELECT 1
           FROM employees e
           WHERE e.id = employee_salary_configs.employee_id
             AND e.factory_id = $2
             AND e.deleted_at IS NULL
         )
       ORDER BY effective_from DESC`,
      [employeeId, factoryId]
    );
  }

  /**
   * Get active salary configuration for an employee in a given period
   */
  static async getActiveConfig(employeeId: string, dateStr: string) {
    return await queryOne(
      `SELECT ${salaryConfigSelectFields}
       FROM employee_salary_configs
       WHERE employee_id = $1 
         AND effective_from <= $2 
         AND (effective_to IS NULL OR effective_to >= $2)
       ORDER BY effective_from DESC
       LIMIT 1`,
      [employeeId, dateStr]
    );
  }

  /**
   * Create new salary configuration. Auto-close the previous open configuration if any.
   */
  static async createSalaryConfig(data: SalaryConfigData, factoryId: string) {
    const total = calculateTotalSalary(data);

    return await transaction(async (client) => {
      const employee = await client.query(
        `SELECT id FROM employees WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
        [data.employeeId, factoryId]
      );
      if (employee.rowCount === 0) {
        throw new Error("Không tìm thấy nhân viên trong xưởng hiện tại.");
      }

      const currentOpenConfig = await client.query(
        `SELECT id
         FROM employee_salary_configs
         WHERE employee_id = $1
           AND effective_to IS NULL
           AND effective_from >= $2::date
         LIMIT 1`,
        [data.employeeId, data.effectiveFrom]
      );

      if (currentOpenConfig.rowCount > 0) {
        throw new Error("Ngày hiệu lực của bản ghi lương mới phải sau ngày hiệu lực của bản ghi hiện tại.");
      }

      await client.query(
        `UPDATE employee_salary_configs
         SET effective_to = $1::date - INTERVAL '1 day',
             updated_at = now()
         WHERE employee_id = $2
           AND effective_to IS NULL
           AND effective_from < $1::date`,
        [data.effectiveFrom, data.employeeId]
      );

      const result = await client.query(
        `INSERT INTO employee_salary_configs (
           employee_id, effective_from, effective_to, total_salary, insurance_salary, base_salary,
           position_allowance, responsibility_allowance, seniority_allowance, safety_allowance,
           phone_allowance, travel_allowance, housing_allowance, attendance_bonus, other_bonus, meal_allowance, note
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING ${salaryConfigSelectFields}`,
        [
          data.employeeId,
          data.effectiveFrom,
          data.effectiveTo || null,
          total,
          data.insuranceSalary,
          data.baseSalary,
          data.positionAllowance || 0,
          data.responsibilityAllowance || 0,
          data.seniorityAllowance || 0,
          data.safetyAllowance || 0,
          data.phoneAllowance || 0,
          data.travelAllowance || 0,
          data.housingAllowance || 0,
          data.attendanceBonus || 0,
          data.otherBonus || 0,
          data.mealAllowance || 0,
          data.note || null,
        ]
      );

      return result.rows[0] || null;
    });
  }

  /**
   * Update an existing salary configuration without creating a new history row.
   */
  static async updateSalaryConfig(configId: string, data: SalaryConfigData, factoryId: string) {
    const total = calculateTotalSalary(data);

    return await queryOne(
      `UPDATE employee_salary_configs
       SET effective_from = $3,
           effective_to = $4,
           total_salary = $5,
           insurance_salary = $6,
           base_salary = $7,
           position_allowance = $8,
           responsibility_allowance = $9,
           seniority_allowance = $10,
           safety_allowance = $11,
           phone_allowance = $12,
           travel_allowance = $13,
           housing_allowance = $14,
           attendance_bonus = $15,
           other_bonus = $16,
           meal_allowance = $17,
           note = $18,
           updated_at = now()
       WHERE id = $1
         AND employee_id = $2
         AND effective_to IS NULL
         AND EXISTS (
           SELECT 1
           FROM employees e
           WHERE e.id = employee_salary_configs.employee_id
             AND e.factory_id = $19
             AND e.deleted_at IS NULL
         )
       RETURNING ${salaryConfigSelectFields}`,
      [
        configId,
        data.employeeId,
        data.effectiveFrom,
        data.effectiveTo || null,
        total,
        data.insuranceSalary,
        data.baseSalary,
        data.positionAllowance || 0,
        data.responsibilityAllowance || 0,
        data.seniorityAllowance || 0,
        data.safetyAllowance || 0,
        data.phoneAllowance || 0,
        data.travelAllowance || 0,
        data.housingAllowance || 0,
        data.attendanceBonus || 0,
        data.otherBonus || 0,
        data.mealAllowance || 0,
        data.note || null,
        factoryId,
      ]
    );
  }

  /**
   * Create the same salary configuration for many employees in one transaction.
   */
  static async createBulkSalaryConfigs(data: BulkSalaryConfigData, factoryId: string) {
    const employeeIds = Array.from(new Set(data.employeeIds));
    const total = calculateTotalSalary(data);

    return await transaction(async (client) => {
      const existingEmployees = await client.query(
        `SELECT id
         FROM employees
         WHERE id = ANY($1::uuid[]) AND factory_id = $2 AND deleted_at IS NULL`,
        [employeeIds, factoryId]
      );

      if (existingEmployees.rowCount !== employeeIds.length) {
        throw new Error("Một số nhân viên được chọn không tồn tại hoặc đã bị xóa.");
      }

      await client.query(
        `UPDATE employee_salary_configs
         SET effective_to = $1::date - INTERVAL '1 day',
             updated_at = now()
         WHERE employee_id = ANY($2::uuid[])
           AND effective_to IS NULL
           AND effective_from < $1::date`,
        [data.effectiveFrom, employeeIds]
      );

      const result = await client.query(
        `INSERT INTO employee_salary_configs (
           employee_id, effective_from, effective_to, total_salary, insurance_salary, base_salary,
           position_allowance, responsibility_allowance, seniority_allowance, safety_allowance,
           phone_allowance, travel_allowance, housing_allowance, attendance_bonus, other_bonus, meal_allowance, note
         )
         SELECT employee_id, $2::date, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
         FROM unnest($1::uuid[]) AS employee_id
         RETURNING id, employee_id as "employeeId", effective_from as "effectiveFrom", effective_to as "effectiveTo",
                   total_salary as "totalSalary", insurance_salary as "insuranceSalary", base_salary as "baseSalary"`,
        [
          employeeIds,
          data.effectiveFrom,
          data.effectiveTo || null,
          total,
          data.insuranceSalary,
          data.baseSalary,
          data.positionAllowance || 0,
          data.responsibilityAllowance || 0,
          data.seniorityAllowance || 0,
          data.safetyAllowance || 0,
          data.phoneAllowance || 0,
          data.travelAllowance || 0,
          data.housingAllowance || 0,
          data.attendanceBonus || 0,
          data.otherBonus || 0,
          data.mealAllowance || 0,
          data.note || null,
        ]
      );

      return result.rows;
    });
  }

  /**
   * Delete a salary configuration
   */
  static async deleteSalaryConfig(id: string) {
    await query(`DELETE FROM employee_salary_configs WHERE id = $1`, [id]);
    return true;
  }
}
