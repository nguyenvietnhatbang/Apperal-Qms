import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { FactoryService } from "@/features/admin/services/factory-service";
import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";
import { getAccessibleFactories } from "@/lib/factory-scope";

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Lỗi máy chủ";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    if (!currentUser.isAdmin && !currentUser.permissions.auth?.view) {
      return ApiResponse.forbidden("Bạn không có quyền xem danh sách xưởng.");
    }

    if (!currentUser.isSystemAdmin) {
      const factories = await getAccessibleFactories(currentUser);
      return ApiResponse.success(factories);
    }

    const factories = await FactoryService.getFactories(true);
    return ApiResponse.success(factories);
  } catch (error: unknown) {
    console.error("Error in GET factories:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "create");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền thêm mới xưởng.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    if (!currentUser.isSystemAdmin) {
      return ApiResponse.forbidden("Chỉ admin hệ thống được tạo xưởng.");
    }

    const body = await request.json();
    const { code, name, description, isActive } = body;

    if (!code || !name) {
      return ApiResponse.badRequest("Mã xưởng và tên xưởng không được để trống.", "MISSING_FIELDS");
    }

    const factory = await FactoryService.createFactory({ code, name, description, isActive }, currentUser.id);
    return ApiResponse.success(factory, 201);
  } catch (error: unknown) {
    console.error("Error in POST factories:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}
