import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";
import { LeaveRequestService } from "@/features/leave-requests/services/leave-request-service";

const reviewSchema = z.object({ status: z.enum(["approved", "rejected"]), reviewNote: z.string().trim().max(1000).optional() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return ApiResponse.unauthorized("Chưa đăng nhập.");
    if (!user.isAdmin && !user.permissions.payroll?.update) return ApiResponse.forbidden("Bạn không có quyền duyệt đơn nghỉ.");
    const input = reviewSchema.parse(await request.json());
    const { id } = await params;
    const result = await LeaveRequestService.review(id, user.factoryId, user.id, input.status, input.reviewNote || null);
    if (!result) return ApiResponse.badRequest("Đơn không còn chờ duyệt hoặc không tồn tại.", "INVALID_LEAVE_STATUS");
    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.error(error instanceof z.ZodError ? "Dữ liệu duyệt đơn không hợp lệ." : "Không thể duyệt đơn nghỉ.", "LEAVE_REVIEW_ERROR", undefined, 400);
  }
}
