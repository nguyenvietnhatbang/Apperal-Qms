import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { SalaryConfigService } from "@/features/employees/services/salary-config-service";
import { ApiResponse } from "@/lib/api-response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface SalaryConfigRequestBody {
  id?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  insuranceSalary?: number | string | null;
  baseSalary?: number | string | null;
  positionAllowance?: number | string | null;
  responsibilityAllowance?: number | string | null;
  seniorityAllowance?: number | string | null;
  safetyAllowance?: number | string | null;
  phoneAllowance?: number | string | null;
  travelAllowance?: number | string | null;
  housingAllowance?: number | string | null;
  attendanceBonus?: number | string | null;
  otherBonus?: number | string | null;
  mealAllowance?: number | string | null;
  note?: string | null;
}

const toMoney = (value: unknown) => Number(value || 0);
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Lỗi máy chủ";

function getSalaryPayload(body: SalaryConfigRequestBody) {
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

  return {
    effectiveFrom,
    effectiveTo,
    insuranceSalary: toMoney(insuranceSalary),
    baseSalary: toMoney(baseSalary),
    positionAllowance: toMoney(positionAllowance),
    responsibilityAllowance: toMoney(responsibilityAllowance),
    seniorityAllowance: toMoney(seniorityAllowance),
    safetyAllowance: toMoney(safetyAllowance),
    phoneAllowance: toMoney(phoneAllowance),
    travelAllowance: toMoney(travelAllowance),
    housingAllowance: toMoney(housingAllowance),
    attendanceBonus: toMoney(attendanceBonus),
    otherBonus: toMoney(otherBonus),
    mealAllowance: toMoney(mealAllowance),
    note,
  };
}

function validateSalaryPayload(payload: ReturnType<typeof getSalaryPayload>) {
  if (!payload.effectiveFrom) {
    return "Ngày hiệu lực bắt đầu không được để trống.";
  }

  const salaryValues = [
    payload.insuranceSalary,
    payload.baseSalary,
    payload.positionAllowance,
    payload.responsibilityAllowance,
    payload.seniorityAllowance,
    payload.safetyAllowance,
    payload.phoneAllowance,
    payload.travelAllowance,
    payload.housingAllowance,
    payload.attendanceBonus,
    payload.otherBonus,
    payload.mealAllowance,
  ];

  if (salaryValues.some((value) => Number.isNaN(value) || value < 0)) {
    return "Các khoản lương và phụ cấp phải là số không âm.";
  }

  return null;
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
  } catch (error: unknown) {
    console.error("Error in GET employee salary configs:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền cập nhật cấu hình lương.");
    }

    const { id } = await context.params;
    const body = await request.json() as SalaryConfigRequestBody;
    const payload = getSalaryPayload(body);
    const validationError = validateSalaryPayload(payload);

    if (validationError) {
      return ApiResponse.badRequest(validationError, "INVALID_SALARY_CONFIG");
    }
    const effectiveFrom = payload.effectiveFrom;
    if (!effectiveFrom) {
      return ApiResponse.badRequest("Ngày hiệu lực bắt đầu không được để trống.", "INVALID_SALARY_CONFIG");
    }

    const newConfig = await SalaryConfigService.createSalaryConfig({
      employeeId: id,
      effectiveFrom,
      effectiveTo: payload.effectiveTo,
      totalSalary: 0, // calculated inside service
      insuranceSalary: payload.insuranceSalary,
      baseSalary: payload.baseSalary,
      positionAllowance: payload.positionAllowance,
      responsibilityAllowance: payload.responsibilityAllowance,
      seniorityAllowance: payload.seniorityAllowance,
      safetyAllowance: payload.safetyAllowance,
      phoneAllowance: payload.phoneAllowance,
      travelAllowance: payload.travelAllowance,
      housingAllowance: payload.housingAllowance,
      attendanceBonus: payload.attendanceBonus,
      otherBonus: payload.otherBonus,
      mealAllowance: payload.mealAllowance,
      note: payload.note,
    });

    return ApiResponse.success(newConfig, 201);
  } catch (error: unknown) {
    console.error("Error in POST employee salary configs:", error);
    const errorMessage = getErrorMessage(error);
    if (errorMessage.includes("Ngày hiệu lực")) {
      return ApiResponse.badRequest(errorMessage, "INVALID_EFFECTIVE_FROM");
    }
    return ApiResponse.error(errorMessage, "SERVER_ERROR", undefined, 500);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền cập nhật cấu hình lương.");
    }

    const { id } = await context.params;
    const body = await request.json() as SalaryConfigRequestBody;
    const configId = body.id;
    if (!configId) {
      return ApiResponse.badRequest("Thiếu mã cấu hình lương cần cập nhật.", "MISSING_CONFIG_ID");
    }

    const payload = getSalaryPayload(body);
    const validationError = validateSalaryPayload(payload);
    if (validationError) {
      return ApiResponse.badRequest(validationError, "INVALID_SALARY_CONFIG");
    }
    const effectiveFrom = payload.effectiveFrom;
    if (!effectiveFrom) {
      return ApiResponse.badRequest("Ngày hiệu lực bắt đầu không được để trống.", "INVALID_SALARY_CONFIG");
    }

    const updatedConfig = await SalaryConfigService.updateSalaryConfig(configId, {
      employeeId: id,
      effectiveFrom,
      effectiveTo: payload.effectiveTo,
      totalSalary: 0,
      insuranceSalary: payload.insuranceSalary,
      baseSalary: payload.baseSalary,
      positionAllowance: payload.positionAllowance,
      responsibilityAllowance: payload.responsibilityAllowance,
      seniorityAllowance: payload.seniorityAllowance,
      safetyAllowance: payload.safetyAllowance,
      phoneAllowance: payload.phoneAllowance,
      travelAllowance: payload.travelAllowance,
      housingAllowance: payload.housingAllowance,
      attendanceBonus: payload.attendanceBonus,
      otherBonus: payload.otherBonus,
      mealAllowance: payload.mealAllowance,
      note: payload.note,
    });

    if (!updatedConfig) {
      return ApiResponse.notFound("Không tìm thấy cấu hình lương cần cập nhật.");
    }

    return ApiResponse.success(updatedConfig);
  } catch (error: unknown) {
    console.error("Error in PUT employee salary configs:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}
