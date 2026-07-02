import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { query, queryOne } from "@/lib/db";

type PayrollExportSource = "standard" | "audit";

function toNumber(value: unknown) {
  return Number.parseFloat(String(value || 0)) || 0;
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function getSnapshotValue(snapshot: unknown, key: string) {
  if (!snapshot || typeof snapshot !== "object") return 0;
  return toNumber((snapshot as Record<string, unknown>)[key]);
}

function getRuleValue(snapshot: unknown, key: string) {
  if (!snapshot || typeof snapshot !== "object") return 0;
  return toNumber((snapshot as Record<string, unknown>)[key]);
}

function readTemplateHeaderRows() {
  const templatePath = path.join(process.cwd(), "docs", "bangluong.csv");
  const fallback = [
    ["", ...Array.from({ length: 61 }, (_, index) => String(index + 1))],
    ["STT", "Mã nhân viên", "HỌ & TÊN", "Giới tính", "", "Chức Danh", "Ngày gia nhập\nCty"],
    ["", "", "", "Nam", "Nữ", "", ""],
  ];

  if (!fs.existsSync(templatePath)) return fallback;

  return fs
    .readFileSync(templatePath, "utf8")
    .split(/\r?\n/)
    .slice(0, 3)
    .map((line) => line.split("\t"));
}

function toRoman(value: number) {
  const romans: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let result = "";
  let remaining = value;
  for (const [decimal, roman] of romans) {
    while (remaining >= decimal) {
      result += roman;
      remaining -= decimal;
    }
  }
  return result;
}

function buildPayrollRow(row: any, index: number) {
  const salary = row.salaryConfigSnapshot || {};
  const rules = row.ruleSnapshot || {};
  const insuranceSalary = getSnapshotValue(salary, "insuranceSalary");
  const baseSalary = getSnapshotValue(salary, "baseSalary");
  const companySocialRate = getRuleValue(rules, "company_social_insurance_rate") || 0.175;
  const companyHealthRate = getRuleValue(rules, "company_health_insurance_rate") || 0.03;
  const companyUnemploymentRate = getRuleValue(rules, "company_unemployment_insurance_rate") || 0.01;
  const companyUnionRate = getRuleValue(rules, "company_union_rate") || 0.02;
  const grossIncome = toNumber(row.grossIncome);
  const employeeInsurance = toNumber(row.employeeInsuranceAmount);
  const unionFee = toNumber(row.unionFeeAmount);
  const pit = toNumber(row.personalIncomeTaxAmount);
  const dependentCount = toNumber(row.dependentCount);
  const taxableIncome = Math.max(0, grossIncome - employeeInsurance - unionFee - 11000000 - dependentCount * 4400000);
  const isFemale = String(row.gender || "").toLowerCase().includes("nữ") || String(row.gender || "").toLowerCase().includes("female");

  const values = [
    index + 1,
    row.employeeCode,
    row.employeeName,
    isFemale ? "" : "x",
    isFemale ? "x" : "",
    row.positionTitle || "",
    formatDate(row.joinedDate),
    getSnapshotValue(salary, "totalSalary"),
    insuranceSalary,
    baseSalary,
    getSnapshotValue(salary, "positionAllowance"),
    getSnapshotValue(salary, "responsibilityAllowance"),
    getSnapshotValue(salary, "seniorityAllowance"),
    getSnapshotValue(salary, "safetyAllowance"),
    getSnapshotValue(salary, "phoneAllowance"),
    getSnapshotValue(salary, "otherBonus"),
    0,
    0,
    getSnapshotValue(salary, "travelAllowance"),
    getSnapshotValue(salary, "housingAllowance"),
    getSnapshotValue(salary, "attendanceBonus"),
    toNumber(row.paidLeaveDays) + toNumber(row.holidayDays),
    toNumber(row.paidLeaveDays),
    0,
    0,
    0,
    toNumber(row.unpaidLeaveDays),
    toNumber(row.holidayDays),
    toNumber(row.actualWorkdays),
    toNumber(row.overtimeNormalHours),
    toNumber(row.overtimeSundayHours),
    toNumber(row.overtimeHolidayHours),
    Math.round(insuranceSalary * companySocialRate),
    Math.round(insuranceSalary * companyHealthRate),
    Math.round(insuranceSalary * companyUnemploymentRate),
    Math.round(insuranceSalary * companyUnionRate),
    toNumber(row.monthlySalaryAmount),
    0,
    0,
    0,
    toNumber(row.overtimeNormalAmount),
    toNumber(row.overtimeSundayAmount),
    toNumber(row.overtimeHolidayAmount),
    toNumber(row.paidLeaveAmount),
    grossIncome,
    employeeInsurance,
    unionFee,
    dependentCount,
    taxableIncome,
    pit,
    toNumber(row.netSalary),
    toNumber(row.advancePayment1),
    toNumber(row.advancePayment2),
    toNumber(row.secondPaymentAmount),
    "",
    0,
    toNumber(row.overtimeSundayHours),
    toNumber(row.overtimeHolidayHours),
    0,
    toNumber(row.overtimeSundayAmount) + toNumber(row.overtimeHolidayAmount),
    0,
    toNumber(row.secondPaymentAmount),
  ];

  return values.slice(0, 62);
}

function buildDepartmentSummaryRow(departmentName: string, employeeRows: unknown[][], groupIndex: number) {
  const summary: unknown[] = Array.from({ length: 62 }, () => "");
  summary[0] = toRoman(groupIndex + 1);
  summary[1] = departmentName.toUpperCase();

  for (let columnIndex = 7; columnIndex < 62; columnIndex++) {
    const total = employeeRows.reduce((sum, row) => sum + toNumber(row[columnIndex]), 0);
    if (total !== 0) summary[columnIndex] = total;
  }

  return summary;
}

function buildGroupedPayrollRows(rows: any[]) {
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const departmentName = String(row.departmentName || "CHƯA PHÂN LOẠI").trim() || "CHƯA PHÂN LOẠI";
    const existingRows = grouped.get(departmentName) || [];
    existingRows.push(row);
    grouped.set(departmentName, existingRows);
  }

  const result: unknown[][] = [];
  let employeeIndex = 0;
  Array.from(grouped.entries()).forEach(([departmentName, departmentRows], groupIndex) => {
    const employeeRows = departmentRows.map((row) => buildPayrollRow(row, employeeIndex++));
    result.push(buildDepartmentSummaryRow(departmentName, employeeRows, groupIndex));
    result.push(...employeeRows);
  });

  return result;
}

