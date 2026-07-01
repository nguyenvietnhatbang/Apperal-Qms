import { z } from "zod";
import { query } from "@/lib/db";
import { notFoundError } from "@/lib/errors";
import { parsePagination, parseSort } from "@/lib/pagination";
import { employeeSchema } from "@/features/employees/types/employee-types";

const employeeSort = {
  employeeCode: "e.employee_code",
  fullName: "e.full_name",
  departmentName: "e.department_name",
  joinedDate: "e.joined_date",
  createdAt: "e.created_at",
};

function mapEmployee(row: Record<string, unknown>) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    gender: row.gender,
    departmentName: row.department_name,
    positionTitle: row.position_title,
    joinedDate: row.joined_date,
    status: row.status,
    dependentCount: row.dependent_count,
    hasChildUnder6: row.has_child_under_6,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEmployees(searchParams: URLSearchParams) {
  const { page, limit, offset } = parsePagination(searchParams);
  const { column, direction } = parseSort(searchParams, employeeSort, "employeeCode");
  const filterParams: unknown[] = [`%${(searchParams.get("search") ?? "").trim()}%`];
  const filters = [
    "e.deleted_at IS NULL",
    "($1 = '%%' OR e.employee_code ILIKE $1 OR e.full_name ILIKE $1 OR e.department_name ILIKE $1)",
  ];
  const status = searchParams.get("status");
  const departmentName = searchParams.get("departmentName");

  if (status && ["active", "inactive", "terminated"].includes(status)) {
    filterParams.push(status);
    filters.push(`e.status = $${filterParams.length}`);
  }

  if (departmentName) {
    filterParams.push(departmentName);
    filters.push(`e.department_name = $${filterParams.length}`);
  }

  const where = filters.join(" AND ");
  const rowParams = [...filterParams, limit, offset];
  const limitIndex = filterParams.length + 1;
  const offsetIndex = filterParams.length + 2;
  const [rows, count] = await Promise.all([
    query(
      `SELECT e.id, e.employee_code, e.full_name, e.gender, e.department_name, e.position_title,
        e.joined_date, e.status, e.dependent_count, e.has_child_under_6, e.created_at, e.updated_at
       FROM employees e
       WHERE ${where}
       ORDER BY ${column} ${direction}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      rowParams,
    ),
    query<{ total: string }>(`SELECT count(*)::text AS total FROM employees e WHERE ${where}`, filterParams),
  ]);

  return {
    data: rows.rows.map(mapEmployee),
    pagination: { page, limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function getEmployee(id: string) {
  const result = await query(
    `SELECT e.id, e.employee_code, e.full_name, e.gender, e.department_name, e.position_title,
      e.joined_date, e.status, e.dependent_count, e.has_child_under_6, e.created_at, e.updated_at
     FROM employees e
     WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw notFoundError("Không tìm thấy nhân viên");
  return mapEmployee(row);
}

export async function createEmployee(input: z.infer<typeof employeeSchema>) {
  const result = await query(
    `INSERT INTO employees (
      employee_code, full_name, gender, department_name, position_title, joined_date,
      status, dependent_count, has_child_under_6
    )
    VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date, $7, $8, $9)
    RETURNING id`,
    [
      input.employeeCode.trim(),
      input.fullName.trim(),
      input.gender || null,
      input.departmentName || null,
      input.positionTitle || null,
      input.joinedDate || "",
      input.status,
      input.dependentCount,
      input.hasChildUnder6,
    ],
  );
  return getEmployee(result.rows[0].id as string);
}

export async function updateEmployee(id: string, input: z.infer<typeof employeeSchema>) {
  const result = await query(
    `UPDATE employees
     SET employee_code = $2, full_name = $3, gender = $4, department_name = $5,
      position_title = $6, joined_date = NULLIF($7, '')::date, status = $8,
      dependent_count = $9, has_child_under_6 = $10, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [
      id,
      input.employeeCode.trim(),
      input.fullName.trim(),
      input.gender || null,
      input.departmentName || null,
      input.positionTitle || null,
      input.joinedDate || "",
      input.status,
      input.dependentCount,
      input.hasChildUnder6,
    ],
  );
  if (!result.rowCount) throw notFoundError("Không tìm thấy nhân viên");
  return getEmployee(id);
}

export async function deleteEmployee(id: string) {
  const result = await query(
    `UPDATE employees SET deleted_at = now(), status = 'inactive', updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (!result.rowCount) throw notFoundError("Không tìm thấy nhân viên");
}
