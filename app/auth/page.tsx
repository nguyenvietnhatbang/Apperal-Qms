import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
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

  const hasAccess = user.isAdmin || Boolean(user.permissions.auth?.view);
  if (!hasAccess) {
    redirect("/modules");
  }

  const [factories, allDepartments, users, modules] = await Promise.all([
    user.isSystemAdmin
      ? FactoryService.getFactories(true)
      : FactoryService.getFactoryById(user.factoryId).then((factory) => factory ? [factory] : []),
    user.isSystemAdmin
      ? DepartmentService.getAllDepartments()
      : DepartmentService.getDepartments(user.factoryId),
    UserService.getUsers(user.isSystemAdmin ? undefined : user.factoryId),
    query(`SELECT id, code, name, description FROM modules WHERE is_active = true ORDER BY sort_order ASC`),
  ]);

  const departmentsByFactory = allDepartments.reduce<Record<string, any[]>>((result, department: any) => {
    const factoryId = department.factory_id;
    if (!result[factoryId]) result[factoryId] = [];
    result[factoryId].push(department);
    return result;
  }, {});
  const departments = departmentsByFactory[user.factoryId] || [];

  return (
    <AuthDashboardClient
      currentUser={user}
      initialDepartments={departments}
      initialUsers={users}
      initialFactories={factories}
      initialDepartmentsByFactory={departmentsByFactory}
      modules={modules}
    />
  );
}
