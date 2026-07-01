import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkPermission } from '@/lib/services/auth';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .trim()
    .replace(/(^_|_$)/g, '');
}

export async function GET() {
  if (!(await checkPermission('auth', 'view'))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 });
  }

  try {
    const res = await query(`
      SELECT d.id, d.code, d.name, d.is_admin,
             COALESCE((
               SELECT json_agg(m.code)
               FROM department_permissions dp
               JOIN modules m ON dp.module_id = m.id
               WHERE dp.department_id = d.id AND dp.can_view = true
             ), '[]'::json) as permissions
      FROM departments d
      ORDER BY d.name ASC
    `);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('API Error in GET /api/admin/departments:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkPermission('auth', 'create'))) {
    return NextResponse.json({ error: 'Không có quyền thực hiện chức năng này.' }, { status: 403 });
  }

  try {
    const { name, permissions } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Thiếu tên phòng ban/vai trò.' }, { status: 400 });
    }

    const code = slugify(name);
    const targetPerms = permissions || [];

    await query('BEGIN');
    try {
      // 1. Insert department
      const deptRes = await query(
        'INSERT INTO departments (code, name, is_admin) VALUES ($1, $2, false) RETURNING *',
        [code, name.trim()]
      );
      const dept = deptRes.rows[0];

      // 2. Fetch all system modules
      const modulesRes = await query('SELECT id, code FROM modules');
      
      // 3. Insert permissions for each module
      for (const m of modulesRes.rows) {
        const canView = targetPerms.includes(m.code);
        await query(`
          INSERT INTO department_permissions (department_id, module_id, can_view, can_create, can_update, can_delete, can_approve)
          VALUES ($1, $2, $3, $3, $3, $3, $3)
        `, [dept.id, m.id, canView]);
      }

      await query('COMMIT');

      // Return formatted department
      return NextResponse.json({ 
        success: true, 
        data: {
          ...dept,
          permissions: targetPerms
        } 
      });
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  } catch (error: any) {
    console.error('API Error in POST /api/admin/departments:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Tên hoặc mã phòng ban đã tồn tại.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await checkPermission('auth', 'update'))) {
    return NextResponse.json({ error: 'Không có quyền thực hiện chức năng này.' }, { status: 403 });
  }

  try {
    const { id, name, permissions } = await request.json();

    if (!id || !name) {
      return NextResponse.json({ error: 'Thiếu ID hoặc tên phòng ban.' }, { status: 400 });
    }

    const targetPerms = permissions || [];

    await query('BEGIN');
    try {
      // 1. Update department name
      const deptRes = await query(
        'UPDATE departments SET name = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [id, name.trim()]
      );
      const dept = deptRes.rows[0];

      // 2. Clear old permissions
      await query('DELETE FROM department_permissions WHERE department_id = $1', [id]);

      // 3. Re-insert permissions
      const modulesRes = await query('SELECT id, code FROM modules');
      for (const m of modulesRes.rows) {
        const canView = targetPerms.includes(m.code);
        await query(`
          INSERT INTO department_permissions (department_id, module_id, can_view, can_create, can_update, can_delete, can_approve)
          VALUES ($1, $2, $3, $3, $3, $3, $3)
        `, [id, m.id, canView]);
      }

      await query('COMMIT');

      return NextResponse.json({ 
        success: true, 
        data: {
          ...dept,
          permissions: targetPerms
        } 
      });
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  } catch (error: any) {
    console.error('API Error in PUT /api/admin/departments:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await checkPermission('auth', 'delete'))) {
    return NextResponse.json({ error: 'Không có quyền thực hiện chức năng này.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID phòng ban.' }, { status: 400 });
    }

    const checkRes = await query('SELECT code, name FROM departments WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy phòng ban.' }, { status: 404 });
    }

    const dept = checkRes.rows[0];
    if (dept.code === 'admin' || dept.code === 'hr_payroll' || dept.name === 'Ban Giám Đốc') {
      return NextResponse.json({ error: 'Không thể xóa phòng ban cốt lõi của hệ thống.' }, { status: 400 });
    }

    await query('DELETE FROM departments WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error in DELETE /api/admin/departments:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}
