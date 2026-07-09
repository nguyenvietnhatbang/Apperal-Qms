import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { PayrollRuleService } from "@/features/payroll/services/payroll-rule-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { resolveAccessibleFactoryId } from "@/lib/factory-scope";

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem quy tắc tính lương.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const { searchParams } = new URL(request.url);
    const factoryId = await resolveAccessibleFactoryId(currentUser, searchParams.get("factoryId"));
    const rules = await PayrollRuleService.getRules(factoryId);
    return ApiResponse.success(rules);
  } catch (error: any) {
    console.error("Error in GET rules:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
