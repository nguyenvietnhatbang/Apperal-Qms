import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { PayrollSlipService } from "@/features/payroll/services/payroll-slip-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem thông tin bảng lương.");
    }

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");
    const employeeId = searchParams.get("employeeId");
    const search = searchParams.get("search") || undefined;

    if (!cycleId) {
      return ApiResponse.badRequest("Mã chu kỳ thanh toán (cycleId) là bắt buộc.", "MISSING_FIELDS");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    if (employeeId) {
      // Get detailed payslip
      const payslip = await PayrollSlipService.getPayslip(cycleId, employeeId, currentUser.factoryId);
      if (!payslip) {
        return ApiResponse.notFound("Không tìm thấy phiếu lương.");
      }
      return ApiResponse.success(payslip);
    } else {
      // Get compiled payroll sheet
      const payrollItems = await PayrollSlipService.getPayrollItems(cycleId, currentUser.factoryId, search);
      return ApiResponse.success(payrollItems);
    }
  } catch (error: any) {
    console.error("Error in GET payroll items:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
