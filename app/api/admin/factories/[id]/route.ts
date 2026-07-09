import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { FactoryService } from "@/features/admin/services/factory-service";
import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";
import { assertFactoryAccess } from "@/lib/factory-scope";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Lỗi máy chủ";

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem thông tin xưởng.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const { id } = await context.params;
    await assertFactoryAccess(currentUser, id);

    const factory = await FactoryService.getFactoryById(id);
    if (!factory) return ApiResponse.notFound("Không tìm thấy xưởng.");
    return ApiResponse.success(factory);
  } catch (error: unknown) {
    console.error("Error in GET factory:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền chỉnh sửa xưởng.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    if (!currentUser.isSystemAdmin) {
      return ApiResponse.forbidden("Chỉ admin hệ thống được chỉnh sửa xưởng.");
    }

    const { id } = await context.params;
    const body = await request.json();
    const { code, name, description, isActive } = body;

    if (!code || !name) {
      return ApiResponse.badRequest("Mã xưởng và tên xưởng không được để trống.", "MISSING_FIELDS");
    }

    const factory = await FactoryService.updateFactory(id, { code, name, description, isActive });
    if (!factory) return ApiResponse.notFound("Không tìm thấy xưởng.");
    return ApiResponse.success(factory);
  } catch (error: unknown) {
    console.error("Error in PUT factory:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("auth", "delete");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xóa xưởng.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    if (!currentUser.isSystemAdmin) {
      return ApiResponse.forbidden("Chỉ admin hệ thống được xóa xưởng.");
    }

    const { id } = await context.params;
    await FactoryService.deleteFactory(id);
    return ApiResponse.success({ message: "Xóa xưởng thành công." });
  } catch (error: unknown) {
    console.error("Error in DELETE factory:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}
