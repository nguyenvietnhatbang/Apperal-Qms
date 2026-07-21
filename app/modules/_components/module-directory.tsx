"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarRange,
  ClipboardList,
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
    case "personal":
      return { label: "Cá nhân", icon: UserRound, iconClassName: "bg-blue-600 text-white" };
    default:
      return { label: "Phân hệ", icon: ClipboardList, iconClassName: "bg-blue-600 text-white" };
  }
}

export default function ModuleDirectory({ modules }: ModuleDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const visibleModules = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase("vi-VN");

    if (!normalizedSearchTerm) return modules;

    return modules.filter((module) =>
      `${module.name} ${module.description}`.toLocaleLowerCase("vi-VN").includes(normalizedSearchTerm)
    );
  }, [modules, searchTerm]);

  return (
    <section aria-labelledby="workspace-modules-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Danh mục</p>
            <div className="mt-1 flex items-center gap-2">
              <h2 id="workspace-modules-heading" className="text-xl font-black tracking-tight text-slate-950">Phân hệ của bạn</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                {modules.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Các phân hệ được cấp quyền truy cập.</p>
          </div>

          <div className="w-full sm:w-72">
            <label className="relative block" aria-label="Tìm phân hệ">
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
          </div>
      </div>

      <div className="mt-5">
        {visibleModules.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-5 text-center">
            <Search className="h-6 w-6 text-slate-300" />
            <p className="mt-3 font-bold text-slate-700">Không tìm thấy phân hệ phù hợp</p>
            <button type="button" onClick={() => setSearchTerm("")} className="mt-2 text-sm font-bold text-blue-700 hover:text-blue-800">
              Xóa tìm kiếm
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleModules.map((module) => {
              const appearance = getModuleAppearance(module.code);
              const Icon = appearance.icon;

              return (
                <Link
                  key={module.id}
                  href={module.routePath}
                  className="group flex min-h-40 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`grid h-11 w-11 place-items-center rounded-xl shadow-sm ${appearance.iconClassName}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:text-blue-600" />
                  </div>
                  <div className="mt-4">
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{appearance.label}</span>
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
