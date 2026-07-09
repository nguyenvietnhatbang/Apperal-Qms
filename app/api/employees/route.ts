import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { EmployeeService } from "@/features/employees/services/employee-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem danh sách nhân viên.");
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const employees = await EmployeeService.getEmployees(currentUser.factoryId, search);
    return ApiResponse.success(employees);
  } catch (error: any) {
    console.error("Error in GET employees:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "create");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền thêm mới nhân viên.");
    }

    const body = await request.json();
    const { employeeCode, fullName, gender, departmentName, positionTitle, joinedDate, status, dependentCount, hasChildUnder6 } = body;

    if (!employeeCode || !fullName) {
      return ApiResponse.badRequest("Mã nhân viên và họ tên không được để trống.", "MISSING_FIELDS");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");

    const newEmp = await EmployeeService.createEmployee({
      factoryId: currentUser.factoryId,
      employeeCode,
      fullName,
      gender,
      departmentName,
      positionTitle,
      joinedDate,
      status,
      dependentCount,
      hasChildUnder6,
    });

    return ApiResponse.success(newEmp, 201);
  } catch (error: any) {
    console.error("Error in POST employees:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
