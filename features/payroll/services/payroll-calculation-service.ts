import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db";
import type { SessionUser } from "@/lib/auth-session";
import { roundMoney } from "@/lib/format";
import { validationError } from "@/lib/errors";
import { getActiveRuleSnapshot } from "@/features/payroll/services/payroll-rule-service";
import type {
  PayrollCalculationInput,
  PayrollRuleMap,
} from "@/features/payroll/types/payroll-types";

const requiredRules = [
  "overtime_normal_rate",
  "overtime_sunday_rate",
  "overtime_holiday_rate",
  "employee_insurance_rate",
  "company_social_insurance_rate",
  "company_health_insurance_rate",
  "company_unemployment_insurance_rate",
  "company_union_rate",
  "employee_union_rate",
];

export function calculatePayrollAmounts(input: PayrollCalculationInput) {
  const salaryPerDay = input.totalSalary / input.standardWorkdays;
  const salaryPerHour = salaryPerDay / input.standardHoursPerDay;
  const monthlySalaryAmount = roundMoney(salaryPerDay * input.paidWorkdays);
  const paidLeaveAmount = roundMoney(salaryPerDay * (input.paidLeaveDays + input.holidayDays));
  const overtimeNormalAmount = roundMoney(
    input.overtimeNormalHours * salaryPerHour * input.rules.overtime_normal_rate,
  );
  const overtimeSundayAmount = roundMoney(
    input.overtimeSundayHours * salaryPerHour * input.rules.overtime_sunday_rate,
  );
  const overtimeHolidayAmount = roundMoney(
    input.overtimeHolidayHours * salaryPerHour * input.rules.overtime_holiday_rate,
  );
  const companyInsuranceAmount = roundMoney(
    input.insuranceSalary *
      (input.rules.company_social_insurance_rate +
        input.rules.company_health_insurance_rate +
        input.rules.company_unemployment_insurance_rate +
        input.rules.company_union_rate),
  );
  const employeeInsuranceAmount = roundMoney(input.insuranceSalary * input.rules.employee_insurance_rate);
  const unionFeeAmount = roundMoney(input.insuranceSalary * input.rules.employee_union_rate);
  const grossIncome =
    monthlySalaryAmount +
    paidLeaveAmount +
    overtimeNormalAmount +
    overtimeSundayAmount +
    overtimeHolidayAmount +
    roundMoney(input.allowanceAmount);
  const totalDeduction =
    employeeInsuranceAmount +
    unionFeeAmount +
    roundMoney(input.personalIncomeTaxAmount ?? 0) +
    roundMoney(input.advancePayment1 ?? 0) +
    roundMoney(input.advancePayment2 ?? 0);

  return {
    monthlySalaryAmount,
    paidLeaveAmount,
    overtimeNormalAmount,
    overtimeSundayAmount,
    overtimeHolidayAmount,
    companyInsuranceAmount,
    employeeInsuranceAmount,
    unionFeeAmount,
    allowanceAmount: roundMoney(input.allowanceAmount),
    grossIncome,
    totalDeduction,
    netSalary: grossIncome - totalDeduction,
  };
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

async function loadCycle(client: PoolClient, cycleId: string) {
  const result = await client.query<{
    id: string;
    period_start: string;
    period_end: string;
    standard_workdays: string;
    standard_hours_per_day: string;
    status: string;
  }>("SELECT * FROM payroll_cycles WHERE id = $1 FOR UPDATE", [cycleId]);
  const cycle = result.rows[0];
  if (!cycle) throw validationError("Không tìm thấy chu kỳ lương");
  if (!["cleaned", "calculated"].includes(cycle.status)) {
    throw validationError("Chỉ được tính lương khi chu kỳ ở trạng thái cleaned hoặc calculated");
  }
  return cycle;
}

async function validateRules(rules: PayrollRuleMap) {
  const missing = requiredRules.filter((code) => rules[code] === undefined);
  if (missing.length) {
    throw validationError("Thiếu quy tắc tính lương bắt buộc", missing);
  }
}

export async function calculatePayrollCycle(cycleId: string, user: SessionUser) {
  const rules = await getActiveRuleSnapshot();
  await validateRules(rules);

  return withTransaction(async (client) => {
    const cycle = await loadCycle(client, cycleId);
    const attendanceSummary = await client.query<{
      employee_id: string | null;
      employee_code: string;
      employee_name: string;
      actual_workdays: string;
      work_hours: string;
      extra_workdays: string;
      extra_hours: string;
      late_minutes: string;
      early_leave_minutes: string;
      overtime_normal_hours: string;
      overtime_sunday_hours: string;
      overtime_holiday_hours: string;
    }>(
      `SELECT
        ar.employee_id,
        ar.employee_code,
        max(ar.employee_name) AS employee_name,
        sum(ar.workday_count)::text AS actual_workdays,
        sum(ar.work_hours)::text AS work_hours,
        sum(ar.extra_workday_count)::text AS extra_workdays,
        sum(ar.extra_hours)::text AS extra_hours,
        sum(ar.late_minutes)::text AS late_minutes,
        sum(ar.early_leave_minutes)::text AS early_leave_minutes,
        sum(ar.overtime_normal_hours)::text AS overtime_normal_hours,
        sum(ar.overtime_sunday_hours)::text AS overtime_sunday_hours,
        sum(ar.overtime_holiday_hours)::text AS overtime_holiday_hours
       FROM attendance_records ar
       WHERE ar.payroll_cycle_id = $1
       GROUP BY ar.employee_id, ar.employee_code
       ORDER BY ar.employee_code`,
      [cycleId],
    );

    if (!attendanceSummary.rows.length) {
      throw validationError("Chu kỳ chưa có dữ liệu chấm công đã làm sạch");
    }

    const errors: unknown[] = [];
    await client.query("DELETE FROM payroll_items WHERE payroll_cycle_id = $1", [cycleId]);

    for (const summary of attendanceSummary.rows) {
      const employee = await client.query<{
        id: string;
        employee_code: string;
        full_name: string;
      }>(
        `SELECT id, employee_code, full_name
         FROM employees
         WHERE employee_code = $1 AND deleted_at IS NULL`,
        [summary.employee_code],
      );
      const employeeRow = employee.rows[0];
      if (!employeeRow) {
        errors.push({ employeeCode: summary.employee_code, errors: ["Không tìm thấy nhân viên"] });
        continue;
      }

      const configs = await client.query(
        `SELECT *
         FROM employee_salary_configs
         WHERE employee_id = $1
          AND effective_from <= $3::date
          AND (effective_to IS NULL OR effective_to >= $2::date)
         ORDER BY effective_from DESC`,
        [employeeRow.id, cycle.period_start, cycle.period_end],
      );
      if (configs.rows.length !== 1) {
        errors.push({
          employeeCode: summary.employee_code,
          errors: [configs.rows.length ? "Nhiều cấu hình lương giao với chu kỳ" : "Thiếu cấu hình lương hiệu lực"],
        });
        continue;
      }

      const config = configs.rows[0];
      const allowanceAmount =
        numberValue(config.position_allowance) +
        numberValue(config.responsibility_allowance) +
        numberValue(config.seniority_allowance) +
        numberValue(config.safety_allowance) +
        numberValue(config.phone_allowance) +
        numberValue(config.travel_allowance) +
        numberValue(config.housing_allowance) +
        numberValue(config.attendance_bonus) +
        numberValue(config.other_bonus) +
        numberValue(config.meal_allowance);
      const actualWorkdays = numberValue(summary.actual_workdays) + numberValue(summary.extra_workdays);
      const amounts = calculatePayrollAmounts({
        totalSalary: numberValue(config.total_salary),
        insuranceSalary: numberValue(config.insurance_salary),
        standardWorkdays: numberValue(cycle.standard_workdays),
        standardHoursPerDay: numberValue(cycle.standard_hours_per_day),
        paidWorkdays: actualWorkdays,
        paidLeaveDays: 0,
        holidayDays: 0,
        overtimeNormalHours: numberValue(summary.overtime_normal_hours),
        overtimeSundayHours: numberValue(summary.overtime_sunday_hours),
        overtimeHolidayHours: numberValue(summary.overtime_holiday_hours),
        allowanceAmount,
        rules,
      });

      const item = await client.query<{ id: string }>(
        `INSERT INTO payroll_items (
          payroll_cycle_id, employee_id, employee_code, employee_name, salary_config_snapshot, rule_snapshot,
          actual_workdays, paid_leave_days, holiday_days, unpaid_leave_days,
          overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours,
          monthly_salary_amount, paid_leave_amount, overtime_normal_amount, overtime_sunday_amount,
          overtime_holiday_amount, allowance_amount, gross_income, company_insurance_amount,
          employee_insurance_amount, union_fee_amount, personal_income_tax_amount,
          advance_payment_1, advance_payment_2, total_deduction, net_salary, second_payment_amount
        )
        VALUES (
          $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 0, 0, 0, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 0, 0, 0, $21, $22, $23
        )
        RETURNING id`,
        [
          cycleId,
          employeeRow.id,
          employeeRow.employee_code,
          employeeRow.full_name,
          JSON.stringify(config),
          JSON.stringify(rules),
          actualWorkdays,
          numberValue(summary.overtime_normal_hours),
          numberValue(summary.overtime_sunday_hours),
          numberValue(summary.overtime_holiday_hours),
          amounts.monthlySalaryAmount,
          amounts.paidLeaveAmount,
          amounts.overtimeNormalAmount,
          amounts.overtimeSundayAmount,
          amounts.overtimeHolidayAmount,
          amounts.allowanceAmount,
          amounts.grossIncome,
          amounts.companyInsuranceAmount,
          amounts.employeeInsuranceAmount,
          amounts.unionFeeAmount,
          amounts.totalDeduction,
          amounts.netSalary,
          amounts.overtimeSundayAmount,
        ],
      );

      const lines = [
        ["monthly_salary", "Lương ngày công", actualWorkdays, null, amounts.monthlySalaryAmount, "income", 10],
        ["allowance", "Tổng phụ cấp", null, null, amounts.allowanceAmount, "income", 20],
        ["ot_normal", "Tăng ca ngày thường", summary.overtime_normal_hours, rules.overtime_normal_rate, amounts.overtimeNormalAmount, "income", 30],
        ["ot_sunday", "Tăng ca Chủ Nhật", summary.overtime_sunday_hours, rules.overtime_sunday_rate, amounts.overtimeSundayAmount, "income", 40],
        ["ot_holiday", "Tăng ca lễ", summary.overtime_holiday_hours, rules.overtime_holiday_rate, amounts.overtimeHolidayAmount, "income", 50],
        ["employee_insurance", "BHXH/BHYT/BHTN nhân viên", null, rules.employee_insurance_rate, amounts.employeeInsuranceAmount, "deduction", 60],
        ["union_fee", "Doan phi", null, rules.employee_union_rate, amounts.unionFeeAmount, "deduction", 70],
      ] as const;

      for (const line of lines) {
        await client.query(
          `INSERT INTO payroll_item_lines (payroll_item_id, line_code, line_name, quantity, rate, amount, line_type, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [item.rows[0].id, ...line],
        );
      }
    }

    if (errors.length) {
      throw validationError("Không thể tính lương vì thiếu dữ liệu", errors);
    }

    await client.query(
      `UPDATE payroll_cycles SET status = 'calculated', calculated_at = now(), updated_at = now()
       WHERE id = $1`,
      [cycleId],
    );
    await client.query(
      `INSERT INTO payroll_audit_logs (payroll_cycle_id, actor_user_id, action, previous_status, next_status)
       VALUES ($1, $2, 'calculate', $3, 'calculated')`,
      [cycleId, user.userId, cycle.status],
    );

    return { calculated: attendanceSummary.rows.length };
  });
}
