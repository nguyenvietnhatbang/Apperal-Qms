import type { PoolClient } from "pg";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { notFoundError } from "@/lib/errors";
import { parsePagination, parseSort } from "@/lib/pagination";
import { departmentSchema } from "@/features/admin/types/admin-types";

const departmentSort = {
  code: "d.code",
  name: "d.name",
  createdAt: "d.created_at",
};

function mapDepartment(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: row.description as string | null,
    isAdmin: Boolean(row.is_admin),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDepartments(searchParams: URLSearchParams) {
  const { page, limit, offset } = parsePagination(searchParams);
  const { column, direction } = parseSort(searchParams, departmentSort, "code");
  const search = `%${(searchParams.get("search") ?? "").trim()}%`;
  const status = searchParams.get("status");
  const filterParams: unknown[] = [search];
  const filters = [
    "d.deleted_at IS NULL",
    "($1 = '%%' OR d.code ILIKE $1 OR d.name ILIKE $1)",
  ];

  if (status === "active" || status === "inactive") {
    filterParams.push(status === "active");
    filters.push(`d.is_active = $${filterParams.length}`);
  }

  const where = filters.join(" AND ");
  const rowParams = [...filterParams, limit, offset];
  const limitIndex = filterParams.length + 1;
  const offsetIndex = filterParams.length + 2;
  const [rows, count] = await Promise.all([
    query(
      `SELECT d.id, d.code, d.name, d.description, d.is_admin, d.is_active, d.created_at, d.updated_at
       FROM departments d
       WHERE ${where}
       ORDER BY ${column} ${direction}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      rowParams,
    ),
    query<{ total: string }>(`SELECT count(*)::text AS total FROM departments d WHERE ${where}`, filterParams),
  ]);

  return {
    data: rows.rows.map(mapDepartment),
    pagination: { page, limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function listDepartmentOptions() {
  const result = await query(
    `SELECT id, code, name, is_admin, is_active
     FROM departments
     WHERE deleted_at IS NULL
     ORDER BY code ASC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    isAdmin: row.is_admin,
    isActive: row.is_active,
  }));
}

export async function getDepartment(id: string) {
  const result = await query(
    `SELECT d.id, d.code, d.name, d.description, d.is_admin, d.is_active, d.created_at, d.updated_at
     FROM departments d
     WHERE d.id = $1 AND d.deleted_at IS NULL`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw notFoundError("Không tìm thấy phòng ban");

  const permissions = await query(
    `SELECT m.id AS module_id, m.code AS module_code, m.name AS module_name,
      COALESCE(p.can_view, false) AS can_view,
      COALESCE(p.can_create, false) AS can_create,
      COALESCE(p.can_update, false) AS can_update,
      COALESCE(p.can_delete, false) AS can_delete,
      COALESCE(p.can_approve, false) AS can_approve
     FROM modules m
     LEFT JOIN department_module_permissions p
      ON p.module_id = m.id AND p.department_id = $1
     WHERE m.is_active = true
     ORDER BY m.sort_order ASC`,
    [id],
  );

  return {
    ...mapDepartment(row),
    permissions: permissions.rows.map((permission) => ({
      moduleId: permission.module_id,
      moduleCode: permission.module_code,
      moduleName: permission.module_name,
      canView: permission.can_view,
      canCreate: permission.can_create,
      canUpdate: permission.can_update,
      canDelete: permission.can_delete,
      canApprove: permission.can_approve,
    })),
  };
}

async function savePermissions(
  client: PoolClient,
  departmentId: string,
  permissions: z.infer<typeof departmentSchema>["permissions"],
) {
  if (!permissions) return;

  for (const permission of permissions) {
    await client.query(
      `INSERT INTO department_module_permissions (
        department_id, module_id, can_view, can_create, can_update, can_delete, can_approve
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (department_id, module_id) DO UPDATE
      SET can_view = EXCLUDED.can_view,
          can_create = EXCLUDED.can_create,
          can_update = EXCLUDED.can_update,
          can_delete = EXCLUDED.can_delete,
          can_approve = EXCLUDED.can_approve,
          updated_at = now()`,
      [
        departmentId,
        permission.moduleId,
        permission.canView,
        permission.canCreate,
        permission.canUpdate,
        permission.canDelete,
        permission.canApprove,
      ],
    );
  }
}

export async function createDepartment(input: z.infer<typeof departmentSchema>) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO departments (code, name, description, is_admin, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [input.code, input.name, input.description ?? null, input.isAdmin, input.isActive],
    );
    const id = result.rows[0].id as string;
    await savePermissions(client, id, input.permissions);
    return getDepartment(id);
  });
}

export async function updateDepartment(id: string, input: z.infer<typeof departmentSchema>) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE departments
       SET code = $2, name = $3, description = $4, is_admin = $5, is_active = $6, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, input.code, input.name, input.description ?? null, input.isAdmin, input.isActive],
    );
    if (!result.rowCount) throw notFoundError("Không tìm thấy phòng ban");
    await savePermissions(client, id, input.permissions);
    return getDepartment(id);
  });
}

export async function deleteDepartment(id: string) {
  const result = await query(
    `UPDATE departments SET deleted_at = now(), is_active = false, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (!result.rowCount) throw notFoundError("Không tìm thấy phòng ban");
}
