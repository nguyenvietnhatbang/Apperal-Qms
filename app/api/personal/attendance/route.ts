import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";
import { PersonalService } from "@/features/personal/services/personal-service";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    if (!currentUser.isAdmin && !currentUser.permissions.personal?.view) {
      return ApiResponse.forbidden("Bạn không có quyền truy cập phân hệ cá nhân.");
    }
    if (!currentUser.employeeId) {
      return ApiResponse.notFound("Tài khoản này chưa được liên kết với hồ sơ nhân viên.");
    }

    const month = new URL(request.url).searchParams.get("month");
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return ApiResponse.badRequest("Tháng không hợp lệ.", "INVALID_MONTH");
    }

    const attendance = await PersonalService.getAttendance(currentUser.employeeId, currentUser.factoryId, month);
    return ApiResponse.success({ attendance });
  } catch (error: unknown) {
    console.error("Error in GET personal attendance:", error);
    return ApiResponse.error("Không thể tải chấm công.", "SERVER_ERROR", undefined, 500);
  }
}
