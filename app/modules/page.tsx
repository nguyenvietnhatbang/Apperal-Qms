import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { query } from "@/lib/db";
import { ShieldCheck, CalendarRange, LogOut, ArrowRight, User } from "lucide-react";
import Link from "next/link";
import LogoutButton from "./_components/logout-button";

export default async function ModulesPage() {
  const user = await getCurrentUser();

  // If not authenticated, redirect to login
  if (!user) {
    redirect("/login");
  }

  // Get allowed modules
  const allModules = await query(
    `SELECT id, code, name, description, route_path as "routePath", sort_order as "sortOrder" 
     FROM modules 
     WHERE is_active = true 
     ORDER BY sort_order ASC`
  );

  const allowedModules = user.isAdmin
    ? allModules
    : allModules.filter((mod) => {
        const perm = user.permissions[mod.code];
        return perm && perm.view;
      });

  const getModuleIcon = (code: string) => {
    switch (code) {
      case "auth":
        return <ShieldCheck className="w-8 h-8 text-blue-500" />;
      case "payroll":
        return <CalendarRange className="w-8 h-8 text-emerald-500" />;
      default:
        return <ShieldCheck className="w-8 h-8 text-slate-500" />;
    }
  };

  const getModuleGradient = (code: string) => {
    switch (code) {
      case "auth":
        return "hover:border-blue-500/50 hover:shadow-blue-500/5";
      case "payroll":
        return "hover:border-emerald-500/50 hover:shadow-emerald-500/5";
      default:
        return "hover:border-slate-500/50 hover:shadow-slate-500/5";
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Glow decorative shapes */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-violet-600 rounded-lg flex items-center justify-center font-bold text-lg text-white shadow-md">
            CF
          </div>
          <div>
            <h2 className="text-md font-bold tracking-tight">Aparel</h2>
            <p className="text-xs text-slate-500">Internal Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-sm">
            <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-slate-300">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="font-medium">{user.displayName}</span>
            <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md">
              {user.isAdmin ? "Admin" : user.departmentName || "Nhân viên"}
            </span>
          </div>

          <LogoutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            Chọn Phân Hệ Làm Việc
          </h1>
          <p className="text-slate-400 text-md max-w-md mx-auto">
            Chào mừng quay trở lại! Vui lòng chọn một phân hệ bên dưới để bắt đầu công việc của bạn.
          </p>
        </div>

        {allowedModules.length === 0 ? (
          <div className="w-full bg-slate-900/40 border border-slate-900 rounded-2xl p-8 text-center max-w-md">
            <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-md font-semibold text-slate-300">Không có quyền truy cập</h3>
            <p className="text-sm text-slate-500 mt-1.5">
              Tài khoản của bạn chưa được phân quyền truy cập vào bất kỳ phân hệ nào. Vui lòng liên hệ Admin để được cấp quyền.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {allowedModules.map((mod) => (
              <Link
                key={mod.id}
                href={mod.routePath}
                className={`group relative bg-slate-900/30 hover:bg-slate-900/50 border border-slate-900 rounded-2xl p-6 shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[180px] ${getModuleGradient(mod.code)}`}
              >
                <div>
                  <div className="w-12 h-12 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300 mb-4">
                    {getModuleIcon(mod.code)}
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors duration-200">
                    {mod.name}
                  </h3>
                  <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                    {mod.description}
                  </p>
                </div>
                <div className="flex items-center justify-end text-xs text-blue-500 font-semibold group-hover:translate-x-1 transition-transform duration-300 mt-4 gap-1">
                  <span>Vào phân hệ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-6 text-center text-xs text-slate-600 border-t border-slate-900">
        &copy; 2026 Cẩm Thiên. Hệ thống quản lý nhân sự bảo mật.
      </footer>
    </div>
  );
}
