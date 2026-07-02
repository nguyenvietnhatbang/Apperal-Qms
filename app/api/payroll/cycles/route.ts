import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { getCurrentUser } from "@/lib/auth-session";
import { PayrollCycleService } from "@/features/payroll/services/payroll-cycle-service";
import { ApiResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem chu kỳ lương.");
    }

    const cycles = await PayrollCycleService.getCycles();
    return ApiResponse.success(cycles);
  } catch (error: any) {
    console.error("Error in GET cycles:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "create");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền tạo chu kỳ lương.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const body = await request.json();
    const { code, name, periodStart, periodEnd, standardWorkdays, standardHoursPerDay, note } = body;

    if (!code || !name || !periodStart || !periodEnd) {
      return ApiResponse.badRequest("Mã chu kỳ, tên chu kỳ, ngày bắt đầu và kết thúc là bắt buộc.", "MISSING_FIELDS");
    }

    const newCycle = await PayrollCycleService.createCycle({
      code,
      name,
      periodStart,
      periodEnd,
      standardWorkdays: standardWorkdays !== undefined ? Number(standardWorkdays) : undefined,
      standardHoursPerDay: standardHoursPerDay !== undefined ? Number(standardHoursPerDay) : undefined,
      note,
    }, currentUser.id);

    return ApiResponse.success(newCycle, 201);
  } catch (error: any) {
    console.error("Error in POST cycle:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
