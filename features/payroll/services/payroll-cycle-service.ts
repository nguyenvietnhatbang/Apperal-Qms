import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import type { SessionUser } from "@/lib/auth-session";
import { forbiddenError, notFoundError, validationError } from "@/lib/errors";
import { parsePagination, parseSort } from "@/lib/pagination";
import {
  cycleStatusSchema,
  payrollCycleSchema,
  type PayrollCycleStatus,
} from "@/features/payroll/types/payroll-types";

const cycleSort = {
  code: "c.code",
  periodStart: "c.period_start",
  status: "c.status",
  createdAt: "c.created_at",
};

const allowedTransitions: Record<PayrollCycleStatus, PayrollCycleStatus[]> = {
  draft: ["imported", "cleaned", "cancelled"],
  imported: ["cleaned", "cancelled"],
  cleaned: ["calculated", "cancelled"],
  calculated: ["locked", "cancelled"],
  locked: ["calculated", "paid"],
  paid: [],
  cancelled: [],
};

function mapCycle(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    standardWorkdays: row.standard_workdays,
    standardHoursPerDay: row.standard_hours_per_day,
    status: row.status,
    calculatedAt: row.calculated_at,
    lockedAt: row.locked_at,
    paidAt: row.paid_at,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPayrollCycles(searchParams: URLSearchParams) {
  const { page, limit, offset } = parsePagination(searchParams);
  const { column, direction } = parseSort(searchParams, cycleSort, "periodStart");
  const search = `%${(searchParams.get("search") ?? "").trim()}%`;
  const filterParams: unknown[] = [search];
  const filters = ["($1 = '%%' OR c.code ILIKE $1 OR c.name ILIKE $1)"];
  const status = searchParams.get("status");
  if (status && cycleStatusSchema.shape.status.safeParse(status).success) {
    filterParams.push(status);
    filters.push(`c.status = $${filterParams.length}`);
  }
  const where = filters.join(" AND ");
  const rowParams = [...filterParams, limit, offset];
  const limitIndex = filterParams.length + 1;
  const offsetIndex = filterParams.length + 2;

  const [rows, count] = await Promise.all([
    query(
      `SELECT c.*
       FROM payroll_cycles c
       WHERE ${where}
       ORDER BY ${column} ${direction}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      rowParams,
    ),
    query<{ total: string }>(`SELECT count(*)::text AS total FROM payroll_cycles c WHERE ${where}`, filterParams),
  ]);
  return {
    data: rows.rows.map(mapCycle),
    pagination: { page, limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function getPayrollCycle(id: string) {
  const result = await query("SELECT * FROM payroll_cycles WHERE id = $1", [id]);
  const row = result.rows[0];
  if (!row) throw notFoundError("Không tìm thấy chu kỳ lương");
  return mapCycle(row);
}

export async function createPayrollCycle(input: z.infer<typeof payrollCycleSchema>, userId: string) {
  const result = await query(
    `INSERT INTO payroll_cycles (
      code, name, period_start, period_end, standard_workdays, standard_hours_per_day, note, created_by
    )
    VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8)
    RETURNING id`,
    [
      input.code,
      input.name,
      input.periodStart,
      input.periodEnd,
      input.standardWorkdays,
      input.standardHoursPerDay,
      input.note ?? null,
      userId,
    ],
  );
  return getPayrollCycle(result.rows[0].id as string);
}

export async function updatePayrollCycle(id: string, input: z.infer<typeof payrollCycleSchema>) {
  const current = await getPayrollCycle(id);
  if (!["draft", "imported"].includes(String(current.status))) {
    throw validationError("Chỉ được sửa chu kỳ ở trạng thái draft/imported");
  }
  const result = await query(
    `UPDATE payroll_cycles
     SET code = $2, name = $3, period_start = $4::date, period_end = $5::date,
      standard_workdays = $6, standard_hours_per_day = $7, note = $8, updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [
      id,
      input.code,
      input.name,
      input.periodStart,
      input.periodEnd,
      input.standardWorkdays,
      input.standardHoursPerDay,
      input.note ?? null,
    ],
  );
  if (!result.rowCount) throw notFoundError("Không tìm thấy chu kỳ lương");
  return getPayrollCycle(id);
}

export async function deletePayrollCycle(id: string, user: SessionUser) {
  await transitionPayrollCycle(id, "cancelled", user);
}

export async function transitionPayrollCycle(id: string, nextStatus: PayrollCycleStatus, user: SessionUser) {
  return withTransaction(async (client) => {
    const result = await client.query<{ status: PayrollCycleStatus }>(
      "SELECT status FROM payroll_cycles WHERE id = $1 FOR UPDATE",
      [id],
    );
    const currentStatus = result.rows[0]?.status;
    if (!currentStatus) throw notFoundError("Không tìm thấy chu kỳ lương");

    if (currentStatus === "locked" && nextStatus === "calculated" && !user.isAdmin) {
      const canApprove = user.permissions.some((p) => p.moduleCode === "payroll" && p.canApprove);
      if (!canApprove) throw forbiddenError("Chỉ admin hoặc người có quyền duyệt mới được mở khóa");
    }

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw validationError(`Không thể chuyển trạng thái ${currentStatus} sang ${nextStatus}`);
    }

    await client.query(
      `UPDATE payroll_cycles
       SET status = $2,
        calculated_at = CASE WHEN $2 = 'calculated' THEN COALESCE(calculated_at, now()) ELSE calculated_at END,
        locked_at = CASE WHEN $2 = 'locked' THEN now() WHEN $1::uuid IS NOT NULL AND $2 = 'calculated' THEN NULL ELSE locked_at END,
        paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE paid_at END,
        updated_at = now()
       WHERE id = $1`,
      [id, nextStatus],
    );
    await client.query(
      `INSERT INTO payroll_audit_logs (payroll_cycle_id, actor_user_id, action, previous_status, next_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, user.userId, `status:${nextStatus}`, currentStatus, nextStatus],
    );
    return getPayrollCycle(id);
  });
}

export { mapCycle };
