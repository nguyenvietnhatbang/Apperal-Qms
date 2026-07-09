import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { DepartmentService } from "@/features/admin/services/department-service";
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
      return ApiResponse.forbidden("Bạn không có quyền xem thông tin phòng ban.");
    }

    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const { searchParams } = new URL(request.url);
    const factoryId = resolveFactoryId(currentUser, searchParams.get("factoryId"));
    const dept = await DepartmentService.getDepartmentById(id, factoryId);
    
    if (!dept) {
      return ApiResponse.notFound("Không tìm thấy phòng ban.");
    }

    return ApiResponse.success(dept);
  } catch (error: any) {
    console.error("Error in GET department by id:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền chỉnh sửa phòng ban.");
    }

    const { id } = await context.params;
    const body = await request.json();
    const { code, name, description, isAdmin, isActive, permissions, factoryId: requestedFactoryId } = body;

    if (!code || !name) {
      return ApiResponse.badRequest("Mã phòng ban và tên phòng ban không được để trống.", "MISSING_FIELDS");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const factoryId = resolveFactoryId(currentUser, requestedFactoryId);

    const updatedDept = await DepartmentService.updateDepartment(
      id,
      { factoryId, code, name, description, isAdmin, isActive },
      permissions || []
    );

    return ApiResponse.success(updatedDept);
  } catch (error: any) {
    console.error("Error in PUT department:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "delete");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xóa phòng ban.");
    }

    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const { searchParams } = new URL(request.url);
    const factoryId = resolveFactoryId(currentUser, searchParams.get("factoryId"));
    await DepartmentService.deleteDepartment(id, factoryId);
    return ApiResponse.success({ message: "Xóa phòng ban thành công." });
  } catch (error: any) {
    console.error("Error in DELETE department:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
