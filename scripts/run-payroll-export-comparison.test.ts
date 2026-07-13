import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { afterAll, describe, expect, test } from "vitest";
import { getDbPool, query } from "@/lib/db";
import { PayrollExportService } from "@/features/payroll/services/payroll-export-service";

function loadEnvironment() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadEnvironment();

function cellText(value: unknown) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

describe("payroll Excel export follows Bangluong.csv", () => {
  afterAll(async () => getDbPool().end());

  test("standard and audit exports use the same 66 source columns", async () => {
    const cycle = await query<{ id: string; factory_id: string }>(
      `SELECT id, factory_id FROM payroll_cycles WHERE code = '2026-06' LIMIT 1`
    ).then((rows) => rows[0]);
    expect(cycle).toBeTruthy();

    const sourceRows = parse(fs.readFileSync(path.resolve("docs/Bangluong.csv")), {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: false,
    }) as string[][];
    const expectedMain = sourceRows[6].slice(0, 66).map(cellText);
    const expectedSub = sourceRows[7].slice(0, 66).map(cellText);

    for (const source of ["standard", "audit"] as const) {
      const tableName = source === "audit" ? "audit_payroll_items" : "payroll_items";
      const expectedItem = await query<Record<string, unknown>>(
        `SELECT employee_code, personal_leave_amount, holiday_days, actual_workdays,
                overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours,
                monthly_salary_amount, work_trip_support, overtime_normal_amount,
                overtime_sunday_amount, overtime_holiday_amount, paid_leave_amount, gross_income,
                employee_insurance_amount, union_fee_amount, personal_income_tax_amount, net_salary,
                excess_overtime_normal_hours, excess_overtime_sunday_hours, excess_overtime_holiday_hours,
                night_shift_hours, excess_overtime_normal_amount, excess_overtime_sunday_amount,
                excess_overtime_holiday_amount, night_shift_amount, pending_leave_advance
         FROM ${tableName} WHERE payroll_cycle_id = $1 ORDER BY employee_code LIMIT 1`,
        [cycle.id]
      ).then((rows) => rows[0]);
      expect(expectedItem).toBeTruthy();

      const exported = await PayrollExportService.exportPayrollWorkbook(cycle.id, source, cycle.factory_id);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exported.buffer as unknown as ExcelJS.Buffer);
      const worksheet = workbook.getWorksheet("2. BẢNG LƯƠNG");
      expect(worksheet).toBeTruthy();

      expect(exported.fileName).toBe("bang-luong-2026-06.xlsx");
      const actualMain = Array.from({ length: 66 }, (_, index) => cellText(worksheet!.getRow(2).getCell(index + 1).value));
      const actualSub = Array.from({ length: 66 }, (_, index) => cellText(worksheet!.getRow(3).getCell(index + 1).value));
      const differences = [
        ...expectedMain.flatMap((expected, index) => expected && actualMain[index] !== expected
          ? [{ row: 2, column: index + 1, expected, actual: actualMain[index] }]
          : []),
        ...expectedSub.flatMap((expected, index) => expected && actualSub[index] !== expected
          ? [{ row: 3, column: index + 1, expected, actual: actualSub[index] }]
          : []),
      ];
      expect(differences).toEqual([]);
      expect(cellText(worksheet!.getRow(1).getCell(1).value)).toBe("");
      expect(cellText(worksheet!.getRow(1).getCell(2).value)).toBe("1");
      expect(cellText(worksheet!.getRow(worksheet!.rowCount).getCell(2).value)).toBe("TỔNG CỘNG");
      expect(Array.from({ length: worksheet!.rowCount }, (_, index) => cellText(worksheet!.getRow(index + 1).getCell(2).value)))
        .not.toContain("CHƯA PHÂN LOẠI");

      let employeeRow: ExcelJS.Row | undefined;
      worksheet!.eachRow((row) => {
        if (cellText(row.getCell(2).value) === expectedItem.employee_code) employeeRow = row;
      });
      expect(employeeRow).toBeTruthy();
      const valueMapping: Array<[number, string]> = [
        [28, "personal_leave_amount"], [29, "holiday_days"], [30, "actual_workdays"],
        [31, "overtime_normal_hours"], [32, "overtime_sunday_hours"], [33, "overtime_holiday_hours"],
        [38, "monthly_salary_amount"], [39, "work_trip_support"],
        [42, "overtime_normal_amount"], [43, "overtime_sunday_amount"], [44, "overtime_holiday_amount"],
        [45, "paid_leave_amount"], [46, "gross_income"], [47, "employee_insurance_amount"],
        [48, "union_fee_amount"], [51, "personal_income_tax_amount"], [52, "net_salary"],
        [57, "excess_overtime_normal_hours"], [58, "excess_overtime_sunday_hours"],
        [59, "excess_overtime_holiday_hours"], [60, "night_shift_hours"],
        [61, "excess_overtime_normal_amount"], [62, "excess_overtime_sunday_amount"],
        [63, "excess_overtime_holiday_amount"], [64, "night_shift_amount"], [66, "pending_leave_advance"],
      ];
      valueMapping.forEach(([excelColumn, databaseColumn]) => {
        expect(Number(employeeRow!.getCell(excelColumn).value || 0), `${source}: ${databaseColumn}`)
          .toBe(Number(expectedItem[databaseColumn] || 0));
      });
    }
  }, 60_000);
});
