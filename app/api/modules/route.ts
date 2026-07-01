import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return ApiResponse.unauthorized("Chưa đăng nhập.");
    }

    // Get all active modules
    const allModules = await query(
      `SELECT id, code, name, description, route_path as "routePath", sort_order as "sortOrder" 
       FROM modules 
       WHERE is_active = true 
       ORDER BY sort_order ASC`
    );

    // If user is admin, return all
    if (user.isAdmin) {
      return ApiResponse.success(allModules);
    }

    // Filter modules based on user permissions
    const allowedModules = allModules.filter(mod => {
      const perm = user.permissions[mod.code];
      return perm && perm.view;
    });

    return ApiResponse.success(allowedModules);
  } catch (error: any) {
    console.error("Error in modules route:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ nội bộ", "SERVER_ERROR", undefined, 500);
  }
}
