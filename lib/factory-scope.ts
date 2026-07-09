import type { UserSessionData } from "@/lib/auth-session";

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
