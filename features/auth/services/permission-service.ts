import { getCurrentUser } from "@/lib/auth-session";

export type PermissionAction = "view" | "create" | "update" | "delete" | "approve";

export class PermissionService {
  /**
   * Check if current user has permission for a specific module and action
   */
  static async hasPermission(
    moduleCode: string,
    action: PermissionAction
  ): Promise<boolean> {
    const user = await getCurrentUser();
    if (!user) return false;
    
    // Admins have full access to everything
    if (user.isAdmin) return true;
    
    const modPerm = user.permissions[moduleCode];
    if (!modPerm) return false;
    
    switch (action) {
      case "view":
        return !!modPerm.view;
      case "create":
        return !!modPerm.create;
      case "update":
        return !!modPerm.update;
      case "delete":
        return !!modPerm.delete;
      case "approve":
        return !!modPerm.approve;
      default:
        return false;
    }
  }

  /**
   * Check if current user has view access to a specific module
   */
  static async hasModuleAccess(moduleCode: string): Promise<boolean> {
    return this.hasPermission(moduleCode, "view");
  }

  /**
   * Check if current user is admin
   */
  static async isAdmin(): Promise<boolean> {
    const user = await getCurrentUser();
    return !!(user && user.isAdmin);
  }
}
