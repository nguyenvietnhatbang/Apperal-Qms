"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutGrid } from "lucide-react";

export default function PersonalShell({ user, children }: { user: { displayName: string; factoryName: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const overviewActive = pathname === "/personal";
  return <main className="min-h-screen bg-[#f5f7fb] text-slate-900"><header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6"><div className="min-w-0"><p className="truncate font-black">IRT Eco</p><p className="truncate text-[11px] font-semibold text-slate-500">{user.factoryName}</p></div><nav className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold sm:text-sm"><Link href="/personal" className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${overviewActive ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}><LayoutGrid className="h-4 w-4" />Tổng quan</Link><Link href="/personal/attendance" className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${!overviewActive ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}><CalendarDays className="h-4 w-4" />Chấm công</Link></nav><Link href="/modules" className="hidden rounded-lg px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 sm:block">Phân hệ</Link></div></header><div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">{children}</div></main>;
}
