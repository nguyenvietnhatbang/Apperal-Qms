import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { AuditService } from "@/features/audit/services/audit-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lỗi máy chủ";
}

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem bảng chấm công audit.");
    }

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");
    const search = searchParams.get("search") || undefined;

    if (!cycleId) {
      return ApiResponse.badRequest("Mã chu kỳ thanh toán (cycleId) là bắt buộc.", "MISSING_FIELDS");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const records = await AuditService.getAuditAttendanceRecords(cycleId, currentUser.factoryId, search);
    return ApiResponse.success(records);
  } catch (error: unknown) {
    console.error("Error in GET audit attendance:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}
