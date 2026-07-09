import { query, queryOne } from "@/lib/db";

export class PayrollSlipService {
  /**
   * Get all calculated payroll items for a given cycle (compiled payroll sheet)
   */
  static async getPayrollItems(cycleId: string, factoryId: string, search?: string) {
    let sql = `SELECT id, payroll_cycle_id as "payrollCycleId", employee_id as "employeeId",
                      employee_code as "employeeCode", employee_name as "employeeName",
                      actual_workdays as "actualWorkdays", paid_leave_days as "paidLeaveDays",
                      paid_leave_hours as "paidLeaveHours", annual_leave_total as "annualLeaveTotal",
                      annual_leave_used_cumulative as "annualLeaveUsedCumulative",
                      annual_leave_remaining as "annualLeaveRemaining",
                      holiday_days as "holidayDays", personal_leave_days as "personalLeaveDays",
                      unpaid_leave_days as "unpaidLeaveDays",
                      overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
                      overtime_holiday_hours as "overtimeHolidayHours", night_shift_hours as "nightShiftHours",
                      excess_overtime_normal_hours as "excessOvertimeNormalHours",
                      excess_overtime_sunday_hours as "excessOvertimeSundayHours",
                      excess_overtime_holiday_hours as "excessOvertimeHolidayHours",
                      monthly_salary_amount as "monthlySalaryAmount", personal_leave_amount as "personalLeaveAmount",
                      paid_leave_amount as "paidLeaveAmount", overtime_normal_amount as "overtimeNormalAmount",
                      overtime_sunday_amount as "overtimeSundayAmount", overtime_holiday_amount as "overtimeHolidayAmount",
                      night_shift_amount as "nightShiftAmount", excess_overtime_normal_amount as "excessOvertimeNormalAmount",
                      excess_overtime_sunday_amount as "excessOvertimeSundayAmount",
                      excess_overtime_holiday_amount as "excessOvertimeHolidayAmount",
                      allowance_amount as "allowanceAmount", business_trip_allowance as "businessTripAllowance",
                      compliance_bonus as "complianceBonus", work_trip_support as "workTripSupport",
                      menstrual_allowance_amount as "menstrualAllowanceAmount",
                      child_allowance_amount as "childAllowanceAmount", gross_income as "grossIncome",
                      company_insurance_amount as "companyInsuranceAmount", employee_insurance_amount as "employeeInsuranceAmount",
                      union_fee_amount as "unionFeeAmount", personal_income_tax_amount as "personalIncomeTaxAmount",
                      advance_payment_1 as "advancePayment1", advance_payment_2 as "advancePayment2",
                      pending_leave_advance as "pendingLeaveAdvance",
                      total_deduction as "totalDeduction", net_salary as "netSalary",
                      second_payment_amount as "secondPaymentAmount", note, calculated_at as "calculatedAt"
               FROM payroll_items
               WHERE payroll_cycle_id = $1
                 AND EXISTS (
                   SELECT 1 FROM payroll_cycles c
                   WHERE c.id = payroll_items.payroll_cycle_id
                     AND c.factory_id = $2
                 )`;
    const params: any[] = [cycleId, factoryId];

    if (search) {
      sql += ` AND (employee_code ILIKE $3 OR employee_name ILIKE $3)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC`;

    return await query(sql, params);
  }

  /**
   * Get detailed payslip for a specific employee in a cycle
   */
  static async getPayslip(cycleId: string, employeeId: string, factoryId: string) {
    // Get payroll item details
    const item = await queryOne(
      `SELECT id, payroll_cycle_id as "payrollCycleId", employee_id as "employeeId",
              employee_code as "employeeCode", employee_name as "employeeName",
              salary_config_snapshot as "salaryConfigSnapshot", rule_snapshot as "ruleSnapshot",
              actual_workdays as "actualWorkdays", paid_leave_days as "paidLeaveDays",
              paid_leave_hours as "paidLeaveHours", annual_leave_total as "annualLeaveTotal",
              annual_leave_used_cumulative as "annualLeaveUsedCumulative",
              annual_leave_remaining as "annualLeaveRemaining",
              holiday_days as "holidayDays", personal_leave_days as "personalLeaveDays",
              unpaid_leave_days as "unpaidLeaveDays",
              overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
              overtime_holiday_hours as "overtimeHolidayHours", night_shift_hours as "nightShiftHours",
              excess_overtime_normal_hours as "excessOvertimeNormalHours",
              excess_overtime_sunday_hours as "excessOvertimeSundayHours",
              excess_overtime_holiday_hours as "excessOvertimeHolidayHours",
              monthly_salary_amount as "monthlySalaryAmount", personal_leave_amount as "personalLeaveAmount",
              paid_leave_amount as "paidLeaveAmount", overtime_normal_amount as "overtimeNormalAmount",
              overtime_sunday_amount as "overtimeSundayAmount", overtime_holiday_amount as "overtimeHolidayAmount",
              night_shift_amount as "nightShiftAmount", excess_overtime_normal_amount as "excessOvertimeNormalAmount",
              excess_overtime_sunday_amount as "excessOvertimeSundayAmount",
              excess_overtime_holiday_amount as "excessOvertimeHolidayAmount",
              allowance_amount as "allowanceAmount", business_trip_allowance as "businessTripAllowance",
              compliance_bonus as "complianceBonus", work_trip_support as "workTripSupport",
              menstrual_allowance_amount as "menstrualAllowanceAmount",
              child_allowance_amount as "childAllowanceAmount", gross_income as "grossIncome",
              company_insurance_amount as "companyInsuranceAmount", employee_insurance_amount as "employeeInsuranceAmount",
              union_fee_amount as "unionFeeAmount", personal_income_tax_amount as "personalIncomeTaxAmount",
              advance_payment_1 as "advancePayment1", advance_payment_2 as "advancePayment2",
              pending_leave_advance as "pendingLeaveAdvance",
              total_deduction as "totalDeduction", net_salary as "netSalary",
              second_payment_amount as "secondPaymentAmount", note, calculated_at as "calculatedAt"
       FROM payroll_items
       WHERE payroll_cycle_id = $1
         AND employee_id = $2
         AND EXISTS (
           SELECT 1 FROM payroll_cycles c
           WHERE c.id = payroll_items.payroll_cycle_id
             AND c.factory_id = $3
         )`,
      [cycleId, employeeId, factoryId]
    );

    if (!item) return null;

    // Get detailed lines
    const lines = await query(
      `SELECT id, line_code as "lineCode", line_name as "lineName", quantity, rate, amount,
              line_type as "lineType", sort_order as "sortOrder"
       FROM payroll_item_lines
       WHERE payroll_item_id = $1
       ORDER BY sort_order ASC`,
      [item.id]
    );

    // Get cycle details
    const cycle = await queryOne(
      `SELECT code, name, period_start as "periodStart", period_end as "periodEnd"
       FROM payroll_cycles
       WHERE id = $1 AND factory_id = $2`,
      [cycleId, factoryId]
    );

    return {
      payrollItem: item,
      lines,
      cycle,
    };
  }
}
