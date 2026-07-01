import { query } from "@/lib/db";
import { parsePagination, parseSort } from "@/lib/pagination";

const itemSort = {
  employeeCode: "pi.employee_code",
  employeeName: "pi.employee_name",
  netSalary: "pi.net_salary",
  calculatedAt: "pi.calculated_at",
};

function mapPayrollItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    payrollCycleId: row.payroll_cycle_id,
    cycleCode: row.cycle_code,
    cycleName: row.cycle_name,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    actualWorkdays: row.actual_workdays,
    overtimeNormalHours: row.overtime_normal_hours,
    overtimeSundayHours: row.overtime_sunday_hours,
    overtimeHolidayHours: row.overtime_holiday_hours,
    allowanceAmount: row.allowance_amount,
    grossIncome: row.gross_income,
    employeeInsuranceAmount: row.employee_insurance_amount,
    unionFeeAmount: row.union_fee_amount,
    totalDeduction: row.total_deduction,
    netSalary: row.net_salary,
    secondPaymentAmount: row.second_payment_amount,
    calculatedAt: row.calculated_at,
  };
}

export async function listPayrollItems(searchParams: URLSearchParams) {
  const { page, limit, offset } = parsePagination(searchParams);
  const { column, direction } = parseSort(searchParams, itemSort, "employeeCode");
  const filterParams: unknown[] = [`%${(searchParams.get("search") ?? "").trim()}%`];
  const filters = [
    "($1 = '%%' OR pi.employee_code ILIKE $1 OR pi.employee_name ILIKE $1 OR pc.code ILIKE $1)",
  ];
  const cycleId = searchParams.get("cycleId");
  if (cycleId) {
    filterParams.push(cycleId);
    filters.push(`pi.payroll_cycle_id = $${filterParams.length}`);
  }
  const where = filters.join(" AND ");
  const rowParams = [...filterParams, limit, offset];
  const limitIndex = filterParams.length + 1;
  const offsetIndex = filterParams.length + 2;
  const [rows, count] = await Promise.all([
    query(
      `SELECT pi.*, pc.code AS cycle_code, pc.name AS cycle_name
       FROM payroll_items pi
       JOIN payroll_cycles pc ON pc.id = pi.payroll_cycle_id
       WHERE ${where}
       ORDER BY ${column} ${direction}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      rowParams,
    ),
    query<{ total: string }>(
      `SELECT count(*)::text AS total
       FROM payroll_items pi
       JOIN payroll_cycles pc ON pc.id = pi.payroll_cycle_id
       WHERE ${where}`,
      filterParams,
    ),
  ]);
  return {
    data: rows.rows.map(mapPayrollItem),
    pagination: { page, limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function getPayrollSlip(id: string) {
  const item = await query(
    `SELECT pi.*, pc.code AS cycle_code, pc.name AS cycle_name, pc.period_start, pc.period_end
     FROM payroll_items pi
     JOIN payroll_cycles pc ON pc.id = pi.payroll_cycle_id
     WHERE pi.id = $1`,
    [id],
  );
  if (!item.rows[0]) return null;
  const lines = await query(
    `SELECT line_code, line_name, quantity, rate, amount, line_type, sort_order
     FROM payroll_item_lines
     WHERE payroll_item_id = $1
     ORDER BY sort_order ASC`,
    [id],
  );
  return {
    ...mapPayrollItem(item.rows[0]),
    periodStart: item.rows[0].period_start,
    periodEnd: item.rows[0].period_end,
    salaryConfigSnapshot: item.rows[0].salary_config_snapshot,
    ruleSnapshot: item.rows[0].rule_snapshot,
    lines: lines.rows,
  };
}
