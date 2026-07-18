import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import { generateToken, hashToken, verifyPassword } from "@/lib/auth-session";

export class AuthService {
  /**
   * Log in user and create a session.
   */
  static async login(username: string, password: string, userAgent?: string, ipAddress?: string): Promise<boolean> {
    try {
      // Find active user
      const user = await queryOne(
        `SELECT id, username, display_name, email, password_hash, is_admin, status 
         FROM app_users 
         WHERE username = $1 AND deleted_at IS NULL`,
        [username]
      );
      
      if (!user) {
        console.log(`Login failed: user not found: ${username}`);
        return false;
      }
      
      if (user.status !== "active") {
        console.log(`Login failed: user is ${user.status}: ${username}`);
        return false;
      }
      
      // Verify password
      const isPasswordMatch = await verifyPassword(password, user.password_hash);
      if (!isPasswordMatch) {
        console.log(`Login failed: password mismatch for user: ${username}`);
        return false;
      }
      
      // Create session
      const sessionToken = generateToken();
      const tokenHash = hashToken(sessionToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiration
      
      await query(
        `WITH created_session AS (
           INSERT INTO user_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
           VALUES ($1, $2, $3, $4, $5)
         )
         UPDATE app_users
         SET last_login_at = now()
         WHERE id = $1`,
        [user.id, tokenHash, userAgent || null, ipAddress || null, expiresAt]
      );
      
      // Set session cookie
      const cookieStore = await cookies();
      cookieStore.set("session_token", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
      });
      
      return true;
    } catch (error) {
      console.error("Error in AuthService.login:", error);
      return false;
    }
  }

  /**
   * Log out current user, revoke active session
   */
  static async logout(): Promise<boolean> {
    try {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get("session_token")?.value;
      if (sessionToken) {
        const tokenHash = hashToken(sessionToken);
        await query(
          `UPDATE user_sessions SET revoked_at = now() WHERE token_hash = $1`,
          [tokenHash]
        );
      }
      
      // Clear cookie
      cookieStore.delete("session_token");
      return true;
    } catch (error) {
      console.error("Error in AuthService.logout:", error);
      return false;
    }
  }
}
