import Link from "next/link";
import { CalendarDays, LayoutGrid } from "lucide-react";

export default function PersonalShell({ user, children }: { user: { displayName: string; factoryName: string }; children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#f6f8fc] text-slate-900"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"><div><p className="font-black">IRT Eco</p><p className="text-xs font-semibold text-slate-500">{user.factoryName}</p></div><nav className="flex rounded-xl bg-slate-100 p-1 text-sm font-bold"><Link href="/personal" className="flex items-center gap-1.5 rounded-lg px-3 py-2 hover:bg-white"><LayoutGrid className="h-4 w-4" />Tổng quan</Link><Link href="/personal/attendance" className="flex items-center gap-1.5 rounded-lg px-3 py-2 hover:bg-white"><CalendarDays className="h-4 w-4" />Chấm công</Link></nav><Link href="/modules" className="hidden text-sm font-bold text-blue-700 sm:block">Phân hệ</Link></div></header><div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">{children}</div></main>;
}
