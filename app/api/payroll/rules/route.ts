import { NextResponse } from 'next/server';
import { checkPermission } from '@/lib/services/auth';
import { getPayrollRulesList, updatePayrollRule } from '@/lib/services/payroll';

export async function GET() {
  if (!(await checkPermission('payroll'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const rules = await getPayrollRulesList();
    return NextResponse.json({ success: true, data: rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkPermission('payroll'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { key, value, description } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Thiếu key hoặc value.' }, { status: 400 });
    }

    const updated = await updatePayrollRule(key, value, description);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
