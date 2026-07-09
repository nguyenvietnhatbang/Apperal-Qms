import type { UserSessionData } from "@/lib/auth-session";
import { query, queryOne } from "@/lib/db";

export function resolveFactoryId(currentUser: UserSessionData, requestedFactoryId?: string | null) {
  if (currentUser.isSystemAdmin && requestedFactoryId) {
    return requestedFactoryId;
  }

  if (!currentUser.factoryId) {
    throw new Error("Tài khoản chưa được gán xưởng.");
  }

  return currentUser.factoryId;
}

export function canManageFactory(currentUser: UserSessionData, factoryId: string) {
  return currentUser.isSystemAdmin || currentUser.factoryId === factoryId;
}

export async function getAccessibleFactories(currentUser: UserSessionData) {
  if (currentUser.isSystemAdmin) {
    return await query(
      `SELECT id, code, name, description, is_active as "isActive"
       FROM factories
       WHERE deleted_at IS NULL AND is_active = true
       ORDER BY name ASC`
    );
  }

  return await query(
    `SELECT f.id, f.code, f.name, f.description, f.is_active as "isActive",
            m.department_id as "departmentId", d.name as "departmentName", d.is_admin as "departmentIsAdmin",
            m.is_default as "isDefault"
     FROM user_factory_memberships m
     JOIN factories f ON f.id = m.factory_id AND f.deleted_at IS NULL AND f.is_active = true
     LEFT JOIN departments d ON d.id = m.department_id AND d.factory_id = f.id AND d.deleted_at IS NULL AND d.is_active = true
     WHERE m.user_id = $1 AND m.is_active = true AND m.deleted_at IS NULL
     ORDER BY m.is_default DESC, f.name ASC`,
    [currentUser.id]
  );
}

export async function assertFactoryAccess(currentUser: UserSessionData, factoryId: string) {
  if (currentUser.isSystemAdmin) {
    const factory = await queryOne(
      `SELECT id, code, name, is_active as "isActive"
       FROM factories
       WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
      [factoryId]
    );
    if (!factory) throw new Error("Không tìm thấy xưởng hoặc xưởng đã ngừng hoạt động.");
    return factory;
  }

  const factory = await queryOne(
    `SELECT f.id, f.code, f.name, f.is_active as "isActive",
            m.department_id as "departmentId", d.name as "departmentName", d.is_admin as "departmentIsAdmin"
     FROM user_factory_memberships m
     JOIN factories f ON f.id = m.factory_id AND f.deleted_at IS NULL AND f.is_active = true
     LEFT JOIN departments d ON d.id = m.department_id AND d.factory_id = f.id AND d.deleted_at IS NULL AND d.is_active = true
     WHERE m.user_id = $1 AND m.factory_id = $2 AND m.is_active = true AND m.deleted_at IS NULL`,
    [currentUser.id, factoryId]
  );

  if (!factory) {
    throw new Error("Bạn không có quyền truy cập xưởng này.");
  }

  return factory;
}

export async function resolveAccessibleFactoryId(currentUser: UserSessionData, requestedFactoryId?: string | null) {
  if (requestedFactoryId) {
    await assertFactoryAccess(currentUser, requestedFactoryId);
    return requestedFactoryId;
  }

  const factories = await getAccessibleFactories(currentUser);
  const defaultFactory = factories.find((factory: any) => factory.isDefault) || factories[0];
  if (!defaultFactory) {
    throw new Error("Tài khoản chưa được cấp quyền vào xưởng nào.");
  }

  return defaultFactory.id;
}
