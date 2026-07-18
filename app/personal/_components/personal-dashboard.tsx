"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock3, FileText, Loader2, LogOut, ReceiptText, UserRound } from "lucide-react";
import { formatDate, formatVND } from "@/lib/format";

interface PersonalDashboardProps {
  user: { displayName: string; factoryName: string; employeeId: string | null };
}

export default function PersonalDashboard({ user }: PersonalDashboardProps) {
  const [overview, setOverview] = useState<any>(null);
  const [payslip, setPayslip] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const response = await fetch("/api/personal/overview");
        const payload = await response.json();
        if (!payload.success) throw new Error(payload.error?.message || "Không thể tải dữ liệu cá nhân.");
        setOverview(payload.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu cá nhân.");
      } finally {
        setIsLoading(false);
      }
    };
    void loadOverview();
  }, []);

  const openPayslip = async (cycleId: string) => {
    try {
      const response = await fetch(`/api/personal/payslip?cycleId=${encodeURIComponent(cycleId)}`);
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error?.message || "Không thể tải phiếu lương.");
      setPayslip(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải phiếu lương.");
    }
  };

  if (isLoading) return <div className="min-h-screen grid place-items-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (error || !overview) return <div className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center text-red-700">{error || "Không có dữ liệu cá nhân."}</div>;

  const latestPayroll = overview.payrollHistory[0];
  const workedDays = overview.attendance.reduce((total: number, item: any) => total + Number(item.workdayCount || 0), 0);
  const overtimeHours = overview.attendance.reduce((total: number, item: any) => total + Number(item.overtimeHours || 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div><p className="text-lg font-black">IRT Eco</p><p className="text-xs font-semibold text-slate-500">Cổng thông tin cá nhân · {user.factoryName}</p></div>
          <Link href="/modules" className="text-sm font-bold text-blue-700 hover:text-blue-900">Về phân hệ</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
          <p className="text-sm font-bold text-blue-200">HỒ SƠ NHÂN VIÊN</p>
          <h1 className="mt-2 text-3xl font-black">Chào, {overview.profile.fullName}</h1>
          <p className="mt-2 text-slate-300">{overview.profile.employeeCode} · {overview.profile.positionTitle || "Nhân viên"} · {overview.profile.departmentName || "Chưa phân bộ phận"}</p>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          <Metric icon={<CalendarDays />} label="Công 31 ngày gần nhất" value={`${workedDays.toFixed(1)} công`} />
          <Metric icon={<Clock3 />} label="Tăng ca 31 ngày gần nhất" value={`${overtimeHours.toFixed(1)} giờ`} />
          <Metric icon={<ReceiptText />} label="Lương thực nhận gần nhất" value={latestPayroll ? formatVND(latestPayroll.netSalary) : "Chưa có"} />
        </section>
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Clock3 className="h-5 w-5 text-blue-600" /> Chấm công gần đây</h2>
            <div className="mt-4 space-y-2">
              {overview.attendance.slice(0, 10).map((item: any) => <div key={item.workDate} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-slate-100 py-3 text-sm"><span className="font-semibold">{formatDate(item.workDate)}</span><span>{Number(item.workdayCount || 0).toFixed(1)} công</span><span className="text-slate-500">{item.checkIn?.slice(0, 5) || "--:--"} – {item.checkOut?.slice(0, 5) || "--:--"}</span></div>)}
              {overview.attendance.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Chưa có dữ liệu chấm công.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><FileText className="h-5 w-5 text-emerald-600" /> Phiếu lương đã chốt</h2>
            <div className="mt-4 space-y-3">
              {overview.payrollHistory.map((item: any) => <button key={item.cycleId} onClick={() => void openPayslip(item.cycleId)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50"><span><span className="block font-bold">{item.cycleName}</span><span className="text-xs text-slate-500">{formatDate(item.periodStart)} – {formatDate(item.periodEnd)}</span></span><span className="font-black text-emerald-700">{formatVND(item.netSalary)}</span></button>)}
              {overview.payrollHistory.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Chưa có phiếu lương đã chốt.</p>}
            </div>
          </div>
        </section>
      </div>
      {payslip && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><button onClick={() => setPayslip(null)} className="float-right text-sm font-bold text-slate-500">Đóng</button><h2 className="text-xl font-black">Phiếu lương {payslip.cycle?.name}</h2><p className="mt-1 text-sm text-slate-500">{payslip.payrollItem.employeeName}</p><div className="mt-5 space-y-2">{payslip.lines.map((line: any) => <div key={line.id} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{line.lineName}</span><span className={line.lineType === "deduction" ? "text-red-600" : "font-semibold"}>{formatVND(line.amount)}</span></div>)}</div><div className="mt-5 flex justify-between border-t pt-4 text-lg font-black"><span>Thực nhận</span><span className="text-emerald-700">{formatVND(payslip.payrollItem.netSalary)}</span></div></div></div>}
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-sm font-bold text-slate-500">{icon}{label}</div><p className="mt-3 text-2xl font-black text-slate-900">{value}</p></div>;
}
