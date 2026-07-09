import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { getCurrentUser } from "@/lib/auth-session";
import { AttendanceImportService } from "@/features/timekeeping/services/attendance-import-service";
import { AttendanceCleaningService } from "@/features/timekeeping/services/attendance-cleaning-service";
import { ApiResponse } from "@/lib/api-response";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem thông tin chấm công.");
    }

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");

    if (!cycleId) {
      return ApiResponse.badRequest("Mã chu kỳ thanh toán (cycleId) là bắt buộc.", "MISSING_FIELDS");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const imports = await AttendanceImportService.getImportsByCycleId(cycleId, currentUser.factoryId);
    return ApiResponse.success(imports);
  } catch (error: unknown) {
    console.error("Error in GET imports:", error);
    return ApiResponse.error(getErrorMessage(error, "Lỗi máy chủ"), "SERVER_ERROR", undefined, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "create");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền import chấm công.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const cycleId = formData.get("cycleId") as string | null;

    if (!file || !cycleId) {
      return ApiResponse.badRequest("File chấm công và cycleId là bắt buộc.", "MISSING_FIELDS");
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Import raw rows
    const { importId, totalRows } = await AttendanceImportService.importRawData(
      cycleId,
      file.name,
      buffer,
      currentUser.id,
      currentUser.factoryId,
      currentUser.isAdmin
    );

    // 2. Clean and standardize the rows
    const cleanResults = await AttendanceCleaningService.cleanAndProcessImport(importId, currentUser.factoryId);

    return ApiResponse.success({
      message: "Import và làm sạch chấm công thành công.",
      importId,
      totalRows,
      ...cleanResults,
    });
  } catch (error: unknown) {
    console.error("Error in POST import:", error);
    return ApiResponse.error(getErrorMessage(error, "Lỗi máy chủ"), "SERVER_ERROR", undefined, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "delete");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xóa dữ liệu chấm công.");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");

    if (!cycleId) {
      return ApiResponse.badRequest("Mã chu kỳ thanh toán (cycleId) là bắt buộc.", "MISSING_FIELDS");
    }

    const result = await AttendanceImportService.deleteCycleImportData(
      cycleId,
      currentUser.id,
      currentUser.factoryId,
      currentUser.isAdmin
    );
    return ApiResponse.success({
      message: "Đã xóa dữ liệu chấm công đã import của chu kỳ.",
      ...result,
    });
  } catch (error: unknown) {
    console.error("Error in DELETE imports:", error);
    return ApiResponse.error(getErrorMessage(error, "Lỗi máy chủ"), "SERVER_ERROR", undefined, 500);
  }
}
