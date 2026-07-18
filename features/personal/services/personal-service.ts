import { query, queryOne } from "@/lib/db";

export class PersonalService {
  static async getAttendance(employeeId: string, factoryId: string, month: string) {
    return query(
      `SELECT ar.work_date as "workDate", ar.weekday_name as "weekdayName",
              ar.department_name as "departmentName", ar.position_title as "positionTitle", ar.shift_name as "shiftName",
              ar.workday_count as "workdayCount", ar.work_hours as "workHours",
              ar.check_in_1 as "checkIn", ar.check_out_1 as "checkOut",
              ar.check_in_2 as "checkIn2", ar.check_out_2 as "checkOut2",
              ar.check_in_3 as "checkIn3", ar.check_out_3 as "checkOut3",
              ar.extra_workday_count as "extraWorkdayCount", ar.extra_hours as "extraHours",
              ar.late_minutes as "lateMinutes", ar.early_leave_minutes as "earlyLeaveMinutes",
              ar.overtime_normal_hours as "overtimeHours", ar.overtime_sunday_hours as "overtimeSundayHours",
              ar.overtime_holiday_hours as "overtimeHolidayHours", ar.symbol, ar.extra_symbol as "extraSymbol",
              ar.total_hours as "totalHours", ar.note
       FROM attendance_records ar
       WHERE ar.employee_id = $1
         AND ar.work_date >= $2::date
         AND ar.work_date < ($2::date + INTERVAL '1 month')
         AND EXISTS (SELECT 1 FROM payroll_cycles pc WHERE pc.id = ar.payroll_cycle_id AND pc.factory_id = $3)
       ORDER BY ar.work_date ASC`,
      [employeeId, `${month}-01`, factoryId]
    );
  }

  static async getOverview(employeeId: string, factoryId: string, month?: string) {
    const [profile, attendance, payrollHistory, salaryConfig, pendingPayrolls] = await Promise.all([
      queryOne(
        `SELECT employee_code as "employeeCode", full_name as "fullName", department_name as "departmentName",
                position_title as "positionTitle", joined_date as "joinedDate", status
         FROM employees
         WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
        [employeeId, factoryId]
      ),
      month
        ? this.getAttendance(employeeId, factoryId, month)
        : query(
          `SELECT ar.work_date as "workDate", ar.workday_count as "workdayCount", ar.work_hours as "workHours",
                  ar.check_in_1 as "checkIn", ar.check_out_1 as "checkOut", ar.late_minutes as "lateMinutes",
                  ar.early_leave_minutes as "earlyLeaveMinutes", ar.overtime_normal_hours as "overtimeHours", ar.symbol
           FROM attendance_records ar
           WHERE ar.employee_id = $1
             AND EXISTS (SELECT 1 FROM payroll_cycles pc WHERE pc.id = ar.payroll_cycle_id AND pc.factory_id = $2)
           ORDER BY ar.work_date DESC LIMIT 31`,
          [employeeId, factoryId]
        ),
      query(
        `SELECT pc.id as "cycleId", pc.name as "cycleName", pc.period_start as "periodStart", pc.period_end as "periodEnd",
                pc.status, pi.actual_workdays as "actualWorkdays", pi.paid_leave_days as "paidLeaveDays",
                pi.unpaid_leave_days as "unpaidLeaveDays", pi.holiday_days as "holidayDays",
                pi.overtime_normal_hours as "overtimeHours", pi.overtime_sunday_hours as "overtimeSundayHours",
                pi.overtime_holiday_hours as "overtimeHolidayHours", pi.monthly_salary_amount as "monthlySalaryAmount",
                pi.allowance_amount as "allowanceAmount", pi.other_allowance_amount as "otherAllowanceAmount",
                pi.business_trip_allowance as "businessTripAllowance", pi.compliance_bonus as "complianceBonus",
                pi.work_trip_support as "workTripSupport", pi.night_shift_amount as "nightShiftAmount",
                pi.gross_income as "grossIncome", pi.employee_insurance_amount as "employeeInsuranceAmount",
                pi.union_fee_amount as "unionFeeAmount", pi.personal_income_tax_amount as "personalIncomeTaxAmount",
                pi.advance_payment_1 as "advancePayment1", pi.advance_payment_2 as "advancePayment2",
                pi.pending_leave_advance as "pendingLeaveAdvance", pi.total_deduction as "totalDeduction",
                pi.net_salary as "netSalary", pi.note
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
                COALESCE(pi.actual_workdays, 0) as "actualWorkdays", COALESCE(pi.paid_leave_days, 0) as "paidLeaveDays",
                COALESCE(pi.unpaid_leave_days, 0) as "unpaidLeaveDays", COALESCE(pi.holiday_days, 0) as "holidayDays",
                COALESCE(pi.overtime_normal_hours, 0) as "overtimeHours", COALESCE(pi.overtime_sunday_hours, 0) as "overtimeSundayHours",
                COALESCE(pi.overtime_holiday_hours, 0) as "overtimeHolidayHours", COALESCE(pi.monthly_salary_amount, 0) as "monthlySalaryAmount",
                COALESCE(pi.allowance_amount, 0) as "allowanceAmount", COALESCE(pa.other_allowance_amount, pi.other_allowance_amount, 0) as "otherAllowanceAmount",
                COALESCE(pa.business_trip_allowance, pi.business_trip_allowance, 0) as "businessTripAllowance",
                COALESCE(pa.compliance_bonus, pi.compliance_bonus, 0) as "complianceBonus",
                COALESCE(pa.work_trip_support, pi.work_trip_support, 0) as "workTripSupport",
                COALESCE(pa.night_shift_amount, pi.night_shift_amount, 0) as "nightShiftAmount",
                COALESCE(pi.gross_income, 0) as "grossIncome", COALESCE(pi.employee_insurance_amount, 0) as "employeeInsuranceAmount",
                COALESCE(pi.union_fee_amount, 0) as "unionFeeAmount", COALESCE(pi.personal_income_tax_amount, 0) as "personalIncomeTaxAmount",
                COALESCE(pa.advance_payment_1, pi.advance_payment_1, 0) as "advancePayment1",
                COALESCE(pa.advance_payment_2, pi.advance_payment_2, 0) as "advancePayment2",
                COALESCE(pa.pending_leave_advance, pi.pending_leave_advance, 0) as "pendingLeaveAdvance",
                COALESCE(pi.total_deduction, 0) as "totalDeduction", COALESCE(pi.net_salary, 0) as "estimatedNetSalary",
                COALESCE(pa.note, pi.note) as note
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
