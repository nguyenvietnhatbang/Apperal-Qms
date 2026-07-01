import { NextResponse } from 'next/server';
import { getSession } from '@/lib/services/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
  }
  return NextResponse.json({ success: true, session });
}
