import { z } from "zod";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { notFoundError } from "@/lib/errors";
import { parsePagination, parseSort } from "@/lib/pagination";
import { userCreateSchema, userUpdateSchema } from "@/features/admin/types/admin-types";

const userSort = {
  username: "u.username",
  displayName: "u.display_name",
  lastLogin: "u.last_login_at",
  createdAt: "u.created_at",
};

function mapUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    departmentId: row.department_id,
    departmentName: row.department_name,
    status: row.status,
    isAdmin: row.is_admin,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

export async function listUsers(searchParams: URLSearchParams) {
  const { page, limit, offset } = parsePagination(searchParams);
  const { column, direction } = parseSort(searchParams, userSort, "username");
  const filterParams: unknown[] = [`%${(searchParams.get("search") ?? "").trim()}%`];
  const filters = [
    "u.deleted_at IS NULL",
    "($1 = '%%' OR u.username ILIKE $1 OR u.display_name ILIKE $1 OR u.email ILIKE $1)",
  ];
  const status = searchParams.get("status");
  const departmentId = searchParams.get("departmentId");

  if (status && ["active", "inactive", "locked"].includes(status)) {
    filterParams.push(status);
    filters.push(`u.status = $${filterParams.length}`);
  }

  if (departmentId) {
    filterParams.push(departmentId);
    filters.push(`u.department_id = $${filterParams.length}`);
  }

  const where = filters.join(" AND ");
  const rowParams = [...filterParams, limit, offset];
  const limitIndex = filterParams.length + 1;
  const offsetIndex = filterParams.length + 2;
  const [rows, count] = await Promise.all([
    query(
      `SELECT u.id, u.username, u.display_name, u.email, u.department_id, d.name AS department_name,
        u.status, u.is_admin, u.last_login_at, u.created_at
       FROM app_users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE ${where}
       ORDER BY ${column} ${direction}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      rowParams,
    ),
    query<{ total: string }>(
      `SELECT count(*)::text AS total
       FROM app_users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE ${where}`,
      filterParams,
    ),
  ]);

  return {
    data: rows.rows.map(mapUser),
    pagination: { page, limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function getUser(id: string) {
  const result = await query(
    `SELECT u.id, u.username, u.display_name, u.email, u.department_id, d.name AS department_name,
      u.status, u.is_admin, u.last_login_at, u.created_at
     FROM app_users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw notFoundError("Không tìm thấy user");
  return mapUser(row);
}

export async function createUser(input: z.infer<typeof userCreateSchema>) {
  const passwordHash = await hashPassword(input.password);
  const result = await query(
    `INSERT INTO app_users (username, display_name, email, department_id, password_hash, status, is_admin)
     VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7)
     RETURNING id`,
    [
      input.username.trim(),
      input.displayName.trim(),
      input.email || null,
      input.departmentId || null,
      passwordHash,
      input.status,
      input.isAdmin,
    ],
  );
  return getUser(result.rows[0].id as string);
}

export async function updateUser(id: string, input: z.infer<typeof userUpdateSchema>) {
  const fields: string[] = [];
  const params: unknown[] = [id];

  const add = (sql: string, value: unknown) => {
    params.push(value);
    fields.push(`${sql} = $${params.length}`);
  };

  if (input.username !== undefined) add("username", input.username.trim());
  if (input.displayName !== undefined) add("display_name", input.displayName.trim());
  if (input.email !== undefined) add("email", input.email || null);
  if (input.departmentId !== undefined) add("department_id", input.departmentId || null);
  if (input.status !== undefined) add("status", input.status);
  if (input.isAdmin !== undefined) add("is_admin", input.isAdmin);
  if (input.password) add("password_hash", await hashPassword(input.password));

  if (fields.length) {
    const result = await query(
      `UPDATE app_users SET ${fields.join(", ")}, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      params,
    );
    if (!result.rowCount) throw notFoundError("Không tìm thấy user");
  }

  return getUser(id);
}

export async function deleteUser(id: string) {
  const result = await query(
    `UPDATE app_users SET deleted_at = now(), status = 'inactive', updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (!result.rowCount) throw notFoundError("Không tìm thấy user");
}
