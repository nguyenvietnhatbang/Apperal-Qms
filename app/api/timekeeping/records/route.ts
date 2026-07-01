import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { AttendanceCleaningService } from "@/features/timekeeping/services/attendance-cleaning-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem bảng chấm công.");
    }

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");
    const search = searchParams.get("search") || undefined;

    if (!cycleId) {
      return ApiResponse.badRequest("Mã chu kỳ thanh toán (cycleId) là bắt buộc.", "MISSING_FIELDS");
    }

    const records = await AttendanceCleaningService.getRecordsByCycleId(cycleId, search);
    return ApiResponse.success(records);
  } catch (error: any) {
    console.error("Error in GET attendance records:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
