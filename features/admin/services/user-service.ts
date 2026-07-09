import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth-session";

export interface UserData {
  id?: string;
  factoryId: string;
  departmentId?: string | null;
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
  static async getUsers(factoryId: string) {
    return await query(
      `SELECT u.id, u.username, u.display_name, u.email, u.status, u.is_admin, u.last_login_at, u.created_at,
              u.factory_id, f.name as factory_name, d.id as department_id, d.name as department_name
       FROM app_users u
       JOIN factories f ON f.id = u.factory_id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.deleted_at IS NULL AND u.factory_id = $1
       ORDER BY u.created_at DESC`
      ,
      [factoryId]
    );
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string, factoryId: string) {
    return await queryOne(
      `SELECT id, factory_id, department_id, username, display_name, email, status, is_admin, last_login_at, created_at
       FROM app_users
       WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
      [id, factoryId]
    );
  }

  /**
   * Create user with password hash
   */
  static async createUser(data: UserData) {
    if (!data.password) {
      throw new Error("Password is required for new users");
    }

    if (data.departmentId) {
      const department = await queryOne(
        `SELECT id FROM departments WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
        [data.departmentId, data.factoryId]
      );
      if (!department) throw new Error("Phòng ban không thuộc xưởng đang chọn.");
    }

    const passwordHash = hashPassword(data.password);
    
    return await queryOne(
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
  }

  /**
   * Update user details
   */
  static async updateUser(id: string, data: UserData) {
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
      return await queryOne(
        `UPDATE app_users 
         SET department_id = $1, username = $2, display_name = $3, email = $4, 
             password_hash = $5, status = $6, is_admin = $7, updated_at = now()
         WHERE id = $8 AND factory_id = $9 AND deleted_at IS NULL
         RETURNING id, factory_id, username, display_name, email, status, is_admin`,
        [
          data.departmentId || null,
          data.username,
          data.displayName,
          data.email || null,
          passwordHash,
          data.status || "active",
          data.isAdmin || false,
          id,
          data.factoryId,
        ]
      );
    } else {
      // Do not update password
      return await queryOne(
        `UPDATE app_users 
         SET department_id = $1, username = $2, display_name = $3, email = $4, 
             status = $5, is_admin = $6, updated_at = now()
         WHERE id = $7 AND factory_id = $8 AND deleted_at IS NULL
         RETURNING id, factory_id, username, display_name, email, status, is_admin`,
        [
          data.departmentId || null,
          data.username,
          data.displayName,
          data.email || null,
          data.status || "active",
          data.isAdmin || false,
          id,
          data.factoryId,
        ]
      );
    }
  }

  /**
   * Soft delete user
   */
  static async deleteUser(id: string, factoryId: string) {
    // Check if it's the admin user
    const user = await queryOne("SELECT username FROM app_users WHERE id = $1 AND factory_id = $2", [id, factoryId]);
    if (user && user.username === "admin") {
      throw new Error("Cannot delete bootstrap admin user");
    }

    await query(
      `UPDATE app_users 
       SET deleted_at = now(), status = 'inactive' 
       WHERE id = $1 AND factory_id = $2`,
      [id, factoryId]
    );
    return true;
  }
}
