import { cookies } from "next/headers";
import crypto from "crypto";
import { queryOne, query } from "./db";

export interface UserSessionData {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  isAdmin: boolean;
  isSystemAdmin: boolean;
  factoryId: string;
  factoryName: string;
  factoryCode: string;
  employeeId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  permissions: {
    [moduleCode: string]: {
      view: boolean;
      create: boolean;
      update: boolean;
      delete: boolean;
      approve: boolean;
    };
  };
}

/**
 * Hash a session token using SHA-256
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash password using scrypt format: scrypt:16384:8:1:salt:hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const N = 16384;
  const r = 8;
  const p = 1;
  const keylen = 64;
  
  const derivedKey = crypto.scryptSync(password, Buffer.from(salt, "hex"), keylen, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify password against stored scrypt hash
 */
export function verifyPassword(password: string, hashStr: string): boolean {
  try {
    const parts = hashStr.split(":");
    if (parts.length !== 6 || parts[0] !== "scrypt") {
      return false;
    }
    
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const saltHex = parts[4];
    const hashHex = parts[5];
    
    const salt = Buffer.from(saltHex, "hex");
    const keylen = Buffer.from(hashHex, "hex").length;
    
    const derivedKey = crypto.scryptSync(password, salt, keylen, { N, r, p });
    return derivedKey.toString("hex") === hashHex;
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

/**
 * Get current authenticated user session data in Next.js Server Components / Route Handlers
 */
export async function getCurrentUser(): Promise<UserSessionData | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) return null;
    
    const tokenHash = hashToken(sessionToken);
    
    // Find active session
    const session = await queryOne(
      `SELECT user_id, expires_at 
       FROM user_sessions 
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [tokenHash]
    );
    
    if (!session) return null;
    
    // Get user details
    const user = await queryOne(
      `SELECT u.id, u.username, u.display_name, u.email, u.employee_id, u.is_admin as user_admin,
              f.id as factory_id, f.name as factory_name, f.code as factory_code,
              d.id as dept_id, d.name as dept_name, d.code as dept_code, d.is_admin as dept_admin
       FROM app_users u
       JOIN factories f ON f.id = u.factory_id AND f.deleted_at IS NULL AND f.is_active = true
       LEFT JOIN departments d ON u.department_id = d.id AND d.factory_id = u.factory_id AND d.deleted_at IS NULL AND d.is_active = true
       WHERE u.id = $1 AND u.status = 'active' AND u.deleted_at IS NULL`,
      [session.user_id]
    );
    
    if (!user) return null;
    
    const isSystemAdmin = !!user.user_admin;
    const isAdmin = !!(user.user_admin || user.dept_admin);
    
    // Get permissions
    const permissions: UserSessionData["permissions"] = {};
    
    if (isAdmin) {
      // Get all modules
      const modules = await query("SELECT code FROM modules WHERE is_active = true");
      for (const mod of modules) {
        permissions[mod.code] = {
          view: true,
          create: true,
          update: true,
          delete: true,
          approve: true,
        };
      }
    } else {
      // Get department permissions
      const deptPerms = await query(
        `SELECT m.code as module_code, p.can_view, p.can_create, p.can_update, p.can_delete, p.can_approve
         FROM department_module_permissions p
         JOIN modules m ON p.module_id = m.id
         JOIN user_factory_memberships fm ON fm.department_id = p.department_id
         WHERE fm.user_id = $1
           AND fm.is_active = true
           AND fm.deleted_at IS NULL
           AND m.is_active = true`,
        [user.id]
      );
      
      for (const p of deptPerms) {
        permissions[p.module_code] = {
          view: !!(permissions[p.module_code]?.view || p.can_view),
          create: !!(permissions[p.module_code]?.create || p.can_create),
          update: !!(permissions[p.module_code]?.update || p.can_update),
          delete: !!(permissions[p.module_code]?.delete || p.can_delete),
          approve: !!(permissions[p.module_code]?.approve || p.can_approve),
        };
      }
    }
    
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email,
      isAdmin,
      isSystemAdmin,
      factoryId: user.factory_id,
      factoryName: user.factory_name,
      factoryCode: user.factory_code,
      employeeId: user.employee_id,
      departmentId: user.dept_id,
      departmentName: user.dept_name,
      departmentCode: user.dept_code,
      permissions,
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}
