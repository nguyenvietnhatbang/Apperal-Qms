import { NextRequest } from "next/server";
import { AuthService } from "@/features/auth/services/auth-service";
import { ApiResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return ApiResponse.badRequest("Mã người dùng và mật khẩu không được để trống.", "MISSING_FIELDS");
    }

    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

    const hasLoggedIn = await AuthService.login(username, password, userAgent, ipAddress);
    
    if (!hasLoggedIn) {
      return ApiResponse.error("Mã người dùng hoặc mật khẩu không chính xác.", "INVALID_CREDENTIALS", undefined, 401);
    }

    return ApiResponse.success({});
  } catch (error) {
    console.error("Error in login route:", error);
    const message = error instanceof Error ? error.message : "Lỗi máy chủ nội bộ";
    return ApiResponse.error(message, "SERVER_ERROR", undefined, 500);
  }
}
