import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { AuditService } from "@/features/audit/services/audit-service";
import { ApiResponse } from "@/lib/api-response";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lỗi máy chủ";
}

export async function GET() {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem cấu hình audit.");
    }

    const config = await AuditService.getActiveConfig();
    return ApiResponse.success(config);
  } catch (error: unknown) {
    console.error("Error in GET audit config:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền cập nhật cấu hình audit.");
    }

    const body = await request.json();
    const updated = await AuditService.updateActiveConfig({
      maxOvertimeHoursPerDay: body.maxOvertimeHoursPerDay === undefined ? undefined : Number(body.maxOvertimeHoursPerDay),
      maxOvertimeHoursPerMonth: body.maxOvertimeHoursPerMonth === undefined ? undefined : Number(body.maxOvertimeHoursPerMonth),
      maxOvertimeHoursPerYear: body.maxOvertimeHoursPerYear === undefined ? undefined : Number(body.maxOvertimeHoursPerYear),
      allowSundayWork: body.allowSundayWork,
      enableOvertimeTier2: body.enableOvertimeTier2,
      note: body.note,
    });

    return ApiResponse.success(updated);
  } catch (error: unknown) {
    console.error("Error in PUT audit config:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}
