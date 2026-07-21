import { redirect } from "next/navigation";
import { Building2, Sparkles, User } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-session";
import { getAccessibleFactories } from "@/lib/factory-scope";
import { query } from "@/lib/db";
import LogoutButton from "./_components/logout-button";
import ModuleDirectory, { type WorkspaceModule } from "./_components/module-directory";
import NewsPlaceholder from "./_components/news-placeholder";

type DatabaseModule = WorkspaceModule & {
  sortOrder: number;
};

export default async function ModulesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const canAccessPayroll = user.isAdmin || Boolean(user.permissions.payroll?.view);
  const [allModules, payrollFactories] = await Promise.all([
    query<DatabaseModule>(
      `SELECT id, code, name, description, route_path as "routePath", sort_order as "sortOrder"
       FROM modules
       WHERE is_active = true
       ORDER BY sort_order ASC`
    ),
    canAccessPayroll ? getAccessibleFactories(user) : Promise.resolve([]),
  ]);

  const allowedModules = user.isAdmin
    ? allModules
    : allModules.filter((module) => user.permissions[module.code]?.view);
  const authModule = allowedModules.find((module) => module.code === "auth");
  const payrollModule = allowedModules.find((module) => module.code === "payroll");
  const personalModule = user.employeeId ? allowedModules.find((module) => module.code === "personal") : undefined;

  const workspaceModules: WorkspaceModule[] = [
    ...(user.isSystemAdmin && authModule ? [authModule] : []),
    ...(personalModule ? [personalModule] : []),
    ...(payrollModule
      ? payrollFactories.map((factory: { id: string; name: string }) => ({
          ...payrollModule,
          id: `${payrollModule.id}-${factory.id}`,
          name: factory.name,
          routePath: `/payroll?factoryId=${factory.id}`,
        }))
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-600 text-sm font-black text-white shadow-sm">CT</div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-tight text-slate-950">IRT Eco</p>
              <p className="text-xs font-semibold text-slate-500">Internal Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:flex">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 shadow-sm"><User className="h-4 w-4" /></div>
              <div className="leading-tight">
                <p className="font-bold text-slate-900">{user.displayName}</p>
                <p className="text-xs font-medium text-slate-500">{user.isAdmin ? "Administrator" : user.departmentName || "Thành viên"}</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-7 sm:px-6 sm:py-10">
        <section className="border-b border-slate-200 pb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Không gian làm việc</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Chào, {user.displayName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Chọn phân hệ để bắt đầu công việc hôm nay.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <span className="text-slate-400">Nhà xưởng</span>
              <span className="text-slate-900">{user.factoryName}</span>
            </div>
          </div>
        </section>

        {workspaceModules.length === 0 ? (
          <section className="mt-8 max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 text-lg font-black text-slate-900">Chưa có phân hệ được cấp quyền</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Vui lòng liên hệ quản trị viên để được cấp quyền truy cập phù hợp.</p>
          </section>
        ) : (
          <div className="mt-8 space-y-10">
            <ModuleDirectory modules={workspaceModules} />
            <NewsPlaceholder />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-sm font-medium text-slate-500">
        <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-500" />© 2026 IRT Eco. Hệ thống quản lý nội bộ.</span>
      </footer>
    </div>
  );
}
