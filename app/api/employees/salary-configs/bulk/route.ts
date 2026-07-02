import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { SalaryConfigService } from "@/features/employees/services/salary-config-service";
import { ApiResponse } from "@/lib/api-response";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toMoney(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : NaN;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lỗi máy chủ";
}

export async function POST(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền cập nhật cấu hình lương.");
    }

    const body = await request.json();
    const employeeIds: string[] = Array.isArray(body.employeeIds)
      ? Array.from(new Set(body.employeeIds.filter((id: unknown): id is string => typeof id === "string")))
      : [];
    const effectiveFrom = typeof body.effectiveFrom === "string" ? body.effectiveFrom : "";
    const insuranceSalary = toMoney(body.insuranceSalary);
    const baseSalary = toMoney(body.baseSalary);
    const positionAllowance = toMoney(body.positionAllowance);
    const responsibilityAllowance = toMoney(body.responsibilityAllowance);
    const seniorityAllowance = toMoney(body.seniorityAllowance);
    const safetyAllowance = toMoney(body.safetyAllowance);
    const phoneAllowance = toMoney(body.phoneAllowance);
    const travelAllowance = toMoney(body.travelAllowance);
    const housingAllowance = toMoney(body.housingAllowance);
    const attendanceBonus = toMoney(body.attendanceBonus);
    const otherBonus = toMoney(body.otherBonus);
    const mealAllowance = toMoney(body.mealAllowance);
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (employeeIds.length === 0) {
      return ApiResponse.badRequest("Vui lòng chọn ít nhất một nhân viên.", "MISSING_EMPLOYEES");
    }

    if (!employeeIds.every((id) => uuidPattern.test(id))) {
      return ApiResponse.badRequest("Danh sách nhân viên không hợp lệ.", "INVALID_EMPLOYEES");
    }

    if (!effectiveFrom) {
      return ApiResponse.badRequest("Ngày hiệu lực bắt đầu không được để trống.", "MISSING_EFFECTIVE_FROM");
    }

    const salaryValues = [
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
    ];

    if (salaryValues.some((value) => Number.isNaN(value) || value < 0)) {
      return ApiResponse.badRequest("Các khoản lương và phụ cấp phải là số không âm.", "INVALID_SALARY_VALUES");
    }

    const configs = await SalaryConfigService.createBulkSalaryConfigs({
      employeeIds,
      effectiveFrom,
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
      note: note || null,
    });

    return ApiResponse.success({ updatedCount: configs.length, configs }, 201);
  } catch (error: unknown) {
    console.error("Error in POST bulk employee salary configs:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}
