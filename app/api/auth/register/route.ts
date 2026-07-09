import { NextRequest } from "next/server";
import { z } from "zod";
import { UserService } from "@/features/admin/services/user-service";
import { ApiResponse } from "@/lib/api-response";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tài khoản phải có ít nhất 3 ký tự.")
    .max(80, "Tài khoản không được vượt quá 80 ký tự.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Tài khoản chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch nối."),
  displayName: z
    .string()
    .trim()
    .min(2, "Họ tên phải có ít nhất 2 ký tự.")
    .max(150, "Họ tên không được vượt quá 150 ký tự."),
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ.")
    .max(255, "Email không được vượt quá 255 ký tự.")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự."),
});

interface DatabaseError extends Error {
  code?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return ApiResponse.badRequest("Thông tin đăng ký không hợp lệ.", "VALIDATION_ERROR", parsed.error.issues);
    }

    const { username, displayName, email, password } = parsed.data;

    const newUser = await UserService.createUser({
      username: username.toLowerCase(),
      displayName,
      email: email || null,
      password,
      status: "inactive",
      isAdmin: false,
    });

    return ApiResponse.success(
      {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.display_name,
        status: newUser.status,
      },
      201
    );
  } catch (error: unknown) {
    const databaseError = error as DatabaseError;

    if (databaseError.code === "23505") {
      return ApiResponse.error("Tài khoản hoặc email đã tồn tại.", "DUPLICATE_ACCOUNT", undefined, 409);
    }

    console.error("Error in register route:", error);
    return ApiResponse.error(
      databaseError.message || "Lỗi máy chủ nội bộ",
      "SERVER_ERROR",
      undefined,
      500
    );
  }
}
