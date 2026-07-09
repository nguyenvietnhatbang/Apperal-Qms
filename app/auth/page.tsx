import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { PermissionService } from "@/features/auth/services/permission-service";
import { DepartmentService } from "@/features/admin/services/department-service";
import { UserService } from "@/features/admin/services/user-service";
import { FactoryService } from "@/features/admin/services/factory-service";
import { query } from "@/lib/db";
import AuthDashboardClient from "./_components/auth-dashboard-client";

export default async function AuthModulePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const hasAccess = await PermissionService.hasModuleAccess("auth");
  if (!hasAccess) {
    redirect("/modules");
  }

  // Preload data on server side
  const factories = user.isSystemAdmin
    ? await FactoryService.getFactories(true)
    : [await FactoryService.getFactoryById(user.factoryId)].filter(Boolean);
  const departments = await DepartmentService.getDepartments(user.factoryId);
  const users = await UserService.getUsers(user.isSystemAdmin ? undefined : user.factoryId);
  
  // Get all active modules for permission mapping
  const modules = await query(
    `SELECT id, code, name, description FROM modules WHERE is_active = true ORDER BY sort_order ASC`
  );

  return (
    <AuthDashboardClient
      currentUser={user}
      initialDepartments={departments}
      initialUsers={users}
      initialFactories={factories}
      modules={modules}
    />
  );
}
