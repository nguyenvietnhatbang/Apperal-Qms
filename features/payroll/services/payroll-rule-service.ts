import { z } from "zod";
import { query } from "@/lib/db";
import { notFoundError } from "@/lib/errors";
import { parsePagination, parseSort } from "@/lib/pagination";
import { payrollRuleSchema } from "@/features/payroll/types/payroll-types";

const ruleSort = {
  code: "code",
  name: "name",
  createdAt: "created_at",
};

function mapRule(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    value: row.value,
    unit: row.unit,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPayrollRules(searchParams: URLSearchParams) {
  const { page, limit, offset } = parsePagination(searchParams);
  const { column, direction } = parseSort(searchParams, ruleSort, "code");
  const search = `%${(searchParams.get("search") ?? "").trim()}%`;
  const filterParams: unknown[] = [search];
  const filters = ["($1 = '%%' OR code ILIKE $1 OR name ILIKE $1)"];
  const active = searchParams.get("active");

  if (active === "true" || active === "false") {
    filterParams.push(active === "true");
    filters.push(`is_active = $${filterParams.length}`);
  }

  const where = filters.join(" AND ");
  const rowParams = [...filterParams, limit, offset];
  const limitIndex = filterParams.length + 1;
  const offsetIndex = filterParams.length + 2;
  const [rows, count] = await Promise.all([
    query(
      `SELECT id, code, name, value, unit, description, is_active, created_at, updated_at
       FROM payroll_rules
       WHERE ${where}
       ORDER BY ${column} ${direction}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      rowParams,
    ),
    query<{ total: string }>(`SELECT count(*)::text AS total FROM payroll_rules WHERE ${where}`, filterParams),
  ]);
  return {
    data: rows.rows.map(mapRule),
    pagination: { page, limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function createPayrollRule(input: z.infer<typeof payrollRuleSchema>) {
  const result = await query(
    `INSERT INTO payroll_rules (code, name, value, unit, description, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.code, input.name, input.value, input.unit, input.description ?? null, input.isActive],
  );
  return mapRule(result.rows[0]);
}

export async function updatePayrollRule(id: string, input: z.infer<typeof payrollRuleSchema>) {
  const result = await query(
    `UPDATE payroll_rules
     SET code = $2, name = $3, value = $4, unit = $5, description = $6, is_active = $7, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, input.code, input.name, input.value, input.unit, input.description ?? null, input.isActive],
  );
  const row = result.rows[0];
  if (!row) throw notFoundError("Không tìm thấy quy tắc lương");
  return mapRule(row);
}

export async function getActiveRuleSnapshot() {
  const result = await query<{ code: string; value: string }>(
    `SELECT code, value FROM payroll_rules WHERE is_active = true`,
  );
  return Object.fromEntries(result.rows.map((row) => [row.code, Number(row.value)]));
}
