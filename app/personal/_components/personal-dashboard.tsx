"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, CircleDollarSign, Clock3, ReceiptText, TrendingUp } from "lucide-react";
import { formatDate, formatVND } from "@/lib/format";
import PersonalShell from "./personal-shell";

interface PersonalDashboardProps { user: { displayName: string; factoryName: string; employeeId: string | null }; }

export default function PersonalDashboard({ user }: PersonalDashboardProps) {
  const [overview, setOverview] = useState<any>(null);
  const [payslip, setPayslip] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void fetch("/api/personal/overview").then((response) => response.json()).then((payload) => { if (!payload.success) throw new Error(payload.error?.message); setOverview(payload.data); }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu.")); }, []);

  const openPayslip = async (cycleId: string) => {
    const response = await fetch(`/api/personal/payslip?cycleId=${encodeURIComponent(cycleId)}`);
    const payload = await response.json();
    if (!payload.success) { setError(payload.error?.message || "Không thể tải phiếu lương."); return; }
    setPayslip(payload.data);
  };

  if (error) return <PersonalShell user={user}><ErrorState message={error} /></PersonalShell>;
  if (!overview) return <PersonalShell user={user}><div className="animate-pulse space-y-5"><div className="h-48 rounded-3xl bg-slate-200" /><div className="grid gap-4 sm:grid-cols-3"><div className="h-28 rounded-2xl bg-slate-200" /><div className="h-28 rounded-2xl bg-slate-200" /><div className="h-28 rounded-2xl bg-slate-200" /></div></div></PersonalShell>;

  const latestPayroll = overview.payrollHistory[0];
  const latestAttendance = overview.attendance[0];
  return <PersonalShell user={user}>
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-200 sm:p-9">
      <p className="text-sm font-bold tracking-wide text-blue-100">KHÔNG GIAN CÁ NHÂN</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Chào {overview.profile.fullName.split(" ").slice(-1)}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">Theo dõi lịch làm việc, thu nhập và thông tin của bạn ở một nơi.</p>
      <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold"><span className="rounded-full bg-white/15 px-3 py-1.5">{overview.profile.employeeCode}</span><span className="rounded-full bg-white/15 px-3 py-1.5">{overview.profile.departmentName || "Chưa phân bộ phận"}</span><span className="rounded-full bg-white/15 px-3 py-1.5">{overview.profile.positionTitle || "Nhân viên"}</span></div>
    </section>
    <section className="grid gap-4 sm:grid-cols-3">
      <Stat icon={<CircleDollarSign />} tone="emerald" label="Thực nhận gần nhất" value={latestPayroll ? `${formatVND(latestPayroll.netSalary)} đ` : "Chưa có"} detail={latestPayroll?.cycleName || "Chưa có kỳ lương chốt"} />
      <Stat icon={<CalendarDays />} tone="blue" label="Ngày công kỳ gần nhất" value={latestPayroll ? `${Number(latestPayroll.actualWorkdays || 0).toFixed(1)} công` : "--"} detail={latestPayroll ? `${Number(latestPayroll.overtimeHours || 0).toFixed(1)} giờ tăng ca` : ""} />
      <Stat icon={<Clock3 />} tone="violet" label="Lần chấm công mới nhất" value={latestAttendance ? formatDate(latestAttendance.workDate) : "Chưa có"} detail={latestAttendance ? `${latestAttendance.checkIn?.slice(0, 5) || "--:--"} – ${latestAttendance.checkOut?.slice(0, 5) || "--:--"}` : ""} />
    </section>
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Thu nhập đã chốt</h2><p className="mt-1 text-sm text-slate-500">Các kỳ lương của riêng bạn</p></div><ReceiptText className="h-6 w-6 text-emerald-600" /></div><div className="mt-5 space-y-3">{overview.payrollHistory.slice(0, 5).map((item: any) => <button key={item.cycleId} onClick={() => void openPayslip(item.cycleId)} className="group flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"><span><span className="block font-bold text-slate-900">{item.cycleName}</span><span className="mt-1 block text-xs text-slate-500">{formatDate(item.periodStart)} – {formatDate(item.periodEnd)} · {Number(item.actualWorkdays || 0).toFixed(1)} công</span></span><span className="flex items-center gap-2 font-black text-emerald-700">{formatVND(item.netSalary)} đ<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span></button>)}{overview.payrollHistory.length === 0 && <Empty text="Chưa có phiếu lương đã chốt." />}</div></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black">Thông tin lương</h2><p className="mt-1 text-sm text-slate-500">Tóm tắt kỳ gần nhất</p></div><TrendingUp className="h-6 w-6 text-blue-600" /></div>{latestPayroll ? <div className="mt-6 space-y-4"><SalaryLine label="Tổng thu nhập" value={latestPayroll.grossIncome} /><SalaryLine label="Khấu trừ" value={latestPayroll.totalDeduction} danger /><div className="border-t border-slate-200 pt-4"><SalaryLine label="Thực nhận" value={latestPayroll.netSalary} strong /></div><button onClick={() => void openPayslip(latestPayroll.cycleId)} className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700">Xem phiếu lương chi tiết</button></div> : <Empty text="Phiếu lương sẽ hiển thị sau khi kỳ lương được chốt." />}</div>
    </section>
    {payslip && <PayslipModal payslip={payslip} onClose={() => setPayslip(null)} />}
  </PersonalShell>;
}

function Stat({ icon, tone, label, value, detail }: any) { const tones: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-600", blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600" }; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>{icon}</div><p className="mt-4 text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p><p className="mt-1 min-h-5 text-xs text-slate-500">{detail}</p></div>; }
function SalaryLine({ label, value, danger, strong }: any) { return <div className={`flex items-center justify-between ${strong ? "text-lg font-black" : "text-sm"}`}><span className="text-slate-600">{label}</span><span className={danger ? "font-bold text-rose-600" : "font-bold text-slate-900"}>{formatVND(value)} đ</span></div>; }
function Empty({ text }: { text: string }) { return <p className="grid min-h-36 place-items-center text-center text-sm text-slate-500">{text}</p>; }
function ErrorState({ message }: { message: string }) { return <div className="grid min-h-[50vh] place-items-center rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">{message}</div>; }
function PayslipModal({ payslip, onClose }: any) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><button onClick={onClose} className="float-right text-sm font-bold text-slate-500">Đóng</button><p className="text-sm font-bold text-blue-600">PHIẾU LƯƠNG</p><h2 className="mt-1 text-2xl font-black">{payslip.cycle?.name}</h2><p className="mt-1 text-sm text-slate-500">{payslip.payrollItem.employeeName}</p><div className="mt-6 space-y-3">{payslip.lines.map((line: any) => <div key={line.id} className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm"><span>{line.lineName}</span><span className={line.lineType === "deduction" ? "font-bold text-rose-600" : "font-bold"}>{formatVND(line.amount)} đ</span></div>)}</div><div className="mt-5 flex justify-between rounded-2xl bg-emerald-50 p-4 text-lg font-black text-emerald-800"><span>Thực nhận</span><span>{formatVND(payslip.payrollItem.netSalary)} đ</span></div></div></div>; }
