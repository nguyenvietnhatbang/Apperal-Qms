import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { afterAll, describe, expect, test } from "vitest";
import { AuditService } from "@/features/audit/services/audit-service";
import { PayrollCalculationService } from "@/features/payroll/services/payroll-calculation-service";
import { getDbPool, query } from "@/lib/db";

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
  return Number(String(value ?? "").replace(/[\s,]/g, "").replace(/[^0-9.-]/g, "")) || 0;
}

function sourcePayroll() {
  const rows = parse(fs.readFileSync(path.resolve("docs/Bangluong.csv")), {
    bom: true, relax_column_count: true, skip_empty_lines: false,
  }) as string[][];
  return new Map(rows.filter((row) => /^\d+$/.test(String(row[0] || "").trim())).map((row) => [
    String(row[1] || "").trim(),
    { overtime: toNumber(row[30]), gross: toNumber(row[45]), net: toNumber(row[51]) },
  ]));
}

describe("2026-06 raw check with audit", () => {
  afterAll(async () => getDbPool().end());

  test("calculates standard raw OT and audited OT after copying supplements", async () => {
    const cycle = await query<{ id: string; factory_id: string }>(
      `SELECT id, factory_id FROM payroll_cycles WHERE code = '2026-06-raw-check' LIMIT 1`
    ).then((rows) => rows[0]);
    expect(cycle).toBeTruthy();

    await PayrollCalculationService.calculateCyclePayroll(cycle.id, null as unknown as string, cycle.factory_id);
    const attendance = await AuditService.generateAuditAttendance(cycle.id, null as unknown as string, cycle.factory_id);
    const payroll = await AuditService.calculateAuditPayroll(cycle.id, null as unknown as string, cycle.factory_id);
    const source = sourcePayroll();

    async function summarize(tableName: "payroll_items" | "audit_payroll_items") {
      const rows = await query<Record<string, unknown>>(
        `SELECT employee_code, overtime_normal_hours, gross_income, net_salary FROM ${tableName} WHERE payroll_cycle_id = $1`,
        [cycle.id]
      );
      const compared = rows.map((row) => {
        const expected = source.get(String(row.employee_code));
        return {
          overtime: expected ? toNumber(row.overtime_normal_hours) - expected.overtime : 0,
          gross: expected ? toNumber(row.gross_income) - expected.gross : 0,
          net: expected ? toNumber(row.net_salary) - expected.net : 0,
        };
      });
      return {
        employees: rows.length,
        exactOt: compared.filter((row) => row.overtime === 0).length,
        exactMoney: compared.filter((row) => row.gross === 0 && row.net === 0).length,
      };
    }

    const standard = await summarize("payroll_items");
    const audit = await summarize("audit_payroll_items");
    console.table({ standard, audit, auditedAttendance: attendance, auditedPayroll: payroll });
    expect(standard.employees).toBe(57);
    expect(audit.employees).toBe(57);
  }, 60_000);
});
