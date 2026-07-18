import { query, queryOne } from "@/lib/db";

export class PersonalService {
  static async getOverview(employeeId: string, factoryId: string, month?: string) {
    const attendanceParams: string[] = [employeeId, factoryId];
    const attendanceMonthCondition = month
      ? "AND ar.work_date >= $3::date AND ar.work_date < ($3::date + INTERVAL '1 month')"
      : "";
    if (month) attendanceParams.push(`${month}-01`);
    const [profile, attendance, payrollHistory] = await Promise.all([
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
    ]);

    if (!profile) return null;
    return { profile, attendance, payrollHistory };
  }
}
