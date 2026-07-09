import { query, queryOne, transaction } from "@/lib/db";

export interface DepartmentData {
  id?: string;
  factoryId: string;
  code: string;
  name: string;
  description?: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

export interface ModulePermissionData {
  moduleId: string;
  moduleCode?: string;
  moduleName?: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

export class DepartmentService {
  /**
   * Get all active departments
   */
  static async getDepartments(factoryId: string) {
    return await query(
      `SELECT d.id, d.factory_id, f.name as factory_name, d.code, d.name, d.description,
              d.is_admin, d.is_active, d.created_at, d.updated_at
       FROM departments d
       JOIN factories f ON f.id = d.factory_id
       WHERE d.deleted_at IS NULL AND d.factory_id = $1
       ORDER BY d.is_admin DESC, d.name ASC`,
      [factoryId]
    );
  }

  /**
   * Get department details with permissions by ID
   */
  static async getDepartmentById(id: string, factoryId: string) {
    const dept = await queryOne(
      `SELECT id, factory_id, code, name, description, is_admin, is_active 
       FROM departments 
       WHERE id = $1 AND factory_id = $2 AND deleted_at IS NULL`,
      [id, factoryId]
    );

    if (!dept) return null;

    const permissions = await query(
      `SELECT m.id as "moduleId", m.code as "moduleCode", m.name as "moduleName",
              COALESCE(p.can_view, false) as "canView",
              COALESCE(p.can_create, false) as "canCreate",
              COALESCE(p.can_update, false) as "canUpdate",
              COALESCE(p.can_delete, false) as "canDelete",
              COALESCE(p.can_approve, false) as "canApprove"
       FROM modules m
       LEFT JOIN department_module_permissions p ON p.module_id = m.id AND p.department_id = $1
       WHERE m.is_active = true
       ORDER BY m.sort_order ASC`,
      [id]
    );

    return {
      ...dept,
      permissions,
    };
  }

  /**
   * Create department with permissions
   */
  static async createDepartment(data: DepartmentData, permissions: ModulePermissionData[]) {
    return await transaction(async (client) => {
      // Insert department
      const deptRes = await client.query(
        `INSERT INTO departments (factory_id, code, name, description, is_admin, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, factory_id, code, name, description, is_admin, is_active`,
        [
          data.factoryId,
          data.code,
          data.name,
          data.description || null,
          data.isAdmin || false,
          data.isActive !== undefined ? data.isActive : true,
        ]
      );
      
      const newDept = deptRes.rows[0];

      // Insert permissions
      if (permissions && permissions.length > 0) {
        for (const perm of permissions) {
          await client.query(
            `INSERT INTO department_module_permissions 
             (department_id, module_id, can_view, can_create, can_update, can_delete, can_approve)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              newDept.id,
              perm.moduleId,
              perm.canView,
              perm.canCreate,
              perm.canUpdate,
              perm.canDelete,
              perm.canApprove,
            ]
          );
        }
      }

      return newDept;
    });
  }

  /**
   * Update department and permissions
   */
  static async updateDepartment(id: string, data: DepartmentData, permissions: ModulePermissionData[]) {
    return await transaction(async (client) => {
      // Update department
      const deptRes = await client.query(
        `UPDATE departments 
         SET code = $1, name = $2, description = $3, is_admin = $4, is_active = $5, updated_at = now()
         WHERE id = $6 AND factory_id = $7 AND deleted_at IS NULL
         RETURNING id, factory_id, code, name, description, is_admin, is_active`,
        [
          data.code,
          data.name,
          data.description || null,
          data.isAdmin || false,
          data.isActive !== undefined ? data.isActive : true,
          id,
          data.factoryId,
        ]
      );

      if (deptRes.rows.length === 0) {
        throw new Error("Department not found");
      }

      const updatedDept = deptRes.rows[0];

      // Update permissions - clear and insert
      await client.query(
        `DELETE FROM department_module_permissions WHERE department_id = $1`,
        [id]
      );

      if (permissions && permissions.length > 0) {
        for (const perm of permissions) {
          await client.query(
            `INSERT INTO department_module_permissions 
             (department_id, module_id, can_view, can_create, can_update, can_delete, can_approve)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              perm.moduleId,
              perm.canView,
              perm.canCreate,
              perm.canUpdate,
              perm.canDelete,
              perm.canApprove,
            ]
          );
        }
      }

      return updatedDept;
    });
  }

  /**
   * Soft delete department
   */
  static async deleteDepartment(id: string, factoryId: string) {
    // Check if it's the admin department
    const dept = await queryOne("SELECT code FROM departments WHERE id = $1 AND factory_id = $2", [id, factoryId]);
    if (dept && dept.code === "admin") {
      throw new Error("Cannot delete admin department");
    }

    await query(
      `UPDATE departments 
       SET deleted_at = now(), is_active = false 
       WHERE id = $1 AND factory_id = $2`,
      [id, factoryId]
    );
    return true;
  }
}
