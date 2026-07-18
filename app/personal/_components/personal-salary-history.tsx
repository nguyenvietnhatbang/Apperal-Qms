"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CircleDollarSign, FileText, Landmark, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatVND } from "@/lib/format";
import type { PayrollSummary, PersonalOverview } from "@/features/personal/types";
import { PayslipDialog } from "./personal-salary-dialogs";

export default function PersonalSalaryHistory({ overview }: { overview: PersonalOverview }) {
  const [selectedYear, setSelectedYear] = useState("all");
  const [payslip, setPayslip] = useState<any>(null);
  const [loadingCycleId, setLoadingCycleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const years = useMemo(() => Array.from(new Set(overview.payrollHistory.map((item) => String(item.periodEnd).slice(0, 4)))).sort((left, right) => right.localeCompare(left)), [overview.payrollHistory]);
  const payrolls = useMemo(() => selectedYear === "all" ? overview.payrollHistory : overview.payrollHistory.filter((item) => String(item.periodEnd).startsWith(selectedYear)), [overview.payrollHistory, selectedYear]);
  const chartData = useMemo(() => [...payrolls].reverse().map((item) => ({ name: shortCycleName(item), netSalary: Number(item.netSalary || 0), grossIncome: Number(item.grossIncome || 0), totalDeduction: Number(item.totalDeduction || 0) })), [payrolls]);
  const totalNet = payrolls.reduce((sum, item) => sum + Number(item.netSalary || 0), 0);
  const averageNet = payrolls.length > 0 ? totalNet / payrolls.length : 0;
  const highestNet = payrolls.reduce((highest, item) => Math.max(highest, Number(item.netSalary || 0)), 0);

  const openPayslip = async (cycleId: string) => {
    setLoadingCycleId(cycleId);
    setError(null);
    try {
      const response = await fetch(`/api/personal/payslip?cycleId=${encodeURIComponent(cycleId)}`);
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error?.message || "Không thể tải phiếu lương.");
      setPayslip(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải phiếu lương.");
    } finally {
      setLoadingCycleId(null);
    }
  };

  return <>
    <section className="border-b border-stone-300 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Lifetime salary data</p><h1 className="mt-1 text-3xl font-black tracking-tight">Hành trình lương</h1><p className="mt-1 text-sm text-stone-500">Toàn bộ kết quả lương và thay đổi cấu hình của {overview.profile.fullName}.</p></div><label className="text-xs font-black text-stone-500">Năm<select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} className="ml-2 border border-stone-400 bg-[#fffdf8] px-3 py-2 text-sm font-black text-stone-950 outline-none focus:border-orange-500"><option value="all">Tất cả</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div>
    </section>

    {error && <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

    <section className="grid grid-cols-2 gap-2 xl:grid-cols-4"><HistoryMetric icon={<FileText />} label="Số kỳ đã chốt" value={String(payrolls.length)} /><HistoryMetric icon={<CircleDollarSign />} label="Tổng thực nhận" value={`${formatVND(totalNet)} đ`} /><HistoryMetric icon={<Landmark />} label="Thực nhận bình quân" value={`${formatVND(averageNet)} đ`} /><HistoryMetric icon={<TrendingUp />} label="Mức cao nhất" value={`${formatVND(highestNet)} đ`} /></section>

    <section className="border border-stone-300 bg-[#fffdf8] p-4 shadow-sm sm:p-5"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-stone-400">Salary movement</p><h2 className="mt-1 text-lg font-black">Biến động thu nhập qua các kỳ</h2></div>{chartData.length > 0 ? <div className="mt-4 h-72 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="netSalaryFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.32} /><stop offset="100%" stopColor="#f97316" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e7e5e4" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#78716c" }} /><YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000)}tr`} tickLine={false} axisLine={false} width={42} tick={{ fontSize: 11, fill: "#78716c" }} /><Tooltip formatter={(value, name) => [`${formatVND(Number(value))} đ`, chartLabel(String(name))]} contentStyle={{ borderRadius: 0, border: "1px solid #a8a29e", background: "#fffdf8" }} /><Area type="monotone" dataKey="grossIncome" stroke="#0ea5e9" fill="none" strokeWidth={1.5} /><Area type="monotone" dataKey="netSalary" stroke="#f97316" fill="url(#netSalaryFill)" strokeWidth={2.5} /><Area type="monotone" dataKey="totalDeduction" stroke="#e11d48" fill="none" strokeWidth={1.5} /></AreaChart></ResponsiveContainer></div> : <EmptyState text="Chưa có dữ liệu lương cho năm đã chọn." />}<div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-stone-500"><Legend color="bg-orange-500" label="Thực nhận" /><Legend color="bg-sky-500" label="Tổng thu nhập" /><Legend color="bg-rose-600" label="Khấu trừ" /></div></section>

    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,0.5fr)]">
      <SalaryHistoryTable payrolls={payrolls} loadingCycleId={loadingCycleId} onOpenPayslip={openPayslip} />
      <SalaryConfigurationTimeline overview={overview} />
    </div>

    {payslip && <PayslipDialog payslip={payslip} onClose={() => setPayslip(null)} />}
  </>;
}

function SalaryHistoryTable({ payrolls, loadingCycleId, onOpenPayslip }: { payrolls: PayrollSummary[]; loadingCycleId: string | null; onOpenPayslip: (cycleId: string) => Promise<void> }) {
  if (payrolls.length === 0) return <section className="border border-stone-300 bg-[#fffdf8]"><EmptyState text="Chưa có phiếu lương đã chốt." /></section>;
  return <section className="overflow-hidden border border-stone-300 bg-[#fffdf8] shadow-sm"><header className="border-b border-stone-200 px-4 py-3"><p className="text-xs font-black uppercase tracking-[0.15em] text-stone-400">Payroll records</p><h2 className="mt-1 text-lg font-black">Chi tiết từng kỳ</h2></header><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] border-collapse text-sm"><thead><tr className="border-b border-stone-200 bg-[#ebe6dc] text-left text-[10px] font-black uppercase tracking-wide text-stone-500"><th className="px-4 py-3">Kỳ lương</th><th className="px-3 py-3 text-right">Ngày công</th><th className="px-3 py-3 text-right">Tổng thu nhập</th><th className="px-3 py-3 text-right">Khấu trừ</th><th className="px-3 py-3 text-right">Thực nhận</th><th className="px-3 py-3 text-center">Trạng thái</th><th className="px-4 py-3 text-right">Phiếu lương</th></tr></thead><tbody>{payrolls.map((item) => <tr key={item.cycleId} className="border-b border-stone-100 last:border-0 hover:bg-orange-50/50"><td className="px-4 py-3"><p className="font-black">{item.cycleName}</p><p className="mt-0.5 text-xs text-stone-500">{formatDate(item.periodStart)} – {formatDate(item.periodEnd)}</p></td><td className="px-3 py-3 text-right font-bold">{Number(item.actualWorkdays || 0).toFixed(1)}</td><td className="px-3 py-3 text-right font-bold">{formatVND(item.grossIncome || 0)} đ</td><td className="px-3 py-3 text-right font-bold text-rose-600">{formatVND(item.totalDeduction || 0)} đ</td><td className="px-3 py-3 text-right font-black text-emerald-700">{formatVND(item.netSalary || 0)} đ</td><td className="px-3 py-3 text-center"><Status status={item.status} /></td><td className="px-4 py-3 text-right"><button disabled={loadingCycleId === item.cycleId} onClick={() => void onOpenPayslip(item.cycleId)} className="inline-flex items-center gap-1 border border-stone-300 px-2.5 py-1.5 text-xs font-black hover:border-orange-500 hover:text-orange-700 disabled:opacity-50">{loadingCycleId === item.cycleId ? "Đang tải" : "Xem"}<ArrowUpRight className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table></div><div className="grid gap-2 p-3 md:hidden">{payrolls.map((item) => <button key={item.cycleId} disabled={loadingCycleId === item.cycleId} onClick={() => void onOpenPayslip(item.cycleId)} className="border border-stone-200 bg-white p-3 text-left"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{item.cycleName}</p><p className="mt-0.5 text-xs text-stone-500">{formatDate(item.periodStart)} – {formatDate(item.periodEnd)}</p></div><Status status={item.status} /></div><div className="mt-3 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3"><MobileValue label="Thu nhập" value={formatVND(item.grossIncome || 0)} /><MobileValue label="Khấu trừ" value={formatVND(item.totalDeduction || 0)} /><MobileValue label="Thực nhận" value={formatVND(item.netSalary || 0)} strong /></div></button>)}</div></section>;
}

function SalaryConfigurationTimeline({ overview }: { overview: PersonalOverview }) { return <section className="border border-stone-300 bg-[#fffdf8] p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.15em] text-stone-400">Salary configuration</p><h2 className="mt-1 text-lg font-black">Lịch sử mức lương</h2>{overview.salaryConfigHistory.length > 0 ? <div className="mt-4 border-l border-stone-300 pl-4">{overview.salaryConfigHistory.map((config, index) => <div key={`${config.effectiveFrom}-${index}`} className="relative border-b border-stone-100 py-4 first:pt-0 last:border-0 last:pb-0"><span className={`absolute -left-[21px] top-5 h-2.5 w-2.5 rounded-full ${config.isCurrent ? "bg-orange-500 ring-4 ring-orange-100" : "bg-stone-400"}`} /><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-stone-500">Từ {formatDate(config.effectiveFrom)}{config.effectiveTo ? ` đến ${formatDate(config.effectiveTo)}` : ""}</p><p className="mt-1 text-xl font-black">{formatVND(config.totalSalary)} đ</p></div>{config.isCurrent && <span className="bg-orange-100 px-2 py-1 text-[9px] font-black uppercase text-orange-700">Hiện tại</span>}</div><div className="mt-2 grid grid-cols-2 gap-2 text-xs"><p className="text-stone-500">Cơ bản<br /><b className="text-stone-900">{formatVND(config.baseSalary)} đ</b></p><p className="text-stone-500">Bảo hiểm<br /><b className="text-stone-900">{formatVND(config.insuranceSalary)} đ</b></p></div>{config.note && <p className="mt-2 text-xs text-stone-500">{config.note}</p>}</div>)}</div> : <EmptyState text="Chưa có lịch sử cấu hình lương." />}</section>; }

function HistoryMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="border-l-2 border-orange-500 bg-[#fffdf8] p-3 shadow-sm sm:p-4"><span className="text-orange-600 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><p className="mt-2 text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">{label}</p><p className="mt-0.5 truncate text-base font-black sm:text-xl">{value}</p></div>; }
function MobileValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div><p className="text-[9px] font-bold uppercase text-stone-400">{label}</p><p className={`mt-1 truncate text-xs ${strong ? "font-black text-emerald-700" : "font-bold"}`}>{value}</p></div>; }
function Status({ status }: { status: string }) { return <span className={`px-2 py-1 text-[9px] font-black uppercase ${status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>{status === "paid" ? "Đã trả" : "Đã chốt"}</span>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>; }
function EmptyState({ text }: { text: string }) { return <div className="grid min-h-36 place-items-center p-6 text-center text-sm text-stone-500">{text}</div>; }
function shortCycleName(item: PayrollSummary) { const end = String(item.periodEnd).slice(0, 7).split("-"); return `${end[1]}/${end[0].slice(2)}`; }
function chartLabel(key: string) { return key === "netSalary" ? "Thực nhận" : key === "grossIncome" ? "Tổng thu nhập" : "Khấu trừ"; }
