import { query, queryOne } from "@/lib/db";

export class PayrollSlipService {
  /**
   * Get all calculated payroll items for a given cycle (compiled payroll sheet)
   */
  static async getPayrollItems(cycleId: string, search?: string) {
    let sql = `SELECT id, payroll_cycle_id as "payrollCycleId", employee_id as "employeeId",
                      employee_code as "employeeCode", employee_name as "employeeName",
                      actual_workdays as "actualWorkdays", paid_leave_days as "paidLeaveDays",
                      holiday_days as "holidayDays", unpaid_leave_days as "unpaidLeaveDays",
                      overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
                      overtime_holiday_hours as "overtimeHolidayHours", monthly_salary_amount as "monthlySalaryAmount",
                      paid_leave_amount as "paidLeaveAmount", overtime_normal_amount as "overtimeNormalAmount",
                      overtime_sunday_amount as "overtimeSundayAmount", overtime_holiday_amount as "overtimeHolidayAmount",
                      allowance_amount as "allowanceAmount", gross_income as "grossIncome",
                      company_insurance_amount as "companyInsuranceAmount", employee_insurance_amount as "employeeInsuranceAmount",
                      union_fee_amount as "unionFeeAmount", personal_income_tax_amount as "personalIncomeTaxAmount",
                      advance_payment_1 as "advancePayment1", advance_payment_2 as "advancePayment2",
                      total_deduction as "totalDeduction", net_salary as "netSalary",
                      second_payment_amount as "secondPaymentAmount", note, calculated_at as "calculatedAt"
               FROM payroll_items
               WHERE payroll_cycle_id = $1`;
    const params: any[] = [cycleId];

    if (search) {
      sql += ` AND (employee_code ILIKE $2 OR employee_name ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC`;

    return await query(sql, params);
  }

  /**
   * Get detailed payslip for a specific employee in a cycle
   */
  static async getPayslip(cycleId: string, employeeId: string) {
    // Get payroll item details
    const item = await queryOne(
      `SELECT id, payroll_cycle_id as "payrollCycleId", employee_id as "employeeId",
              employee_code as "employeeCode", employee_name as "employeeName",
              salary_config_snapshot as "salaryConfigSnapshot", rule_snapshot as "ruleSnapshot",
              actual_workdays as "actualWorkdays", paid_leave_days as "paidLeaveDays",
              holiday_days as "holidayDays", unpaid_leave_days as "unpaidLeaveDays",
              overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
              overtime_holiday_hours as "overtimeHolidayHours", monthly_salary_amount as "monthlySalaryAmount",
              paid_leave_amount as "paidLeaveAmount", overtime_normal_amount as "overtimeNormalAmount",
              overtime_sunday_amount as "overtimeSundayAmount", overtime_holiday_amount as "overtimeHolidayAmount",
              allowance_amount as "allowanceAmount", gross_income as "grossIncome",
              company_insurance_amount as "companyInsuranceAmount", employee_insurance_amount as "employeeInsuranceAmount",
              union_fee_amount as "unionFeeAmount", personal_income_tax_amount as "personalIncomeTaxAmount",
              advance_payment_1 as "advancePayment1", advance_payment_2 as "advancePayment2",
              total_deduction as "totalDeduction", net_salary as "netSalary",
              second_payment_amount as "secondPaymentAmount", note, calculated_at as "calculatedAt"
       FROM payroll_items
       WHERE payroll_cycle_id = $1 AND employee_id = $2`,
      [cycleId, employeeId]
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
       WHERE id = $1`,
      [cycleId]
    );

    return {
      payrollItem: item,
      lines,
      cycle,
    };
  }
}
