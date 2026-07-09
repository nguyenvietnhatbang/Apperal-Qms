import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { AuditService } from "@/features/audit/services/audit-service";
import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lỗi máy chủ khi chạy audit";
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "create");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền chạy audit.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const { id } = await context.params;
    const attendance = await AuditService.generateAuditAttendance(id, currentUser.id, currentUser.factoryId);
    const payroll = await AuditService.calculateAuditPayroll(id, currentUser.id, currentUser.factoryId);

    return ApiResponse.success({ attendance, payroll });
  } catch (error: unknown) {
    console.error("Error in POST run audit:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}
