export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function validationError(message = "Dữ liệu không hợp lệ", details?: unknown) {
  return new AppError(400, "VALIDATION_ERROR", message, details);
}

export function unauthorizedError(message = "Bạn chưa đăng nhập") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function forbiddenError(message = "Bạn không có quyền thực hiện thao tác này") {
  return new AppError(403, "FORBIDDEN", message);
}

export function notFoundError(message = "Không tìm thấy dữ liệu") {
  return new AppError(404, "NOT_FOUND", message);
}
