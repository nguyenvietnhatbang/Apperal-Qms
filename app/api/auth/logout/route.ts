import { NextRequest } from "next/server";
import { AuthService } from "@/features/auth/services/auth-service";
import { ApiResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    await AuthService.logout();
    return ApiResponse.success({ message: "Đăng xuất thành công." });
  } catch (error: any) {
    console.error("Error in logout route:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ nội bộ", "SERVER_ERROR", undefined, 500);
  }
}
