import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { PayrollAdjustmentService } from "@/features/payroll/services/payroll-adjustment-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { resolveAccessibleFactoryId } from "@/lib/factory-scope";

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Lỗi máy chủ";

function normalizeAdjustment(input: any) {
  const optionalNumber = (value: unknown) => value === null || value === undefined || value === "" ? null : Number(value);
  return {
    employeeId: String(input.employeeId || ""),
    annualLeaveTotal: Number(input.annualLeaveTotal || 0),
    paidLeaveHours: Number(input.paidLeaveHours || 0),
    annualLeaveUsedCumulative: Number(input.annualLeaveUsedCumulative || 0),
    annualLeaveRemaining: Number(input.annualLeaveRemaining || 0),
    personalLeaveDays: Number(input.personalLeaveDays || 0),
    personalLeaveAmount: Number(input.personalLeaveAmount || 0),
    businessTripAllowance: Number(input.businessTripAllowance || 0),
    complianceBonus: Number(input.complianceBonus || 0),
    workTripSupport: Number(input.workTripSupport || 0),
    nightShiftHours: Number(input.nightShiftHours || 0),
    nightShiftAmount: Number(input.nightShiftAmount || 0),
    excessOvertimeNormalHours: Number(input.excessOvertimeNormalHours || 0),
    excessOvertimeSundayHours: Number(input.excessOvertimeSundayHours || 0),
    excessOvertimeHolidayHours: Number(input.excessOvertimeHolidayHours || 0),
    excessOvertimeNormalAmount: Number(input.excessOvertimeNormalAmount || 0),
    excessOvertimeSundayAmount: Number(input.excessOvertimeSundayAmount || 0),
    excessOvertimeHolidayAmount: Number(input.excessOvertimeHolidayAmount || 0),
    advancePayment1: Number(input.advancePayment1 || 0),
    advancePayment2: Number(input.advancePayment2 || 0),
    pendingLeaveAdvance: Number(input.pendingLeaveAdvance || 0),
    otherAllowanceAmount: Number(input.otherAllowanceAmount || 0),
    actualWorkdaysOverride: optionalNumber(input.actualWorkdaysOverride),
    paidLeaveDaysOverride: optionalNumber(input.paidLeaveDaysOverride),
    unpaidLeaveDaysOverride: optionalNumber(input.unpaidLeaveDaysOverride),
    holidayDaysOverride: optionalNumber(input.holidayDaysOverride),
    overtimeNormalHoursOverride: optionalNumber(input.overtimeNormalHoursOverride),
    overtimeSundayHoursOverride: optionalNumber(input.overtimeSundayHoursOverride),
    overtimeHolidayHoursOverride: optionalNumber(input.overtimeHolidayHoursOverride),
    employeeInsuranceAmountOverride: optionalNumber(input.employeeInsuranceAmountOverride),
    unionFeeAmountOverride: optionalNumber(input.unionFeeAmountOverride),
    personalIncomeTaxAmountOverride: optionalNumber(input.personalIncomeTaxAmountOverride),
    menstrualAllowanceAmountOverride: optionalNumber(input.menstrualAllowanceAmountOverride),
    childAllowanceAmountOverride: optionalNumber(input.childAllowanceAmountOverride),
    note: typeof input.note === "string" ? input.note : null,
  };
}

function hasInvalidNumber(item: ReturnType<typeof normalizeAdjustment>) {
  return Object.entries(item).some(([key, value]) => {
    if (key === "employeeId" || key === "note" || value === null) return false;
    return Number.isNaN(value) || Number(value) < 0;
  });
}

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem dữ liệu bổ sung bảng lương.");
    }

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");
    if (!cycleId) return ApiResponse.badRequest("cycleId là bắt buộc.", "MISSING_CYCLE_ID");

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const factoryId = await resolveAccessibleFactoryId(currentUser, searchParams.get("factoryId"));

    const adjustments = await PayrollAdjustmentService.getAdjustments(cycleId, factoryId, searchParams.get("search") || undefined);
    return ApiResponse.success(adjustments);
  } catch (error: unknown) {
    console.error("Error in GET payroll adjustments:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền cập nhật dữ liệu bổ sung bảng lương.");
    }

    const body = await request.json();
    const cycleId = String(body.cycleId || "");
    if (!cycleId) return ApiResponse.badRequest("cycleId là bắt buộc.", "MISSING_CYCLE_ID");

    const items = Array.isArray(body.items) ? body.items.map(normalizeAdjustment) : [normalizeAdjustment(body)];
    if (items.some((item: ReturnType<typeof normalizeAdjustment>) => !item.employeeId)) {
      return ApiResponse.badRequest("Thiếu nhân viên cần cập nhật.", "MISSING_EMPLOYEE");
    }
    if (items.some(hasInvalidNumber)) {
      return ApiResponse.badRequest("Các giá trị bổ sung phải là số không âm.", "INVALID_ADJUSTMENT");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const factoryId = await resolveAccessibleFactoryId(currentUser, body.factoryId);

    const result = await PayrollAdjustmentService.upsertAdjustments(cycleId, factoryId, items);
    return ApiResponse.success({ updatedCount: result.length });
  } catch (error: unknown) {
    console.error("Error in PUT payroll adjustments:", error);
    return ApiResponse.error(getErrorMessage(error), "SERVER_ERROR", undefined, 500);
  }
}
