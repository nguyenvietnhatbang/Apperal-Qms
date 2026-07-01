import { NextResponse } from "next/server";

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any[];
  };
}

export class ApiResponse {
  static success<T>(data: T, status = 200) {
    return NextResponse.json(
      {
        success: true,
        data,
      } as SuccessResponse<T>,
      { status }
    );
  }

  static paginated<T>(data: T[], page: number, limit: number, total: number, status = 200) {
    return NextResponse.json(
      {
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
        },
      } as PaginatedResponse<T>,
      { status }
    );
  }

  static error(message: string, code = "INTERNAL_ERROR", details?: any[], status = 500) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
          details,
        },
      } as ErrorResponse,
      { status }
    );
  }

  static unauthorized(message = "Unauthorized", code = "UNAUTHORIZED") {
    return this.error(message, code, undefined, 401);
  }

  static forbidden(message = "Forbidden", code = "FORBIDDEN") {
    return this.error(message, code, undefined, 403);
  }

  static badRequest(message: string, code = "BAD_REQUEST", details?: any[]) {
    return this.error(message, code, details, 400);
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND") {
    return this.error(message, code, undefined, 404);
  }
}
