import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { DepartmentService } from "@/features/admin/services/department-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem thông tin phòng ban.");
    }

    const depts = await DepartmentService.getDepartments();
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
    const { code, name, description, isAdmin, isActive, permissions } = body;

    if (!code || !name) {
      return ApiResponse.badRequest("Mã phòng ban và tên phòng ban không được để trống.", "MISSING_FIELDS");
    }

    const newDept = await DepartmentService.createDepartment(
      { code, name, description, isAdmin, isActive },
      permissions || []
    );

    return ApiResponse.success(newDept, 21);
  } catch (error: any) {
    console.error("Error in POST departments:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
