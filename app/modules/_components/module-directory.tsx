"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  Filter,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

export type WorkspaceModule = {
  id: string;
  name: string;
  description: string;
  routePath: string;
  code: string;
};

type ModuleDirectoryProps = {
  modules: WorkspaceModule[];
};

type ModuleAppearance = {
  label: string;
  icon: typeof ClipboardList;
  iconClassName: string;
};

function getModuleAppearance(code: string): ModuleAppearance {
  switch (code) {
    case "auth":
      return { label: "Quản trị", icon: ShieldCheck, iconClassName: "bg-slate-900 text-white" };
    case "payroll":
      return { label: "Vận hành", icon: CalendarRange, iconClassName: "bg-emerald-600 text-white" };
    case "leave_requests":
      return { label: "Phê duyệt", icon: CheckSquare, iconClassName: "bg-amber-500 text-white" };
    case "personal":
      return { label: "Cá nhân", icon: UserRound, iconClassName: "bg-blue-600 text-white" };
    default:
      return { label: "Phân hệ", icon: ClipboardList, iconClassName: "bg-blue-600 text-white" };
  }
}

export default function ModuleDirectory({ modules }: ModuleDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const visibleModules = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase("vi-VN");

    if (!normalizedSearchTerm) return modules;

    return modules.filter((module) =>
      `${module.name} ${module.description}`.toLocaleLowerCase("vi-VN").includes(normalizedSearchTerm)
    );
  }, [modules, searchTerm]);

  return (
    <section aria-labelledby="workspace-modules-heading" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="workspace-modules-heading" className="text-lg font-black tracking-tight text-slate-950">
                Phân hệ truy cập
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                {modules.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Chọn phân hệ để tiếp tục công việc.</p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <label className="relative block min-w-0 sm:w-72" aria-label="Tìm phân hệ">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm phân hệ"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <button
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((isVisible) => !isVisible)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              Bộ lọc
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
            <span>Đang hiển thị tất cả phân hệ được cấp quyền.</span>
            <button type="button" onClick={() => setShowFilters(false)} className="font-bold text-blue-700 hover:text-blue-800">
              Đóng
            </button>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4">
        {visibleModules.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 text-center">
            <Search className="h-6 w-6 text-slate-300" />
            <p className="mt-3 font-bold text-slate-700">Không tìm thấy phân hệ phù hợp</p>
            <button type="button" onClick={() => setSearchTerm("")} className="mt-2 text-sm font-bold text-blue-700 hover:text-blue-800">
              Xóa tìm kiếm
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleModules.map((module) => {
              const appearance = getModuleAppearance(module.code);
              const Icon = appearance.icon;

              return (
                <Link
                  key={module.id}
                  href={module.routePath}
                  className="group flex min-h-36 items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-sm ${appearance.iconClassName}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{appearance.label}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-600" />
                    </div>
                    <h3 className="mt-1 truncate text-base font-black text-slate-900">{module.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{module.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
