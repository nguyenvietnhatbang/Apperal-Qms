import { isAppError } from "@/lib/errors";

export type Pagination = {
  page: number;
  limit: number;
  total: number;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ success: true, data }, init);
}

export function listOk<T>(data: T[], pagination: Pagination) {
  return Response.json({ success: true, data, pagination });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (isAppError(error)) {
    return fail(error.status, error.code, error.message, error.details);
  }

  console.error(error);
  return fail(500, "INTERNAL_ERROR", "Hệ thống đang gặp lỗi. Vui lòng thử lại sau.");
}
