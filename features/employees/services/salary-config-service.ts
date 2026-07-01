import { query, queryOne } from "@/lib/db";

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

export class SalaryConfigService {
  /**
   * Get all salary configurations for an employee
   */
  static async getConfigsByEmployeeId(employeeId: string) {
    return await query(
      `SELECT id, employee_id as "employeeId", effective_from as "effectiveFrom", effective_to as "effectiveTo", 
              total_salary as "totalSalary", insurance_salary as "insuranceSalary", base_salary as "baseSalary", 
              position_allowance as "positionAllowance", responsibility_allowance as "responsibilityAllowance", 
              seniority_allowance as "seniorityAllowance", safety_allowance as "safetyAllowance", 
              phone_allowance as "phoneAllowance", travel_allowance as "travelAllowance", 
              housing_allowance as "housingAllowance", attendance_bonus as "attendanceBonus", 
              other_bonus as "otherBonus", meal_allowance as "mealAllowance", note
       FROM employee_salary_configs
       WHERE employee_id = $1
       ORDER BY effective_from DESC`,
      [employeeId]
    );
  }

  /**
   * Get active salary configuration for an employee in a given period
   */
  static async getActiveConfig(employeeId: string, dateStr: string) {
    return await queryOne(
      `SELECT id, employee_id as "employeeId", effective_from as "effectiveFrom", effective_to as "effectiveTo", 
              total_salary as "totalSalary", insurance_salary as "insuranceSalary", base_salary as "baseSalary", 
              position_allowance as "positionAllowance", responsibility_allowance as "responsibilityAllowance", 
              seniority_allowance as "seniorityAllowance", safety_allowance as "safetyAllowance", 
              phone_allowance as "phoneAllowance", travel_allowance as "travelAllowance", 
              housing_allowance as "housingAllowance", attendance_bonus as "attendanceBonus", 
              other_bonus as "otherBonus", meal_allowance as "mealAllowance", note
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
  static async createSalaryConfig(data: SalaryConfigData) {
    const total = Number(data.baseSalary) + 
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

    // Auto-update previous config's effective_to if it's currently open
    await query(
      `UPDATE employee_salary_configs
       SET effective_to = $1 - INTERVAL '1 day'
       WHERE employee_id = $2 AND effective_to IS NULL AND effective_from < $1`,
      [data.effectiveFrom, data.employeeId]
    );

    return await queryOne(
      `INSERT INTO employee_salary_configs (
         employee_id, effective_from, effective_to, total_salary, insurance_salary, base_salary, 
         position_allowance, responsibility_allowance, seniority_allowance, safety_allowance, 
         phone_allowance, travel_allowance, housing_allowance, attendance_bonus, other_bonus, meal_allowance, note
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id, employee_id as "employeeId", effective_from as "effectiveFrom", effective_to as "effectiveTo", 
                 total_salary as "totalSalary", insurance_salary as "insuranceSalary", base_salary as "baseSalary"`,
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
  }

  /**
   * Delete a salary configuration
   */
  static async deleteSalaryConfig(id: string) {
    await query(`DELETE FROM employee_salary_configs WHERE id = $1`, [id]);
    return true;
  }
}
