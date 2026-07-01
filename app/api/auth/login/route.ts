import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/services/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.' }, { status: 400 });
    }

    const hashedPassword = hashPassword(password);

    // Query user and their department details
    const res = await query(
      `SELECT u.*, d.name as department_name, d.is_admin 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.username = $1 AND u.deleted_at IS NULL`,
      [username]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' }, { status: 401 });
    }

    const user = res.rows[0];
    if (user.status === 'locked') {
      return NextResponse.json({ success: false, error: 'Tài khoản của bạn đã bị khóa.' }, { status: 403 });
    }

    if (user.password_hash !== hashedPassword) {
      return NextResponse.json({ success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' }, { status: 401 });
    }

    // Dynamic module permission fetch
    let permissions: string[] = [];
    const isAdminUser = user.username === 'admin' || user.is_admin === true;
    
    if (isAdminUser) {
      permissions = ['auth', 'payroll', 'admin'];
    } else if (user.department_id) {
      const permRes = await query(
        `SELECT m.code 
         FROM department_permissions dp
         JOIN modules m ON dp.module_id = m.id
         WHERE dp.department_id = $1 AND dp.can_view = true`,
        [user.department_id]
      );
      permissions = permRes.rows.map(r => r.code);
    }

    // Update last login timestamp
    await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Create session
    await createSession({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      department_id: user.department_id,
      department_name: user.department_name,
      is_admin: isAdminUser,
      permissions
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        department_name: user.department_name,
        permissions
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống khi đăng nhập.' }, { status: 500 });
  }
}
