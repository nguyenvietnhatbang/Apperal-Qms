import { query, queryOne } from "@/lib/db";

export class PersonalService {
  static async getOverview(employeeId: string, factoryId: string, month?: string) {
    const attendanceParams: string[] = [employeeId, factoryId];
    const attendanceMonthCondition = month
      ? "AND ar.work_date >= $3::date AND ar.work_date < ($3::date + INTERVAL '1 month')"
      : "";
    if (month) attendanceParams.push(`${month}-01`);
    const [profile, attendance, payrollHistory, salaryConfig, pendingPayrolls] = await Promise.all([
      queryOne(
        `SELECT employee_code as "employeeCode", full_name as "fullName", department_name as "departmentName",
                position_title as "positionTitle", joined_date as "joinedDate", status
         FROM employees
         WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
        [employeeId, factoryId]
      ),
      query(
        `SELECT work_date as "workDate", workday_count as "workdayCount", work_hours as "workHours",
                check_in_1 as "checkIn", check_out_1 as "checkOut", late_minutes as "lateMinutes",
                early_leave_minutes as "earlyLeaveMinutes", overtime_normal_hours as "overtimeHours", symbol
         FROM attendance_records ar
         JOIN payroll_cycles pc ON pc.id = ar.payroll_cycle_id
         WHERE ar.employee_id = $1 AND pc.factory_id = $2
         ${attendanceMonthCondition}
         ORDER BY ar.work_date DESC
         ${month ? "" : "LIMIT 31"}`,
        attendanceParams
      ),
      query(
        `SELECT pc.id as "cycleId", pc.name as "cycleName", pc.period_start as "periodStart", pc.period_end as "periodEnd",
                pc.status, pi.net_salary as "netSalary", pi.gross_income as "grossIncome", pi.total_deduction as "totalDeduction",
                pi.actual_workdays as "actualWorkdays", pi.overtime_normal_hours as "overtimeHours"
         FROM payroll_items pi
         JOIN payroll_cycles pc ON pc.id = pi.payroll_cycle_id
         WHERE pi.employee_id = $1 AND pc.factory_id = $2 AND pc.status IN ('locked', 'paid')
         ORDER BY pc.period_end DESC
         LIMIT 12`,
        [employeeId, factoryId]
      ),
      queryOne(
        `SELECT effective_from as "effectiveFrom", effective_to as "effectiveTo", total_salary as "totalSalary",
                insurance_salary as "insuranceSalary", base_salary as "baseSalary",
                position_allowance as "positionAllowance", responsibility_allowance as "responsibilityAllowance",
                seniority_allowance as "seniorityAllowance", safety_allowance as "safetyAllowance",
                phone_allowance as "phoneAllowance", travel_allowance as "travelAllowance",
                housing_allowance as "housingAllowance", attendance_bonus as "attendanceBonus",
                other_bonus as "otherBonus", meal_allowance as "mealAllowance", note
         FROM employee_salary_configs
         WHERE employee_id = $1 AND effective_from <= CURRENT_DATE
           AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
         ORDER BY effective_from DESC LIMIT 1`,
        [employeeId]
      ),
      query(
        `SELECT pc.id as "cycleId", pc.name as "cycleName", pc.period_start as "periodStart", pc.period_end as "periodEnd", pc.status,
                COALESCE(pi.net_salary, 0) as "estimatedNetSalary", COALESCE(pa.other_allowance_amount, 0) as "otherAllowanceAmount",
                COALESCE(pa.business_trip_allowance, 0) as "businessTripAllowance", COALESCE(pa.compliance_bonus, 0) as "complianceBonus",
                COALESCE(pa.work_trip_support, 0) as "workTripSupport", COALESCE(pa.night_shift_amount, 0) as "nightShiftAmount",
                COALESCE(pa.advance_payment_1, 0) as "advancePayment1", COALESCE(pa.advance_payment_2, 0) as "advancePayment2",
                COALESCE(pa.pending_leave_advance, 0) as "pendingLeaveAdvance", pa.note
         FROM payroll_cycles pc
         LEFT JOIN payroll_adjustments pa ON pa.payroll_cycle_id = pc.id AND pa.employee_id = $1
         LEFT JOIN payroll_items pi ON pi.payroll_cycle_id = pc.id AND pi.employee_id = $1
         WHERE pc.factory_id = $2 AND pc.status NOT IN ('locked', 'paid', 'cancelled')
         ORDER BY pc.period_end DESC LIMIT 6`,
        [employeeId, factoryId]
      ),
    ]);

    if (!profile) return null;
    return { profile, attendance, payrollHistory, salaryConfig, pendingPayrolls };
  }
}
