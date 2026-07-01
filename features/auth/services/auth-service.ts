import { withTransaction, query } from "@/lib/db";
import { createSession } from "@/lib/auth-session";
import { verifyPassword } from "@/lib/password";
import { validationError, unauthorizedError } from "@/lib/errors";

export async function login(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername || !password) {
    throw validationError("Vui lòng nhập username và password");
  }

  return withTransaction(async (client) => {
    const result = await client.query<{
      id: string;
      username: string;
      display_name: string;
      password_hash: string;
      status: string;
    }>(
      `SELECT id, username, display_name, password_hash, status
       FROM app_users
       WHERE lower(username) = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [normalizedUsername],
    );

    const user = result.rows[0];
    if (!user || user.status !== "active") {
      throw unauthorizedError("Username hoặc password không đúng");
    }

    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      throw unauthorizedError("Username hoặc password không đúng");
    }

    await client.query("UPDATE app_users SET last_login_at = now(), updated_at = now() WHERE id = $1", [
      user.id,
    ]);
    await createSession(client, user.id);

    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
    };
  });
}

export async function getActiveModulesForUser(userId: string) {
  const result = await query<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    route_path: string;
    sort_order: number;
  }>(
    `WITH user_context AS (
      SELECT u.id, u.department_id, (u.is_admin OR COALESCE(d.is_admin, false)) AS is_admin
      FROM app_users u
      LEFT JOIN departments d ON d.id = u.department_id AND d.deleted_at IS NULL
      WHERE u.id = $1 AND u.deleted_at IS NULL AND u.status = 'active'
    )
    SELECT m.id, m.code, m.name, m.description, m.route_path, m.sort_order
    FROM modules m
    CROSS JOIN user_context uc
    LEFT JOIN department_module_permissions p
      ON p.module_id = m.id AND p.department_id = uc.department_id
    WHERE m.is_active = true
      AND (uc.is_admin OR p.can_view = true)
    ORDER BY m.sort_order ASC, m.name ASC`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    routePath: row.route_path,
    sortOrder: row.sort_order,
  }));
}
