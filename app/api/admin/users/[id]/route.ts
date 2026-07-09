import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { UserService } from "@/features/admin/services/user-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { resolveFactoryId } from "@/lib/factory-scope";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem thông tin người dùng.");
    }

    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const { searchParams } = new URL(request.url);
    const factoryId = currentUser.isSystemAdmin ? searchParams.get("factoryId") || undefined : currentUser.factoryId;
    const user = await UserService.getUserById(id, factoryId);
    
    if (!user) {
      return ApiResponse.notFound("Không tìm thấy người dùng.");
    }

    return ApiResponse.success(user);
  } catch (error: any) {
    console.error("Error in GET user by id:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền chỉnh sửa người dùng.");
    }

    const { id } = await context.params;
    const body = await request.json();
    const { departmentId, username, displayName, email, password, status, isAdmin, factoryId: requestedFactoryId, memberships } = body;

    if (!username || !displayName) {
      return ApiResponse.badRequest("Mã đăng nhập và tên hiển thị không được để trống.", "MISSING_FIELDS");
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

    const updatedUser = await UserService.updateUser(id, {
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

    return ApiResponse.success(updatedUser);
  } catch (error: any) {
    console.error("Error in PUT user:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "delete");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xóa người dùng.");
    }

    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const { searchParams } = new URL(request.url);
    const factoryId = currentUser.isSystemAdmin ? searchParams.get("factoryId") || undefined : currentUser.factoryId;
    await UserService.deleteUser(id, factoryId);
    return ApiResponse.success({ message: "Xóa người dùng thành công." });
  } catch (error: any) {
    console.error("Error in DELETE user:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
