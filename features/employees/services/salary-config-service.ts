import { z } from "zod";
import { query } from "@/lib/db";
import { notFoundError } from "@/lib/errors";
import { salaryConfigSchema } from "@/features/employees/types/employee-types";

function mapConfig(row: Record<string, unknown>) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    totalSalary: row.total_salary,
    insuranceSalary: row.insurance_salary,
    baseSalary: row.base_salary,
    positionAllowance: row.position_allowance,
    responsibilityAllowance: row.responsibility_allowance,
    seniorityAllowance: row.seniority_allowance,
    safetyAllowance: row.safety_allowance,
    phoneAllowance: row.phone_allowance,
    travelAllowance: row.travel_allowance,
    housingAllowance: row.housing_allowance,
    attendanceBonus: row.attendance_bonus,
    otherBonus: row.other_bonus,
    mealAllowance: row.meal_allowance,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSalaryConfigs(employeeId: string) {
  const result = await query(
    `SELECT *
     FROM employee_salary_configs
     WHERE employee_id = $1
     ORDER BY effective_from DESC`,
    [employeeId],
  );
  return result.rows.map(mapConfig);
}

export async function createSalaryConfig(employeeId: string, input: z.infer<typeof salaryConfigSchema>) {
  const result = await query(
    `INSERT INTO employee_salary_configs (
      employee_id, effective_from, effective_to, total_salary, insurance_salary, base_salary,
      position_allowance, responsibility_allowance, seniority_allowance, safety_allowance,
      phone_allowance, travel_allowance, housing_allowance, attendance_bonus, other_bonus,
      meal_allowance, note
    )
    VALUES (
      $1, $2::date, NULLIF($3, '')::date, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17
    )
    RETURNING id`,
    [
      employeeId,
      input.effectiveFrom,
      input.effectiveTo || "",
      input.totalSalary,
      input.insuranceSalary,
      input.baseSalary,
      input.positionAllowance,
      input.responsibilityAllowance,
      input.seniorityAllowance,
      input.safetyAllowance,
      input.phoneAllowance,
      input.travelAllowance,
      input.housingAllowance,
      input.attendanceBonus,
      input.otherBonus,
      input.mealAllowance,
      input.note ?? null,
    ],
  );
  const rows = await query("SELECT * FROM employee_salary_configs WHERE id = $1", [result.rows[0].id]);
  return mapConfig(rows.rows[0]);
}

export async function updateSalaryConfig(
  employeeId: string,
  configId: string,
  input: z.infer<typeof salaryConfigSchema>,
) {
  const result = await query(
    `UPDATE employee_salary_configs
     SET effective_from = $3::date, effective_to = NULLIF($4, '')::date,
      total_salary = $5, insurance_salary = $6, base_salary = $7,
      position_allowance = $8, responsibility_allowance = $9, seniority_allowance = $10,
      safety_allowance = $11, phone_allowance = $12, travel_allowance = $13,
      housing_allowance = $14, attendance_bonus = $15, other_bonus = $16,
      meal_allowance = $17, note = $18, updated_at = now()
     WHERE employee_id = $1 AND id = $2
     RETURNING *`,
    [
      employeeId,
      configId,
      input.effectiveFrom,
      input.effectiveTo || "",
      input.totalSalary,
      input.insuranceSalary,
      input.baseSalary,
      input.positionAllowance,
      input.responsibilityAllowance,
      input.seniorityAllowance,
      input.safetyAllowance,
      input.phoneAllowance,
      input.travelAllowance,
      input.housingAllowance,
      input.attendanceBonus,
      input.otherBonus,
      input.mealAllowance,
      input.note ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw notFoundError("Không tìm thấy cấu hình lương");
  return mapConfig(row);
}

export async function deleteSalaryConfig(employeeId: string, configId: string) {
  const result = await query(
    `DELETE FROM employee_salary_configs WHERE employee_id = $1 AND id = $2`,
    [employeeId, configId],
  );
  if (!result.rowCount) throw notFoundError("Không tìm thấy cấu hình lương");
}
