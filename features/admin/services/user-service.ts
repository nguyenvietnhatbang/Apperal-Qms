import { query, queryOne, transaction } from "@/lib/db";
import { hashPassword } from "@/lib/auth-session";

export interface UserFactoryMembershipData {
  factoryId: string;
  departmentId?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UserData {
  id?: string;
  factoryId: string;
  departmentId?: string | null;
  memberships?: UserFactoryMembershipData[];
  username: string;
  displayName: string;
  email?: string | null;
  password?: string; // Only required on creation, optional on update
  status?: "active" | "inactive" | "locked";
  isAdmin?: boolean;
}

export class UserService {
  /**
   * Get all active users with department name
   */
  static async getUsers(factoryId?: string) {
    const params: any[] = [];
    const filterSql = factoryId
      ? ` AND EXISTS (
            SELECT 1 FROM user_factory_memberships fm
            WHERE fm.user_id = u.id AND fm.factory_id = $1 AND fm.deleted_at IS NULL AND fm.is_active = true
          )`
      : "";
    if (factoryId) params.push(factoryId);

    return await query(
      `SELECT u.id, u.username, u.display_name, u.email, u.status, u.is_admin, u.last_login_at, u.created_at,
              u.factory_id, f.name as factory_name, d.id as department_id, d.name as department_name,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'factoryId', fm.factory_id,
                      'factoryName', ff.name,
                      'departmentId', fm.department_id,
                      'departmentName', fd.name,
                      'isDefault', fm.is_default,
                      'isActive', fm.is_active
                    )
                    ORDER BY fm.is_default DESC, ff.name ASC
                  )
                  FROM user_factory_memberships fm
                  JOIN factories ff ON ff.id = fm.factory_id
                  LEFT JOIN departments fd ON fd.id = fm.department_id
                  WHERE fm.user_id = u.id AND fm.deleted_at IS NULL
                ),
                '[]'::json
              ) as memberships
       FROM app_users u
       JOIN factories f ON f.id = u.factory_id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.deleted_at IS NULL${filterSql}
       ORDER BY u.created_at DESC`
      ,
      params
    );
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string, factoryId?: string) {
    const params: any[] = [id];
    const filterSql = factoryId
      ? ` AND EXISTS (
            SELECT 1 FROM user_factory_memberships fm
            WHERE fm.user_id = app_users.id AND fm.factory_id = $2 AND fm.deleted_at IS NULL AND fm.is_active = true
          )`
      : "";
    if (factoryId) params.push(factoryId);

    return await queryOne(
      `SELECT id, factory_id, department_id, username, display_name, email, status, is_admin, last_login_at, created_at
       FROM app_users
       WHERE id = $1 AND deleted_at IS NULL${filterSql}`,
      params
    );
  }

