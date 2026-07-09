import { query, queryOne, transaction } from "@/lib/db";

export interface FactoryData {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export class FactoryService {
  static async getFactories(includeInactive = false) {
    let sql = `SELECT id, code, name, description, is_active as "isActive",
                      created_at as "createdAt", updated_at as "updatedAt"
               FROM factories
               WHERE deleted_at IS NULL`;

    if (!includeInactive) {
      sql += ` AND is_active = true`;
    }

    sql += ` ORDER BY name ASC`;
    return await query(sql);
  }

  static async getFactoryById(id: string) {
    return await queryOne(
      `SELECT id, code, name, description, is_active as "isActive",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM factories
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
  }

  static async getDefaultFactory() {
    return await queryOne(
      `SELECT id, code, name, description, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM factories
       WHERE code = 'default' AND deleted_at IS NULL`
    );
  }

  static async createFactory(data: FactoryData, actorId: string) {
    return await transaction(async (client) => {
      const factoryRes = await client.query(
        `INSERT INTO factories (code, name, description, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, code, name, description, is_active as "isActive"`,
        [
          data.code,
          data.name,
          data.description || null,
          data.isActive !== undefined ? data.isActive : true,
          actorId,
        ]
      );
      const factory = factoryRes.rows[0];

      const adminDeptRes = await client.query(
        `INSERT INTO departments (factory_id, code, name, description, is_admin, is_active)
         VALUES ($1, 'admin', 'Admin', 'Phòng ban/quyền quản trị của xưởng.', true, true)
         RETURNING id`,
        [factory.id]
      );
      const adminDeptId = adminDeptRes.rows[0].id;

      await client.query(
        `INSERT INTO department_module_permissions (
           department_id, module_id, can_view, can_create, can_update, can_delete, can_approve
         )
         SELECT $1, id, true, true, true, true, true
         FROM modules
         WHERE is_active = true
         ON CONFLICT (department_id, module_id) DO UPDATE
         SET can_view = true, can_create = true, can_update = true, can_delete = true, can_approve = true, updated_at = now()`,
        [adminDeptId]
      );

      await client.query(
        `INSERT INTO payroll_rules (factory_id, code, name, value, unit, description, is_active)
         SELECT $1, code, name, value, unit, description, is_active
         FROM payroll_rules
         WHERE factory_id = (SELECT id FROM factories WHERE code = 'default')
         ON CONFLICT (factory_id, code) DO NOTHING`,
        [factory.id]
      );

      await client.query(
        `INSERT INTO audit_configs (
           factory_id, code, name, max_overtime_hours_per_day, max_overtime_hours_per_month,
           max_overtime_hours_per_year, allow_sunday_work, enable_overtime_tier_2, note, is_active
         )
         SELECT $1, code, name, max_overtime_hours_per_day, max_overtime_hours_per_month,
                max_overtime_hours_per_year, allow_sunday_work, enable_overtime_tier_2, note, is_active
         FROM audit_configs
         WHERE factory_id = (SELECT id FROM factories WHERE code = 'default')
         ON CONFLICT (factory_id, code) DO NOTHING`,
        [factory.id]
      );

      await client.query(
        `INSERT INTO user_factory_memberships (user_id, factory_id, department_id, is_default, is_active)
         VALUES ($1, $2, $3, false, true)
         ON CONFLICT DO NOTHING`,
        [actorId, factory.id, adminDeptId]
      );

      return factory;
    });
  }

  static async updateFactory(id: string, data: FactoryData) {
    return await queryOne(
      `UPDATE factories
       SET code = $1,
           name = $2,
           description = $3,
           is_active = $4,
           updated_at = now()
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING id, code, name, description, is_active as "isActive"`,
      [
        data.code,
        data.name,
        data.description || null,
        data.isActive !== undefined ? data.isActive : true,
        id,
      ]
    );
  }

  static async deleteFactory(id: string) {
    const factory = await queryOne<{ code: string }>(
      `SELECT code FROM factories WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!factory) throw new Error("Không tìm thấy xưởng.");
    if (factory.code === "default") throw new Error("Không thể xóa xưởng mặc định.");

    const usage = await queryOne<{ count: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM departments WHERE factory_id = $1 AND deleted_at IS NULL) +
         (SELECT COUNT(*) FROM app_users WHERE factory_id = $1 AND deleted_at IS NULL) +
         (SELECT COUNT(*) FROM employees WHERE factory_id = $1 AND deleted_at IS NULL) +
         (SELECT COUNT(*) FROM payroll_cycles WHERE factory_id = $1)
       )::text as count`,
      [id]
    );

    if (Number(usage?.count || 0) > 0) {
      throw new Error("Xưởng đang có dữ liệu phòng ban, tài khoản, nhân viên hoặc chu kỳ lương; chỉ có thể ngừng hoạt động.");
    }

    await query(
      `UPDATE factories SET deleted_at = now(), is_active = false, updated_at = now() WHERE id = $1`,
      [id]
    );
    return true;
  }
}
