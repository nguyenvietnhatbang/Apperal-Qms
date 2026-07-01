import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { ApiResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    return ApiResponse.success(user);
  } catch (error: any) {
    console.error("Error in session route:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ nội bộ", "SERVER_ERROR", undefined, 500);
  }
}
