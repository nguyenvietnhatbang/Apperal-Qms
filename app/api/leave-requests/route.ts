import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";
import { LeaveRequestService } from "@/features/leave-requests/services/leave-request-service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return ApiResponse.unauthorized("Chưa đăng nhập.");
  if (!user.isAdmin && !user.permissions.payroll?.update) return ApiResponse.forbidden("Bạn không có quyền duyệt đơn nghỉ.");
  return ApiResponse.success(await LeaveRequestService.listForApproval(user.factoryId));
}
