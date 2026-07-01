import { NextResponse } from 'next/server';
import { checkPermission } from '@/lib/services/auth';
import * as employeeService from '@/lib/services/employee';

export async function GET(request: Request) {
  if (!(await checkPermission('payroll', 'view'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const getDepts = searchParams.get('getDepartments') === 'true';

    if (getDepts) {
      const departments = await employeeService.getUniqueDepartments();
      return NextResponse.json({ success: true, data: departments });
    }

    const search = searchParams.get('search') || undefined;
    const department = searchParams.get('department') || undefined;
    const pageVal = searchParams.get('page');
    const limitVal = searchParams.get('limit');
    const sortBy = searchParams.get('sortBy') || 'id';
    const sortOrder = (searchParams.get('sortOrder') || 'ASC') as 'ASC' | 'DESC';

    const page = pageVal ? parseInt(pageVal, 10) : undefined;
    const limit = limitVal ? parseInt(limitVal, 10) : undefined;

    const result = await employeeService.getAllEmployees(search, department, page, limit, sortBy, sortOrder);
    return NextResponse.json({ success: true, data: result.data, total: result.total });
  } catch (error: any) {
    console.error('API Error in GET /api/employees:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkPermission('payroll', 'create'))) {
    return NextResponse.json({ error: 'Không có quyền thực hiện chức năng này.' }, { status: 403 });
  }

  try {
    const data = await request.json();
    if (!data.id || (!data.name && !data.full_name)) {
      return NextResponse.json({ error: 'Mã nhân viên và tên nhân viên là bắt buộc.' }, { status: 400 });
    }

    const newEmp = await employeeService.createEmployee(data);
    return NextResponse.json({ success: true, data: newEmp });
  } catch (error: any) {
    console.error('API Error in POST /api/employees:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Mã nhân viên đã tồn tại.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await checkPermission('payroll', 'update'))) {
    return NextResponse.json({ error: 'Không có quyền thực hiện chức năng này.' }, { status: 403 });
  }

  try {
    const data = await request.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Thiếu mã nhân viên để cập nhật.' }, { status: 400 });
    }

    const updated = await employeeService.updateEmployee(data.id, data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('API Error in PUT /api/employees:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await checkPermission('payroll', 'delete'))) {
    return NextResponse.json({ error: 'Không có quyền thực hiện chức năng này.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã nhân viên để xóa.' }, { status: 400 });
    }

    const deleted = await employeeService.deleteEmployee(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Không tìm thấy nhân viên.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (error: any) {
    console.error('API Error in DELETE /api/employees:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}
