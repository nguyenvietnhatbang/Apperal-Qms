import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { SalaryConfigService } from "@/features/employees/services/salary-config-service";
import { ApiResponse } from "@/lib/api-response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem cấu hình lương.");
    }

    const { id } = await context.params;
    const configs = await SalaryConfigService.getConfigsByEmployeeId(id);
    return ApiResponse.success(configs);
  } catch (error: any) {
    console.error("Error in GET employee salary configs:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền cập nhật cấu hình lương.");
    }

    const { id } = await context.params;
    const body = await request.json();
    const {
      effectiveFrom,
      effectiveTo,
      insuranceSalary,
      baseSalary,
      positionAllowance,
      responsibilityAllowance,
      seniorityAllowance,
      safetyAllowance,
      phoneAllowance,
      travelAllowance,
      housingAllowance,
      attendanceBonus,
      otherBonus,
      mealAllowance,
      note,
    } = body;

    if (!effectiveFrom) {
      return ApiResponse.badRequest("Ngày hiệu lực bắt đầu không được để trống.", "MISSING_FIELDS");
    }

    const newConfig = await SalaryConfigService.createSalaryConfig({
      employeeId: id,
      effectiveFrom,
      effectiveTo,
      totalSalary: 0, // calculated inside service
      insuranceSalary: Number(insuranceSalary || 0),
      baseSalary: Number(baseSalary || 0),
      positionAllowance: Number(positionAllowance || 0),
      responsibilityAllowance: Number(responsibilityAllowance || 0),
      seniorityAllowance: Number(seniorityAllowance || 0),
      safetyAllowance: Number(safetyAllowance || 0),
      phoneAllowance: Number(phoneAllowance || 0),
      travelAllowance: Number(travelAllowance || 0),
      housingAllowance: Number(housingAllowance || 0),
      attendanceBonus: Number(attendanceBonus || 0),
      otherBonus: Number(otherBonus || 0),
      mealAllowance: Number(mealAllowance || 0),
      note,
    });

    return ApiResponse.success(newConfig, 21);
  } catch (error: any) {
    console.error("Error in POST employee salary configs:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
