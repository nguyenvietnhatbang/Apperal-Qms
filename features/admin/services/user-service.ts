import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/auth-session";

export interface UserData {
  id?: string;
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
  static async getUsers() {
    return await query(
      `SELECT u.id, u.username, u.display_name, u.email, u.status, u.is_admin, u.last_login_at, u.created_at,
              d.id as department_id, d.name as department_name
       FROM app_users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC`
    );
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string) {
    return await queryOne(
      `SELECT id, department_id, username, display_name, email, status, is_admin, last_login_at, created_at
       FROM app_users
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
  }

  /**
   * Create user with password hash
   */
  static async createUser(data: UserData) {
    if (!data.password) {
      throw new Error("Password is required for new users");
    }

    const passwordHash = hashPassword(data.password);
    
    return await queryOne(
      `INSERT INTO app_users (department_id, username, display_name, email, password_hash, status, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, display_name, email, status, is_admin`,
      [
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
    // Check if password is being updated
    if (data.password && data.password.trim() !== "") {
      const passwordHash = hashPassword(data.password);
      return await queryOne(
        `UPDATE app_users 
         SET department_id = $1, username = $2, display_name = $3, email = $4, 
             password_hash = $5, status = $6, is_admin = $7, updated_at = now()
         WHERE id = $8 AND deleted_at IS NULL
         RETURNING id, username, display_name, email, status, is_admin`,
        [
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
    } else {
      // Do not update password
      return await queryOne(
        `UPDATE app_users 
         SET department_id = $1, username = $2, display_name = $3, email = $4, 
             status = $5, is_admin = $6, updated_at = now()
         WHERE id = $7 AND deleted_at IS NULL
         RETURNING id, username, display_name, email, status, is_admin`,
        [
          data.departmentId || null,
          data.username,
          data.displayName,
          data.email || null,
          data.status || "active",
          data.isAdmin || false,
          id,
        ]
      );
    }
  }

  /**
   * Soft delete user
   */
  static async deleteUser(id: string) {
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
