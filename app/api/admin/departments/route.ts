import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { DepartmentService } from "@/features/admin/services/department-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { resolveFactoryId } from "@/lib/factory-scope";

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem thông tin phòng ban.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const { searchParams } = new URL(request.url);
    const factoryId = resolveFactoryId(currentUser, searchParams.get("factoryId"));
    const depts = await DepartmentService.getDepartments(factoryId);
    return ApiResponse.success(depts);
  } catch (error: any) {
    console.error("Error in GET departments:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "create");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền thêm mới phòng ban.");
    }

    const body = await request.json();
    const { code, name, description, isAdmin, isActive, permissions, factoryId: requestedFactoryId } = body;

    if (!code || !name) {
      return ApiResponse.badRequest("Mã phòng ban và tên phòng ban không được để trống.", "MISSING_FIELDS");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const factoryId = resolveFactoryId(currentUser, requestedFactoryId);

    const newDept = await DepartmentService.createDepartment(
      { factoryId, code, name, description, isAdmin, isActive },
      permissions || []
    );

    return ApiResponse.success(newDept, 201);
  } catch (error: any) {
    console.error("Error in POST departments:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
