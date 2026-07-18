"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarDays, ChartNoAxesCombined, LayoutGrid, Sparkles } from "lucide-react";

type PersonalView = "overview" | "attendance" | "salary";

export default function PersonalShell({ user, children, activeView, onViewChange }: { user: { displayName: string; factoryName: string }; children: React.ReactNode; activeView?: PersonalView; onViewChange?: (view: PersonalView) => void }) {
  const pathname = usePathname();
  const overviewActive = activeView ? activeView === "overview" : pathname === "/personal";
  return <main className="min-h-screen bg-slate-50 text-slate-950 lg:flex">
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-slate-950 p-5 text-white lg:flex">
      <div className="flex items-center gap-3 border-b border-white/10 pb-5"><div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-600 font-black text-white">CT</div><div><p className="font-black tracking-tight">IRT Eco</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Personal workspace</p></div></div>
      <div className="mt-6"><p className="text-xs font-bold text-slate-500">Đăng nhập bởi</p><p className="mt-1 truncate text-sm font-black">{user.displayName}</p><p className="mt-0.5 truncate text-xs text-slate-400">{user.factoryName}</p></div>
      <nav className="mt-8 grid gap-1.5"><NavLink href="/personal" active={overviewActive} icon={<LayoutGrid />} label="Tổng quan cá nhân" onActivate={onViewChange ? () => onViewChange("overview") : undefined} /><NavLink href="/personal/attendance" active={activeView ? activeView === "attendance" : pathname.endsWith("/attendance")} icon={<CalendarDays />} label="Lịch chấm công" onActivate={onViewChange ? () => onViewChange("attendance") : undefined} /><NavLink href="/personal/salary-history" active={activeView ? activeView === "salary" : pathname.endsWith("/salary-history")} icon={<ChartNoAxesCombined />} label="Hành trình lương" onActivate={onViewChange ? () => onViewChange("salary") : undefined} /></nav>
      <div className="mt-auto"><div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4"><Sparkles className="h-4 w-4 text-emerald-400" /><p className="mt-2 text-xs font-bold leading-5 text-slate-300">Mọi dữ liệu lương và chấm công chỉ hiển thị cho chính bạn.</p></div><Link href="/modules" className="flex items-center gap-2 py-2 text-sm font-black text-slate-300 hover:text-emerald-400"><ArrowLeft className="h-4 w-4" />Quay lại phân hệ</Link></div>
    </aside>

    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-300 bg-[#f8fafc]/95 px-4 py-3 backdrop-blur lg:hidden"><div><p className="font-black">IRT Eco</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Personal workspace</p></div><Link href="/modules" className="text-xs font-black text-emerald-700">Phân hệ</Link></header>
      <div className="mx-auto max-w-[1500px] space-y-5 px-3 py-4 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:pb-8">{children}</div>
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 rounded-xl border border-slate-300 bg-white/95 p-1 shadow-2xl backdrop-blur lg:hidden"><MobileNav href="/personal" active={overviewActive} icon={<LayoutGrid />} label="Tổng quan" onActivate={onViewChange ? () => onViewChange("overview") : undefined} /><MobileNav href="/personal/attendance" active={activeView ? activeView === "attendance" : pathname.endsWith("/attendance")} icon={<CalendarDays />} label="Chấm công" onActivate={onViewChange ? () => onViewChange("attendance") : undefined} /><MobileNav href="/personal/salary-history" active={activeView ? activeView === "salary" : pathname.endsWith("/salary-history")} icon={<ChartNoAxesCombined />} label="Lương" onActivate={onViewChange ? () => onViewChange("salary") : undefined} /></nav>
    </div>
  </main>;
}

function NavLink({ href, active, icon, label, onActivate }: { href: string; active: boolean; icon: React.ReactNode; label: string; onActivate?: () => void }) { const className = `flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-black transition [&>svg]:h-4 [&>svg]:w-4 ${active ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`; return onActivate ? <button type="button" onClick={onActivate} className={className}>{icon}{label}</button> : <Link href={href} className={className}>{icon}{label}</Link>; }
function MobileNav({ href, active, icon, label, onActivate }: { href: string; active: boolean; icon: React.ReactNode; label: string; onActivate?: () => void }) { const className = `flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-black [&>svg]:h-4 [&>svg]:w-4 ${active ? "bg-slate-950 text-white" : "text-slate-500"}`; return onActivate ? <button type="button" onClick={onActivate} className={className}>{icon}{label}</button> : <Link href={href} className={className}>{icon}{label}</Link>; }
