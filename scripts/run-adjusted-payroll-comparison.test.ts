import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { parse } from "csv-parse/sync";
import { getDbPool, query } from "@/lib/db";
import { PayrollCalculationService } from "@/features/payroll/services/payroll-calculation-service";

function loadEnvironment() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadEnvironment();

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[\s,₫đĐ]/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceByEmployeeCode() {
  const rows = parse(fs.readFileSync(path.resolve("docs/Bangluong.csv")), {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
  return new Map(rows.filter((row) => /^\d+$/.test(String(row[0] || "").trim())).map((row) => [
    String(row[1] || "").trim(),
    {
      employeeName: String(row[2] || "").trim(),
      actualWorkdays: toNumber(row[29]),
      overtimeNormalHours: toNumber(row[30]),
      overtimeSundayHours: toNumber(row[31]),
      overtimeHolidayHours: toNumber(row[32]),
      grossIncome: toNumber(row[45]),
      netSalary: toNumber(row[51]),
    },
  ]));
}

const run = process.env.RUN_ADJUSTED_PAYROLL_COMPARISON === "1" ? test : test.skip;

describe("adjusted payroll comparison", () => {
  afterAll(async () => getDbPool().end());

  run("calculates the attendance-backed employees and compares money with Bangluong.csv", async () => {
    const cycle = await query<{ id: string; factory_id: string }>(
      `SELECT id, factory_id FROM payroll_cycles WHERE code = '2026-06' LIMIT 1`
    ).then((rows) => rows[0]);
    expect(cycle).toBeTruthy();

    await PayrollCalculationService.calculateCyclePayroll(cycle.id, null as unknown as string, cycle.factory_id);
    const computed = await query<Record<string, unknown>>(
      `SELECT employee_code, employee_name, actual_workdays, paid_leave_days, unpaid_leave_days,
              overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours,
              monthly_salary_amount, paid_leave_amount, allowance_amount, gross_income,
              employee_insurance_amount, union_fee_amount, personal_income_tax_amount,
              total_deduction, net_salary
       FROM payroll_items WHERE payroll_cycle_id = $1 ORDER BY employee_code`,
      [cycle.id]
    );
    const source = sourceByEmployeeCode();
    const comparisons = computed.map((item) => {
      const expected = source.get(String(item.employee_code));
      if (!expected) throw new Error(`Không có nhân viên ${item.employee_code} trong Bangluong.csv.`);
      return {
        employeeCode: item.employee_code,
        employeeName: item.employee_name,
        grossDifference: toNumber(item.gross_income) - expected.grossIncome,
        netDifference: toNumber(item.net_salary) - expected.netSalary,
        workdaysDifference: toNumber(item.actual_workdays) - expected.actualWorkdays,
        overtimeDifference:
          toNumber(item.overtime_normal_hours) + toNumber(item.overtime_sunday_hours) + toNumber(item.overtime_holiday_hours) -
          expected.overtimeNormalHours - expected.overtimeSundayHours - expected.overtimeHolidayHours,
      };
    });
    const exactMoney = comparisons.filter((row) => row.grossDifference === 0 && row.netDifference === 0);
    const maxGross = comparisons.toSorted((a, b) => Math.abs(b.grossDifference) - Math.abs(a.grossDifference)).slice(0, 10);
    const maxNet = comparisons.toSorted((a, b) => Math.abs(b.netDifference) - Math.abs(a.netDifference)).slice(0, 10);

    console.log("\nĐối chiếu sau bổ sung lương");
    console.table({ employees: computed.length, exactMoney: exactMoney.length });
    console.log("\nLệch tổng thu nhập lớn nhất");
    console.table(maxGross);
    console.log("\nLệch lương thực nhận lớn nhất");
    console.table(maxNet);

    expect(computed).toHaveLength(57);
    expect(comparisons.every((row) => row.workdaysDifference === 0 && row.overtimeDifference === 0)).toBe(true);
  }, 60_000);
});
