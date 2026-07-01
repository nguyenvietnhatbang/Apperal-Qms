import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import type { PoolClient } from "pg";
import { cache } from "react";
import { query } from "@/lib/db";
import { forbiddenError, unauthorizedError } from "@/lib/errors";

export const SESSION_COOKIE_NAME = "app_session";
const SESSION_DAYS = 7;

export type ModulePermission = {
  moduleCode: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
};

export type SessionUser = {
  userId: string;
  username: string;
  displayName: string;
  email: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isAdmin: boolean;
  permissions: ModulePermission[];
};

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function setSessionCookie(token: string, expires: Date) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

async function readSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getRequestMeta() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    userAgent: headerStore.get("user-agent"),
    ipAddress: forwardedFor || headerStore.get("x-real-ip"),
  };
}

export async function createSession(client: PoolClient, userId: string) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expires = sessionExpiresAt();
  const meta = await getRequestMeta();

  await client.query(
    `INSERT INTO user_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, NULLIF($4, '')::inet, $5)`,
    [userId, tokenHash, meta.userAgent, meta.ipAddress ?? "", expires],
  );

  await setSessionCookie(token, expires);
  return token;
}

export async function revokeCurrentSession() {
  const token = await readSessionToken();
  if (!token) return;

  await query(
    `UPDATE user_sessions
     SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashSessionToken(token)],
  );
  await clearSessionCookie();
}

async function loadSessionUser(token: string): Promise<SessionUser | null> {
  const result = await query<{
    user_id: string;
    username: string;
    display_name: string;
    email: string | null;
    department_id: string | null;
    department_name: string | null;
    user_is_admin: boolean;
    department_is_admin: boolean | null;
    permissions: ModulePermission[] | null;
  }>(
    `SELECT
      u.id AS user_id,
      u.username,
      u.display_name,
      u.email,
      u.department_id,
      d.name AS department_name,
      u.is_admin AS user_is_admin,
      d.is_admin AS department_is_admin,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'moduleCode', m.code,
            'canView', p.can_view,
            'canCreate', p.can_create,
            'canUpdate', p.can_update,
            'canDelete', p.can_delete,
            'canApprove', p.can_approve
          )
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::jsonb
      ) AS permissions
    FROM user_sessions s
    JOIN app_users u ON u.id = s.user_id
    LEFT JOIN departments d ON d.id = u.department_id AND d.deleted_at IS NULL
    LEFT JOIN department_module_permissions p ON p.department_id = u.department_id
    LEFT JOIN modules m ON m.id = p.module_id AND m.is_active = true
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.deleted_at IS NULL
      AND u.status = 'active'
    GROUP BY u.id, d.id`,
    [hashSessionToken(token)],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    departmentId: row.department_id,
    departmentName: row.department_name,
    isAdmin: row.user_is_admin || Boolean(row.department_is_admin),
    permissions: row.permissions ?? [],
  };
}

export const getCurrentUser = cache(async () => {
  const token = await readSessionToken();
  if (!token) return null;
  return loadSessionUser(token);
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw unauthorizedError();
  return user;
}

export async function requireModulePermission(
  moduleCode: string,
  action: keyof Omit<ModulePermission, "moduleCode"> = "canView",
) {
  const user = await requireUser();
  if (user.isAdmin) return user;

  const permission = user.permissions.find((item) => item.moduleCode === moduleCode);
  if (!permission?.canView || !permission[action]) {
    throw forbiddenError();
  }

  return user;
}
