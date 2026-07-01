import { describe, expect, it } from "vitest";
import { calculatePayrollAmounts } from "@/features/payroll/services/payroll-calculation-service";

describe("payroll calculation", () => {
  it("calculates baseline salary amounts", () => {
    const result = calculatePayrollAmounts({
      totalSalary: 26_000_000,
      insuranceSalary: 10_000_000,
      standardWorkdays: 26,
      standardHoursPerDay: 8,
      paidWorkdays: 20,
      paidLeaveDays: 0,
      holidayDays: 0,
      overtimeNormalHours: 8,
      overtimeSundayHours: 0,
      overtimeHolidayHours: 0,
      allowanceAmount: 1_000_000,
      rules: {
        overtime_normal_rate: 1.5,
        overtime_sunday_rate: 2,
        overtime_holiday_rate: 3,
        employee_insurance_rate: 0.105,
        employee_union_rate: 0.01,
        company_social_insurance_rate: 0.175,
        company_health_insurance_rate: 0.03,
        company_unemployment_insurance_rate: 0.01,
        company_union_rate: 0.02,
      },
    });

    expect(result.monthlySalaryAmount).toBe(20_000_000);
    expect(result.overtimeNormalAmount).toBe(1_500_000);
    expect(result.employeeInsuranceAmount).toBe(1_050_000);
    expect(result.unionFeeAmount).toBe(100_000);
    expect(result.netSalary).toBe(21_350_000);
  });
});
