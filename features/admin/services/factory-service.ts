import { query, queryOne } from "@/lib/db";

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
    return await queryOne(
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
