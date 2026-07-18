"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarDays, LayoutGrid, Sparkles } from "lucide-react";

export default function PersonalShell({ user, children }: { user: { displayName: string; factoryName: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const overviewActive = pathname === "/personal";
  return <main className="min-h-screen bg-[#f3f0e9] text-stone-950 lg:flex">
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#191815] p-5 text-white lg:flex">
      <div className="flex items-center gap-3 border-b border-white/10 pb-5"><div className="grid h-10 w-10 place-items-center bg-orange-500 font-black text-stone-950">IR</div><div><p className="font-black tracking-tight">IRT Eco</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Personal workspace</p></div></div>
      <div className="mt-6"><p className="text-xs font-bold text-stone-500">Đăng nhập bởi</p><p className="mt-1 truncate text-sm font-black">{user.displayName}</p><p className="mt-0.5 truncate text-xs text-stone-400">{user.factoryName}</p></div>
      <nav className="mt-8 grid gap-1.5"><NavLink href="/personal" active={overviewActive} icon={<LayoutGrid />} label="Tổng quan cá nhân" /><NavLink href="/personal/attendance" active={!overviewActive} icon={<CalendarDays />} label="Lịch chấm công" /></nav>
      <div className="mt-auto"><div className="mb-4 border border-white/10 bg-white/5 p-4"><Sparkles className="h-4 w-4 text-orange-400" /><p className="mt-2 text-xs font-bold leading-5 text-stone-300">Mọi dữ liệu lương và chấm công chỉ hiển thị cho chính bạn.</p></div><Link href="/modules" className="flex items-center gap-2 py-2 text-sm font-black text-stone-300 hover:text-orange-400"><ArrowLeft className="h-4 w-4" />Quay lại phân hệ</Link></div>
    </aside>

    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-stone-300 bg-[#f3f0e9]/95 px-4 py-3 backdrop-blur lg:hidden"><div><p className="font-black">IRT Eco</p><p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Personal workspace</p></div><Link href="/modules" className="text-xs font-black text-orange-700">Phân hệ</Link></header>
      <div className="mx-auto max-w-[1500px] space-y-5 px-3 py-4 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:pb-8">{children}</div>
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-2 border border-stone-300 bg-[#fffdf8]/95 p-1 shadow-2xl backdrop-blur lg:hidden"><MobileNav href="/personal" active={overviewActive} icon={<LayoutGrid />} label="Tổng quan" /><MobileNav href="/personal/attendance" active={!overviewActive} icon={<CalendarDays />} label="Chấm công" /></nav>
    </div>
  </main>;
}

function NavLink({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) { return <Link href={href} className={`flex items-center gap-3 px-3 py-3 text-sm font-black transition [&>svg]:h-4 [&>svg]:w-4 ${active ? "bg-orange-500 text-stone-950" : "text-stone-400 hover:bg-white/5 hover:text-white"}`}>{icon}{label}</Link>; }
function MobileNav({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) { return <Link href={href} className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-black [&>svg]:h-4 [&>svg]:w-4 ${active ? "bg-stone-950 text-white" : "text-stone-500"}`}>{icon}{label}</Link>; }
