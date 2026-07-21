import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";
import { LeaveRequestService } from "@/features/leave-requests/services/leave-request-service";

const requestSchema = z.object({
  leaveType: z.enum(["paid_leave", "sick_leave", "late_with_permission"]),
  leaveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationDays: z.union([z.literal(0.5), z.literal(1)]),
  reason: z.string().trim().min(3).max(1000),
});

async function getPersonalRequester() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.isAdmin && !user.permissions.personal?.view) return null;
  if (!user.employeeId) return null;
  return user;
}

export async function GET() {
  const user = await getPersonalRequester();
  if (!user) return ApiResponse.unauthorized("Tài khoản chưa có quyền hoặc hồ sơ nhân viên.");
  return ApiResponse.success(await LeaveRequestService.listForEmployee(user.employeeId!, user.factoryId));
}

export async function POST(request: NextRequest) {
  try {
    const user = await getPersonalRequester();
    if (!user) return ApiResponse.unauthorized("Tài khoản chưa có quyền hoặc hồ sơ nhân viên.");
    const input = requestSchema.parse(await request.json());
    const created = await LeaveRequestService.create({ ...input, employeeId: user.employeeId!, factoryId: user.factoryId, requestedBy: user.id });
    return ApiResponse.success(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) return ApiResponse.badRequest("Thông tin đơn nghỉ không hợp lệ.", "INVALID_LEAVE_REQUEST");
    const message = error instanceof Error && error.message.includes("idx_leave_requests_active_employee_date")
      ? "Ngày này đã có đơn nghỉ đang chờ hoặc đã được duyệt."
      : "Không thể gửi đơn nghỉ.";
    return ApiResponse.error(message, "LEAVE_REQUEST_ERROR", undefined, 400);
  }
}