export class PayrollExportService {
  static async exportPayrollWorkbook(cycleId: string, source: PayrollExportSource) {
    const cycle = await queryOne(
      `SELECT code, name, period_start as "periodStart", period_end as "periodEnd"
       FROM payroll_cycles
       WHERE id = $1`,
      [cycleId]
    );

    if (!cycle) throw new Error("Không tìm thấy chu kỳ lương.");

    const tableName = source === "audit" ? "audit_payroll_items" : "payroll_items";
    const rows = await query(
      `SELECT p.id, p.employee_id as "employeeId", p.employee_code as "employeeCode", p.employee_name as "employeeName",
              p.salary_config_snapshot as "salaryConfigSnapshot", p.rule_snapshot as "ruleSnapshot",
              p.actual_workdays as "actualWorkdays", p.paid_leave_days as "paidLeaveDays",
              p.holiday_days as "holidayDays", p.unpaid_leave_days as "unpaidLeaveDays",
              p.overtime_normal_hours as "overtimeNormalHours", p.overtime_sunday_hours as "overtimeSundayHours",
              p.overtime_holiday_hours as "overtimeHolidayHours", p.monthly_salary_amount as "monthlySalaryAmount",
              p.paid_leave_amount as "paidLeaveAmount", p.overtime_normal_amount as "overtimeNormalAmount",
              p.overtime_sunday_amount as "overtimeSundayAmount", p.overtime_holiday_amount as "overtimeHolidayAmount",
              p.allowance_amount as "allowanceAmount", p.gross_income as "grossIncome",
              p.employee_insurance_amount as "employeeInsuranceAmount", p.union_fee_amount as "unionFeeAmount",
              p.personal_income_tax_amount as "personalIncomeTaxAmount", p.advance_payment_1 as "advancePayment1",
              p.advance_payment_2 as "advancePayment2", p.total_deduction as "totalDeduction",
              p.net_salary as "netSalary", p.second_payment_amount as "secondPaymentAmount",
              e.gender, e.department_name as "departmentName", e.position_title as "positionTitle",
              e.joined_date as "joinedDate", e.dependent_count as "dependentCount"
       FROM ${tableName} p
       LEFT JOIN employees e ON e.id = p.employee_id
       WHERE p.payroll_cycle_id = $1
       ORDER BY e.department_name ASC NULLS LAST, p.employee_code ASC`,
      [cycleId]
    );

    const headerRows = readTemplateHeaderRows();
    const dataRows = buildGroupedPayrollRows(rows);
    const worksheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 26 },
      ...Array.from({ length: 59 }, () => ({ wch: 14 })),
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bang luong");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return {
      buffer,
      fileName: `bang-luong-${source === "audit" ? "audit-" : ""}${cycle.code}.xlsx`,
    };
  }
}
