import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { PayrollExportService } from "@/features/payroll/services/payroll-export-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lỗi máy chủ";
}

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xuất bảng lương.");
    }

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");
    const source = searchParams.get("source") === "audit" ? "audit" : "standard";

    if (!cycleId) {
      return ApiResponse.badRequest("Mã chu kỳ thanh toán (cycleId) là bắt buộc.", "MISSING_FIELDS");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const exportResult = await PayrollExportService.exportPayrollWorkbook(cycleId, source, currentUser.factoryId);

    return new Response(new Uint8Array(exportResult.buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportResult.fileName}"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error in GET payroll export:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}
