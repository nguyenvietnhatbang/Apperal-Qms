import { NextResponse } from 'next/server';
import { checkPermission } from '@/lib/services/auth';
import * as payrollService from '@/lib/services/payroll';

export async function GET(request: Request) {
  if (!(await checkPermission('payroll'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const cycleId = searchParams.get('cycleId');
    const employeeId = searchParams.get('employeeId');

    if (type === 'cycles') {
      const data = await payrollService.getPayrollCycles();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'calculations') {
      if (!cycleId) {
        return NextResponse.json({ error: 'Thiếu cycleId.' }, { status: 400 });
      }
      const pageVal = searchParams.get('page');
      const limitVal = searchParams.get('limit');
      const sortBy = searchParams.get('sortBy') || 'employee_id';
      const sortOrder = (searchParams.get('sortOrder') || 'ASC') as 'ASC' | 'DESC';
      const search = searchParams.get('search') || undefined;

      const page = pageVal ? parseInt(pageVal, 10) : undefined;
      const limit = limitVal ? parseInt(limitVal, 10) : undefined;

      const result = await payrollService.getPayrollCalculations(cycleId, page, limit, sortBy, sortOrder, search);
      return NextResponse.json({ success: true, data: result.data, total: result.total });
    }

    if (type === 'details') {
      if (!cycleId || !employeeId) {
        return NextResponse.json({ error: 'Thiếu cycleId hoặc employeeId.' }, { status: 400 });
      }
      const data = await payrollService.getPayrollCalculationDetails(cycleId, employeeId);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Tham số type không hợp lệ.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkPermission('payroll'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { action, cycleId, name, startDate, endDate } = await request.json();

    if (action === 'create_cycle') {
      if (!cycleId || !name || !startDate || !endDate) {
        return NextResponse.json({ error: 'Thiếu thông tin chu kỳ tính lương.' }, { status: 400 });
      }
      const cycle = await payrollService.createPayrollCycle(cycleId, name, startDate, endDate);
      return NextResponse.json({ success: true, data: cycle });
    }

    if (action === 'calculate') {
      if (!cycleId) {
        return NextResponse.json({ error: 'Thiếu cycleId.' }, { status: 400 });
      }
      const results = await payrollService.calculatePayroll(cycleId);
      return NextResponse.json({ success: true, data: results });
    }

    if (action === 'finalize') {
      if (!cycleId) {
        return NextResponse.json({ error: 'Thiếu cycleId.' }, { status: 400 });
      }
      const cycle = await payrollService.finalizePayrollCycle(cycleId);
      return NextResponse.json({ success: true, data: cycle });
    }

    return NextResponse.json({ error: 'Hành động (action) không hợp lệ.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await checkPermission('payroll'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get('cycleId');

    if (!cycleId) {
      return NextResponse.json({ error: 'Thiếu cycleId.' }, { status: 400 });
    }

    const deleted = await payrollService.deletePayrollCycle(cycleId);
    return NextResponse.json({ success: true, data: deleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
