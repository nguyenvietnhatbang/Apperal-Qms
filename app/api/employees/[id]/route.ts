import { NextRequest } from "next/server";
import { PermissionService } from "@/features/auth/services/permission-service";
import { EmployeeService } from "@/features/employees/services/employee-service";
import { ApiResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth-session";
import { resolveAccessibleFactoryId } from "@/lib/factory-scope";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "view");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xem thông tin nhân viên.");
    }

    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const { searchParams } = new URL(request.url);
    const factoryId = await resolveAccessibleFactoryId(currentUser, searchParams.get("factoryId"));

    const emp = await EmployeeService.getEmployeeById(id, factoryId);
    
    if (!emp) {
      return ApiResponse.notFound("Không tìm thấy nhân viên.");
    }

    return ApiResponse.success(emp);
  } catch (error: any) {
    console.error("Error in GET employee by id:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "update");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền chỉnh sửa nhân viên.");
    }

    const { id } = await context.params;
    const body = await request.json();
    const { employeeCode, fullName, gender, departmentName, positionTitle, joinedDate, status, dependentCount, hasChildUnder6 } = body;

    if (!employeeCode || !fullName) {
      return ApiResponse.badRequest("Mã nhân viên và họ tên không được để trống.", "MISSING_FIELDS");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const factoryId = await resolveAccessibleFactoryId(currentUser, body.factoryId);

    const updatedEmp = await EmployeeService.updateEmployee(id, {
      factoryId,
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

    return ApiResponse.success(updatedEmp);
  } catch (error: any) {
    console.error("Error in PUT employee:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const hasAccess = await PermissionService.hasPermission("payroll", "delete");
    if (!hasAccess) {
      return ApiResponse.forbidden("Bạn không có quyền xóa nhân viên.");
    }

    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) return ApiResponse.unauthorized("Chưa đăng nhập.");
    const { searchParams } = new URL(request.url);
    const factoryId = await resolveAccessibleFactoryId(currentUser, searchParams.get("factoryId"));

    await EmployeeService.deleteEmployee(id, factoryId);
    return ApiResponse.success({ message: "Xóa nhân viên thành công." });
  } catch (error: any) {
    console.error("Error in DELETE employee:", error);
    return ApiResponse.error(error.message || "Lỗi máy chủ", "SERVER_ERROR", undefined, 500);
  }
}
