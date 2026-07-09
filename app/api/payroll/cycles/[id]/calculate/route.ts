import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { getCurrentUser } from "@/lib/auth-session";
import { PayrollCalculationService } from "@/features/payroll/services/payroll-calculation-service";
import { ApiResponse } from "@/lib/api-response";
import { resolveAccessibleFactoryId } from "@/lib/factory-scope";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "create");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền thực hiện tính lương.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const factoryId = await resolveAccessibleFactoryId(currentUser, searchParams.get("factoryId"));
    
    await PayrollCalculationService.calculateCyclePayroll(id, currentUser.id, factoryId, currentUser.isAdmin);

    return ApiResponse.success({ message: "Tính lương thành công." });
  } catch (error: any) {
    console.error("Error in POST calculate cycle payroll:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ khi tính lương", "SERVER_ERROR", undefined, 500);
  }
}
