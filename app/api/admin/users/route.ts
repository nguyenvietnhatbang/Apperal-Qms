import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkPermission, hashPassword } from '@/lib/services/auth';

export async function GET() {
  if (!(await checkPermission('auth'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const res = await query(`
      SELECT u.id, u.username, u.display_name, u.department_id, u.created_at, u.status, d.name as department_name,
             COALESCE((
               SELECT json_agg(m.code)
               FROM department_permissions dp
               JOIN modules m ON dp.module_id = m.id
               WHERE dp.department_id = u.department_id AND dp.can_view = true
             ), '[]'::json) as permissions
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.deleted_at IS NULL
      ORDER BY u.username ASC
    `);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkPermission('auth'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { username, password, display_name, department_id } = await request.json();

    if (!username || !password || !display_name) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc.' }, { status: 400 });
    }

    const passwordHash = hashPassword(password);

    const res = await query(
      `INSERT INTO users (username, password_hash, display_name, department_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, department_id, created_at`,
      [username.trim(), passwordHash, display_name.trim(), department_id || null]
    );

    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await checkPermission('auth'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { id, password, display_name, department_id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID người dùng.' }, { status: 400 });
    }

    // Check if modifying admin user
    const userRes = await query('SELECT username FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng.' }, { status: 404 });
    }

    let sql = 'UPDATE users SET display_name = $2, department_id = $3';
    const params: any[] = [id, display_name.trim(), department_id || null];
    let index = 4;

    if (password && password.trim() !== '') {
      sql += `, password_hash = $${index++}`;
      params.push(hashPassword(password));
    }

    sql += ' WHERE id = $1 RETURNING id, username, display_name, department_id, updated_at';
    
    const res = await query(sql, params);
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await checkPermission('auth'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID người dùng.' }, { status: 400 });
    }

    // Protect default admin user
    const checkRes = await query('SELECT username FROM users WHERE id = $1', [id]);
    if (checkRes.rows.length > 0 && checkRes.rows[0].username === 'admin') {
      return NextResponse.json({ error: 'Không thể xóa tài khoản quản trị hệ thống (admin).' }, { status: 400 });
    }

    await query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
