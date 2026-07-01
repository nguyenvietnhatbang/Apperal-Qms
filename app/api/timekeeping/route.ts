import { NextResponse } from 'next/server';
import { checkPermission } from '@/lib/services/auth';
import { parseAndSaveTimekeeping, getTimekeepingRecords } from '@/lib/services/timekeeping';

export async function GET(request: Request) {
  if (!(await checkPermission('payroll'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get('cycleId');
    const employeeId = searchParams.get('employeeId') || undefined;

    if (!cycleId) {
      return NextResponse.json({ error: 'Thiếu mã chu kỳ tính lương (cycleId).' }, { status: 400 });
    }

    const pageVal = searchParams.get('page');
    const limitVal = searchParams.get('limit');
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = (searchParams.get('sortOrder') || 'ASC') as 'ASC' | 'DESC';
    const search = searchParams.get('search') || undefined;

    const page = pageVal ? parseInt(pageVal, 10) : undefined;
    const limit = limitVal ? parseInt(limitVal, 10) : undefined;

    const result = await getTimekeepingRecords(cycleId, employeeId, page, limit, sortBy, sortOrder, search);
    return NextResponse.json({ success: true, data: result.data, total: result.total });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkPermission('payroll'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { cycleId, csvContent } = await request.json();

    if (!cycleId || !csvContent) {
      return NextResponse.json({ error: 'Thiếu mã chu kỳ tính lương hoặc nội dung tệp chấm công.' }, { status: 400 });
    }

    const result = await parseAndSaveTimekeeping(csvContent, cycleId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error importing timekeeping:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
