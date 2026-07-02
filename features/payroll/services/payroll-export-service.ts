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

function createEmptyRow() {
  return Array.from({ length: 62 }, () => "") as unknown[];
}

function getPayrollTitle(cycle: any) {
  const periodStart = new Date(String(cycle.periodStart));
  if (!Number.isNaN(periodStart.getTime())) {
    const month = String(periodStart.getUTCMonth() + 1).padStart(2, "0");
    return `BẢNG LƯƠNG THÁNG ${month}/${periodStart.getUTCFullYear()}`;
  }

  return `BẢNG LƯƠNG ${String(cycle.name || cycle.code || "").toUpperCase()}`;
}

function buildTemplateRows(cycle: any) {
  const rows = Array.from({ length: 8 }, () => createEmptyRow());

  rows[0][1] = "CÔNG TY TNHH TM MTV CẨM THIÊN";
  rows[1][1] = "Địa chỉ: Tổ 11, KP. Bình Ý, Phường Tân Triều, tỉnh Đồng Nai.";
  rows[1][39] = 973500;
  rows[2][11] = toNumber(cycle.standardWorkdays) || 26;
  rows[3][1] = getPayrollTitle(cycle);
  rows[4][18] = 25000;
  rows[5] = ["", ...Array.from({ length: 61 }, (_, index) => index + 1)];

  const mainHeader = rows[6];
  const subHeader = rows[7];

  mainHeader[0] = "STT";
  mainHeader[1] = "Mã nhân viên";
  mainHeader[2] = "HỌ & TÊN";
  mainHeader[3] = "Giới tính";
  subHeader[3] = "Nam";
  subHeader[4] = "Nữ";
  mainHeader[5] = "Chức Danh";
  mainHeader[6] = "Ngày gia nhập\nCty";
  mainHeader[7] = "Tổng lương";
  mainHeader[8] = "Lương đóng BH";
  mainHeader[9] = "Lương cơ bản";

  mainHeader[10] = "Các khoản phụ cấp";
  subHeader[10] = "Chức danh";
  subHeader[11] = "Trách nhiệm";
  subHeader[12] = "Thâm niên";
  subHeader[13] = "An toàn VSSV";

  mainHeader[14] = "Các khoản thưởng và hỗ trợ";
  subHeader[14] = "Điện thoại";
  subHeader[15] = "PC khác\n( Thưởng)";
  subHeader[16] = "Thưởng tuân thủ";
  subHeader[17] = "Công tác";
  subHeader[18] = "Đi lại\n(Xăng xe)";
  subHeader[19] = "Nhà ở";
  subHeader[20] = "Chuyên cần";

  mainHeader[21] = "Tổng hợp phép năm";
  subHeader[21] = "Tổng ngày\nphép";
  subHeader[22] = "Phép sd trong\ntháng";
  subHeader[23] = "Số giờ PN";
  subHeader[24] = "Phép đã\nsd cộng dồn";
  subHeader[25] = "Phép\ncòn lại";
  subHeader[26] = "Nghỉ\nviệc riêng";

  mainHeader[27] = "Ngày Lễ";
  mainHeader[28] = "Tổng Ngày công làm việc";
  mainHeader[29] = "TỔNG TG T.CA";
  subHeader[29] = "Ngày thường";
  subHeader[30] = "ngày CN";
  subHeader[31] = "Ngày lễ tết";

  mainHeader[32] = "Các khoản Công ty trích đóng";
  subHeader[32] = "BHXH\n17.5% cty trả";
  subHeader[33] = "BHYT 3%\nCty trả";
  subHeader[34] = "BHTN 1%\nCty trả";
  subHeader[35] = "CÔNG ĐOÀN\n2%";

  mainHeader[36] = "Lương\ntháng ngày";
  mainHeader[37] = "Hỗ trợ";
  subHeader[37] = "Phụ cấp phí Ctác";
  subHeader[38] = "Ngày hành kinh PN/ 1,5h";
  subHeader[39] = "Con nhỏ\n < 6 tuổi";

  mainHeader[40] = "Tiền tăng ca";
  subHeader[40] = "Tăng ca ngày thường 150%";
  subHeader[41] = "Tăng ca CN 200%";
  subHeader[42] = "Tăng ca ngày lễ 300%";

  mainHeader[43] = "Lương Phép, Lễ";
  mainHeader[44] = "Tổng thu nhập";
  mainHeader[45] = "Các khoản khấu trừ lương";
  subHeader[45] = "Khấu trừ BHXH 10,5%";
  subHeader[46] = "Đoàn phí";
  subHeader[47] = "Số người PT";
  subHeader[48] = "Thu nhập chịu thuế";
  subHeader[49] = "Thuế TNCN";

  mainHeader[50] = "Lương thực nhận";
  mainHeader[51] = "Lương ứng đợt 1";
  mainHeader[52] = "Lương ứng đợt 2";
  mainHeader[53] = "Tiền lương còn lại";
  mainHeader[54] = "Chữ ký Nhân Viên";
  mainHeader[55] = "Số giờ OT thường vượt";
  mainHeader[56] = "Sồ giờ OT chủ nhật";
  mainHeader[57] = "Số giờ OT lễ";
  mainHeader[58] = "Làm đêm";
  mainHeader[59] = "Lương OT vượt bao gồm CN và Lễ";
  mainHeader[60] = "Lương làm đêm";
  mainHeader[61] = "Tổng chi lần 2";

  return rows;
}

function getWorksheetMerges() {
  const merge = (s: string, e: string) => ({ s: XLSX.utils.decode_cell(s), e: XLSX.utils.decode_cell(e) });

  return [
    merge("B4", "BJ4"),
    merge("D7", "E7"),
    merge("K7", "N7"),
    merge("O7", "U7"),
    merge("V7", "AA7"),
    merge("AD7", "AF7"),
    merge("AG7", "AJ7"),
    merge("AL7", "AN7"),
    merge("AO7", "AQ7"),
    merge("AT7", "AX7"),
    ...[
      "A",
      "B",
      "C",
      "F",
      "G",
      "H",
      "I",
      "J",
      "AB",
      "AC",
      "AK",
      "AR",
      "AS",
      "AY",
      "AZ",
      "BA",
      "BB",
      "BC",
      "BD",
      "BE",
      "BF",
      "BG",
      "BH",
      "BI",
      "BJ",
    ].map((column) => merge(`${column}7`, `${column}8`)),
  ];
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
      `SELECT code, name, period_start as "periodStart", period_end as "periodEnd",
              standard_workdays as "standardWorkdays"
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

    const headerRows = buildTemplateRows(cycle);
    const dataRows = buildGroupedPayrollRows(rows);
    const worksheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);

    worksheet["!merges"] = getWorksheetMerges();
    worksheet["!rows"] = [
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 28 },
      { hpt: 20 },
      { hpt: 18 },
      { hpt: 42 },
      { hpt: 52 },
    ];
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
