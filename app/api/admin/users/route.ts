import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { UserService } from "@/features/admin/services/user-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { resolveFactoryId } from "@/lib/factory-scope";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    if (!currentUser.isAdmin && !currentUser.permissions.auth?.view) {
      return ApiResponse.forbidden("Bạn không có quyền xem danh sách người dùng.");
    }

    const { searchParams } = new URL(request.url);
    const factoryId = currentUser.isSystemAdmin ? searchParams.get("factoryId") || undefined : currentUser.factoryId;
    const users = await UserService.getUsers(factoryId);
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
    const { departmentId, username, displayName, email, password, status, isAdmin, factoryId: requestedFactoryId, memberships } = body;

    if (!username || !displayName || !password) {
      return ApiResponse.badRequest("Mã đăng nhập, tên hiển thị và mật khẩu không được để trống.", "MISSING_FIELDS");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const factoryId = resolveFactoryId(currentUser, requestedFactoryId);
    const requestedMemberships = Array.isArray(memberships) ? memberships : undefined;
    const normalizedMemberships = currentUser.isSystemAdmin
      ? requestedMemberships
      : requestedMemberships?.filter((membership: any) => membership.factoryId === factoryId);

    if (!currentUser.isSystemAdmin && requestedMemberships?.length !== normalizedMemberships?.length) {
      return ApiResponse.forbidden("Bạn không có quyền cấp người dùng sang xưởng khác.");
    }

    const newUser = await UserService.createUser({
      factoryId,
      departmentId,
      memberships: normalizedMemberships,
      username,
      displayName,
      email,
      password,
      status,
      isAdmin,
    });

    return ApiResponse.success(newUser, 201);
  } catch (error: any) {
    console.error("Error in POST users:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
