import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { PayrollRuleService } from "@/features/payroll/services/payroll-rule-service";
import { ApiResponse } from "@/lib/api-response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền cập nhật quy tắc tính lương.");
    }

    const { id } = await context.params;
    const body = await request.json();
    const { value } = body;

    if (value === undefined || isNaN(Number(value))) {
      return ApiResponse.badRequest("Giá trị quy tắc tính lương không hợp lệ.", "INVALID_VALUE");
    }

    const updatedRule = await PayrollRuleService.updateRule(id, Number(value));
    return ApiResponse.success(updatedRule);
  } catch (error: any) {
    console.error("Error in PUT rule:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
