import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";
import { PayrollSlipService } from "@/features/payroll/services/payroll-slip-service";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    if (!currentUser.isAdmin && !currentUser.permissions.personal?.view) {
      return ApiResponse.forbidden("Bạn không có quyền xem phiếu lương.");
    }
    if (!currentUser.employeeId) return ApiResponse.notFound("Tài khoản chưa liên kết nhân viên.");

    const cycleId = new URL(request.url).searchParams.get("cycleId");
    if (!cycleId) return ApiResponse.badRequest("cycleId là bắt buộc.", "MISSING_FIELDS");
    const payslip = await PayrollSlipService.getPayslip(cycleId, currentUser.employeeId, currentUser.factoryId);
    if (!payslip) return ApiResponse.notFound("Phiếu lương chưa được chốt hoặc không tồn tại.");
    return ApiResponse.success(payslip);
  } catch (error: unknown) {
    console.error("Error in GET personal payslip:", error);
    return ApiResponse.error("Không thể tải phiếu lương.", "SERVER_ERROR", undefined, 500);
  }
}

