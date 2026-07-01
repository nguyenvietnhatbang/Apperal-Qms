import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { UserService } from "@/features/admin/services/user-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem danh sách người dùng.");
    }

    const users = await UserService.getUsers();
    return ApiResponse.success(users);
  } catch (error: any) {
    console.error("Error in GET users:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "create");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền thêm mới người dùng.");
    }

    const body = await request.json();
    const { departmentId, username, displayName, email, password, status, isAdmin } = body;

    if (!username || !displayName || !password) {
      return ApiResponse.badRequest("Mã đăng nhập, tên hiển thị và mật khẩu không được để trống.", "MISSING_FIELDS");
    }

    const newUser = await UserService.createUser({
      departmentId,
      username,
      displayName,
      email,
      password,
      status,
      isAdmin,
    });

    return ApiResponse.success(newUser, 21);
  } catch (error: any) {
    console.error("Error in POST users:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
