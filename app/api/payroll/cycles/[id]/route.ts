import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { getCurrentUser } from "@/lib/auth-session";
import { PayrollCycleService } from "@/features/payroll/services/payroll-cycle-service";
import { ApiResponse } from "@/lib/api-response";
import { query } from "@/lib/db";
import { resolveAccessibleFactoryId } from "@/lib/factory-scope";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem chi tiết chu kỳ lương.");
    }

    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const { searchParams } = new URL(request.url);
    const factoryId = await resolveAccessibleFactoryId(currentUser, searchParams.get("factoryId"));

    const cycle = await PayrollCycleService.getCycleById(id, factoryId);
    
    if (!cycle) {
      return ApiResponse.notFound("Không tìm thấy chu kỳ lương.");
    }

    return ApiResponse.success(cycle);
  } catch (error: any) {
    console.error("Error in GET cycle by id:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, note } = body;

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const factoryId = await resolveAccessibleFactoryId(currentUser, body.factoryId);

    // If updating status, verify update/approve permission
    if (status) {
      const isApproving = status === "locked" || status === "paid";
      const permissionRequired = isApproving ? "approve" : "update";
      
      const hasAccess = await PermissionService.hasPermission("payroll", permissionRequired);
      if (!hasAccess) {
        return ApiResponse.forbidden(`Bạn không có quyền thực hiện thao tác này (yêu cầu quyền ${permissionRequired}).`);
      }

      await PayrollCycleService.updateCycleStatus(id, status, currentUser.id, factoryId, note);
    } else {
      // Just update note or standard details directly
      const hasAccess = await PermissionService.hasPermission("payroll", "update");
      if (!hasAccess) {
        return ApiResponse.forbidden("Bạn không có quyền chỉnh sửa chu kỳ lương.");
      }
      
      await query(
        `UPDATE payroll_cycles SET note = $1, updated_at = now() WHERE id = $2 AND factory_id = $3`,
        [note || null, id, factoryId]
      );
    }

    const updatedCycle = await PayrollCycleService.getCycleById(id, factoryId);
    return ApiResponse.success(updatedCycle);
  } catch (error: any) {
    console.error("Error in PUT cycle:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "delete");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xóa chu kỳ lương.");
    }

    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const { searchParams } = new URL(request.url);
    const factoryId = await resolveAccessibleFactoryId(currentUser, searchParams.get("factoryId"));

    await PayrollCycleService.deleteCycle(id, factoryId);
    return ApiResponse.success({ message: "Xóa chu kỳ lương thành công." });
  } catch (error: any) {
    console.error("Error in DELETE cycle:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
