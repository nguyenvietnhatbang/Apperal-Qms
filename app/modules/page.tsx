import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { getAccessibleFactories } from "@/lib/factory-scope";
import { query } from "@/lib/db";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarRange,
  ClipboardList,
  Filter,
  Search,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import Link from "next/link";
import LogoutButton from "./_components/logout-button";

export default async function ModulesPage() {
  const user = await getCurrentUser();

  // If not authenticated, redirect to login
  if (!user) {
    redirect("/login");
  }

  const canAccessPayroll = user.isAdmin || Boolean(user.permissions.payroll?.view);
  const [allModules, payrollFactories] = await Promise.all([
    query(
      `SELECT id, code, name, description, route_path as "routePath", sort_order as "sortOrder"
       FROM modules
       WHERE is_active = true
       ORDER BY sort_order ASC`
    ),
    canAccessPayroll ? getAccessibleFactories(user) : Promise.resolve([]),
  ]);

  const allowedModules = user.isAdmin
    ? allModules
    : allModules.filter((mod) => {
        const perm = user.permissions[mod.code];
        return perm && perm.view;
      });
  const authModule = allowedModules.find((mod) => mod.code === "auth");
  const payrollModule = allowedModules.find((mod) => mod.code === "payroll");
  const personalModule = user.employeeId ? allowedModules.find((mod) => mod.code === "personal") : undefined;

  const getModuleIcon = (code: string) => {
    switch (code) {
      case "auth":
        return <ShieldCheck className="w-8 h-8 text-white" />;
      case "payroll":
        return <CalendarRange className="w-8 h-8 text-white" />;
      default:
        return <ClipboardList className="w-8 h-8 text-white" />;
    }
  };

  const getModuleAccent = (code: string) => {
    switch (code) {
      case "auth":
        return {
          icon: "bg-slate-600",
          border: "hover:border-blue-200 hover:shadow-blue-100",
        };
      case "payroll":
        return {
          icon: "bg-emerald-600",
          border: "hover:border-emerald-200 hover:shadow-emerald-100",
        };
      default:
        return {
          icon: "bg-blue-600",
          border: "hover:border-blue-200 hover:shadow-blue-100",
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center bg-emerald-600 text-base font-black text-white">
              CT
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-slate-950">IRT Eco</p>
              <p className="text-xs font-semibold text-slate-500">Internal Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                <User className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <p className="font-bold text-slate-900">{user.displayName}</p>
                <p className="text-xs font-medium text-slate-500">
                  {user.isAdmin ? "Administrator" : user.departmentName || "Thành viên"}
                </p>
                <p className="text-xs font-bold text-emerald-700">
                  {user.factoryName}
                </p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
              <BadgeCheck className="h-3.5 w-3.5" />
              <span>Workspace</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Chào buổi sáng, <span className="text-blue-600">{user.displayName}</span>
            </h1>
            <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-600">
              Chọn phân hệ cần xử lý. Các module hiển thị theo quyền truy cập của tài khoản hiện tại.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
              <span>Nhà xưởng hiện tại:</span>
              <span>{user.factoryName}</span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="relative min-w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                disabled
                placeholder="Tìm chức năng"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-500 shadow-sm outline-none"
              />
            </div>
            <button className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm">
              <Filter className="h-4 w-4" />
              <span>Bộ lọc</span>
            </button>
          </div>
        </div>

        <div className="mt-5 flex w-fit rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button className="rounded-md bg-white px-5 py-2 text-sm font-black text-blue-600 shadow-sm">
            Chức năng
          </button>
          <button className="rounded-md px-5 py-2 text-sm font-bold text-slate-500">
            Đánh dấu
          </button>
          <button className="rounded-md px-5 py-2 text-sm font-bold text-slate-500">
            Tất cả
          </button>
        </div>

        {!authModule && !personalModule && payrollFactories.length === 0 ? (
          <div className="mt-12 max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-black text-slate-900">Không có quyền truy cập</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tài khoản của bạn chưa được phân quyền truy cập vào bất kỳ phân hệ nào. Vui lòng liên hệ Admin để được cấp quyền.
            </p>
          </div>
        ) : (
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              ...(user.isSystemAdmin && authModule ? [authModule] : []),
              ...(personalModule ? [personalModule] : []),
              ...payrollFactories.map((factory: { id: string; name: string }) => ({
                ...payrollModule,
                id: `${payrollModule.id}-${factory.id}`,
                name: factory.name,
                description: payrollModule.description,
                routePath: `/payroll?factoryId=${factory.id}`,
                code: "payroll",
              })),
            ].map((mod) => {
              const accent = getModuleAccent(mod.code);

              return (
                <Link
                  key={mod.id}
                  href={mod.routePath}
                  className={`group relative flex min-h-[224px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${accent.border}`}
                >
                  <div className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-blue-600 opacity-0 transition group-hover:opacity-100">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <div className={`mb-6 flex h-[68px] w-[68px] items-center justify-center rounded-2xl ${accent.icon} shadow-sm`}>
                    {getModuleIcon(mod.code)}
                  </div>
                  <h3 className="text-2xl font-black tracking-tight text-slate-950">
                    {mod.name}
                  </h3>
                  <p className="mt-3 line-clamp-2 max-w-[250px] text-base font-medium leading-7 text-slate-500">
                    {mod.description}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200 py-6 text-center text-sm font-medium text-slate-500">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          © 2026 IRT Eco. Hệ thống quản lý nội bộ.
        </span>
      </footer>
    </div>
  );
}