  /**
   * Create user with password hash
   */
  static async createUser(data: UserData) {
    if (!data.password) {
      throw new Error("Password is required for new users");
    }

    const memberships = normalizeMemberships(data);

    if (data.departmentId) {
      const department = await queryOne(
        `SELECT id FROM departments WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
        [data.departmentId, data.factoryId]
      );
      if (!department) throw new Error("Phòng ban không thuộc xưởng đang chọn.");
    }

    const passwordHash = hashPassword(data.password);

    return await transaction(async (client) => {
      const userRes = await client.query(
        `INSERT INTO app_users (factory_id, department_id, username, display_name, email, password_hash, status, is_admin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, factory_id, username, display_name, email, status, is_admin`,
        [
          data.factoryId,
          data.departmentId || null,
          data.username,
          data.displayName,
          data.email || null,
          passwordHash,
          data.status || "active",
          data.isAdmin || false,
        ]
      );
      const user = userRes.rows[0];
      await syncMemberships(client, user.id, memberships);
      return user;
    });
  }

  /**
   * Update user details
   */
  static async updateUser(id: string, data: UserData) {
    const memberships = normalizeMemberships(data);

    if (data.departmentId) {
      const department = await queryOne(
        `SELECT id FROM departments WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
        [data.departmentId, data.factoryId]
      );
      if (!department) throw new Error("Phòng ban không thuộc xưởng đang chọn.");
    }

    // Check if password is being updated
    if (data.password && data.password.trim() !== "") {
      const passwordHash = hashPassword(data.password);
      return await transaction(async (client) => {
        const res = await client.query(
        `UPDATE app_users 
         SET factory_id = $1, department_id = $2, username = $3, display_name = $4, email = $5,
             password_hash = $6, status = $7, is_admin = $8, updated_at = now()
         WHERE id = $9 AND deleted_at IS NULL
         RETURNING id, factory_id, username, display_name, email, status, is_admin`,
        [
          data.factoryId,
          data.departmentId || null,
          data.username,
          data.displayName,
          data.email || null,
          passwordHash,
          data.status || "active",
          data.isAdmin || false,
          id,
        ]
        );
        if (res.rows[0]) await syncMemberships(client, id, memberships);
        return res.rows[0] || null;
      });
    } else {
      // Do not update password
      return await transaction(async (client) => {
        const res = await client.query(
        `UPDATE app_users 
         SET factory_id = $1, department_id = $2, username = $3, display_name = $4, email = $5,
             status = $6, is_admin = $7, updated_at = now()
         WHERE id = $8 AND deleted_at IS NULL
         RETURNING id, factory_id, username, display_name, email, status, is_admin`,
        [
          data.factoryId,
          data.departmentId || null,
          data.username,
          data.displayName,
          data.email || null,
          data.status || "active",
          data.isAdmin || false,
          id,
        ]
        );
        if (res.rows[0]) await syncMemberships(client, id, memberships);
        return res.rows[0] || null;
      });
    }
  }

  /**
   * Soft delete user
   */
  static async deleteUser(id: string, factoryId?: string) {
    // Check if it's the admin user
    const user = await queryOne("SELECT username FROM app_users WHERE id = $1", [id]);
    if (user && user.username === "admin") {
      throw new Error("Cannot delete bootstrap admin user");
    }

    await query(
      `UPDATE app_users 
       SET deleted_at = now(), status = 'inactive' 
       WHERE id = $1`,
      [id]
    );
    return true;
  }
}

function normalizeMemberships(data: UserData) {
  const source = data.memberships && data.memberships.length > 0
    ? data.memberships
    : [{ factoryId: data.factoryId, departmentId: data.departmentId || null, isDefault: true, isActive: true }];

  const seen = new Set<string>();
  return source
    .filter((membership) => membership.factoryId && !seen.has(membership.factoryId) && seen.add(membership.factoryId))
    .map((membership, index) => ({
      factoryId: membership.factoryId,
      departmentId: membership.departmentId || null,
      isDefault: membership.isDefault ?? index === 0,
      isActive: membership.isActive ?? true,
    }));
}

async function syncMemberships(client: any, userId: string, memberships: ReturnType<typeof normalizeMemberships>) {
  await client.query(
    `UPDATE user_factory_memberships
     SET deleted_at = now(), is_active = false, updated_at = now()
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  for (const membership of memberships) {
    if (membership.departmentId) {
      const department = await client.query(
        `SELECT id FROM departments WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
        [membership.departmentId, membership.factoryId]
      );
      if (department.rowCount === 0) throw new Error("Phòng ban không thuộc xưởng được cấp.");
    }

    await client.query(
      `INSERT INTO user_factory_memberships (user_id, factory_id, department_id, is_default, is_active, deleted_at)
       VALUES ($1, $2, $3, $4, $5, NULL)
       ON CONFLICT (user_id, factory_id) WHERE deleted_at IS NULL DO UPDATE
       SET department_id = EXCLUDED.department_id,
           is_default = EXCLUDED.is_default,
           is_active = EXCLUDED.is_active,
           deleted_at = NULL,
           updated_at = now()`,
      [userId, membership.factoryId, membership.departmentId, membership.isDefault, membership.isActive]
    );
  }
}
