"use client";

import { X } from "lucide-react";
import { formatDate, formatVND } from "@/lib/format";
import type { PayrollSummary, SalaryConfig } from "@/features/personal/types";

export function PayslipDialog({ payslip, onClose }: { payslip: any; onClose: () => void }) {
  const item = payslip.payrollItem;
  const workRows = [
    ["Ngày công thực tế", item.actualWorkdays, "công"], ["Nghỉ hưởng lương", item.paidLeaveDays, "ngày"],
    ["Nghỉ không lương", item.unpaidLeaveDays, "ngày"], ["Ngày lễ", item.holidayDays, "ngày"],
    ["OT ngày thường", item.overtimeNormalHours, "giờ"], ["OT Chủ nhật", item.overtimeSundayHours, "giờ"],
    ["OT ngày lễ", item.overtimeHolidayHours, "giờ"], ["Ca đêm", item.nightShiftHours, "giờ"],
  ] as const;
  const incomeRows = [
    ["Lương theo công", item.monthlySalaryAmount], ["Nghỉ việc riêng", item.personalLeaveAmount],
    ["Nghỉ hưởng lương", item.paidLeaveAmount], ["OT ngày thường", item.overtimeNormalAmount],
    ["OT Chủ nhật", item.overtimeSundayAmount], ["OT ngày lễ", item.overtimeHolidayAmount],
    ["Tiền ca đêm", item.nightShiftAmount], ["Phụ cấp cấu hình", item.allowanceAmount],
    ["Phụ cấp khác", item.otherAllowanceAmount], ["Công tác phí", item.businessTripAllowance],
    ["Thưởng tuân thủ", item.complianceBonus], ["Hỗ trợ công tác", item.workTripSupport],
    ["Phụ cấp con nhỏ", item.childAllowanceAmount], ["Phụ cấp đặc thù", item.menstrualAllowanceAmount],
  ] as const;
  const deductionRows = [
    ["Bảo hiểm người lao động", item.employeeInsuranceAmount], ["Phí công đoàn", item.unionFeeAmount],
    ["Thuế thu nhập cá nhân", item.personalIncomeTaxAmount], ["Tạm ứng đợt 1", item.advancePayment1],
    ["Tạm ứng đợt 2", item.advancePayment2], ["Ứng phép chờ việc", item.pendingLeaveAdvance],
  ] as const;

  return <DialogFrame title="Phiếu lương cá nhân" subtitle={`${payslip.cycle?.name} · ${formatDate(payslip.cycle?.periodStart)} – ${formatDate(payslip.cycle?.periodEnd)}`} onClose={onClose} wide>
    <div className="grid gap-3 sm:grid-cols-3"><SummaryBox label="Tổng thu nhập" value={item.grossIncome} tone="blue" /><SummaryBox label="Tổng khấu trừ" value={item.totalDeduction} tone="rose" /><SummaryBox label="Thực nhận" value={item.netSalary} tone="emerald" /></div>
    <section className="mt-5"><SectionTitle title="Công, phép và tăng ca" /><div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">{workRows.map(([label, value, unit]) => <div key={label} className="bg-white p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-sm font-black">{Number(value || 0).toFixed(1)} {unit}</p></div>)}</div></section>
    <div className="mt-5 grid gap-5 md:grid-cols-2"><MoneySection title="Chi tiết thu nhập" rows={incomeRows} /><MoneySection title="Chi tiết khấu trừ" rows={deductionRows} danger /></div>
    {payslip.lines?.length > 0 && <section className="mt-5"><SectionTitle title="Các dòng tính lương" /><div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">{payslip.lines.map((line: any) => <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 p-3 text-sm"><div><p className="font-bold">{line.lineName}</p>{line.quantity != null && <p className="mt-0.5 text-xs text-slate-500">SL {Number(line.quantity).toFixed(2)}{line.rate != null ? ` × ${formatVND(line.rate)}` : ""}</p>}</div><p className={`font-black ${line.lineType === "deduction" ? "text-rose-600" : "text-slate-900"}`}>{formatVND(line.amount)} đ</p></div>)}</div></section>}
    {item.note && <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Ghi chú: {item.note}</p>}
  </DialogFrame>;
}

export function SalaryConfigDialog({ config, onClose }: { config: SalaryConfig; onClose: () => void }) {
  const rows = [["Lương cơ bản", config.baseSalary], ["Phụ cấp chức vụ", config.positionAllowance], ["Phụ cấp trách nhiệm", config.responsibilityAllowance], ["Phụ cấp thâm niên", config.seniorityAllowance], ["Phụ cấp an toàn", config.safetyAllowance], ["Phụ cấp điện thoại", config.phoneAllowance], ["Phụ cấp đi lại", config.travelAllowance], ["Phụ cấp nhà ở", config.housingAllowance], ["Thưởng chuyên cần", config.attendanceBonus], ["Thưởng khác", config.otherBonus], ["Phụ cấp ăn", config.mealAllowance]] as const;
  return <DialogFrame title="Cấu hình lương cá nhân" subtitle={`Hiệu lực từ ${formatDate(config.effectiveFrom)}`} onClose={onClose}><SummaryBox label="Tổng lương cấu hình" value={config.totalSalary} tone="blue" /><div className="mt-5"><MoneySection title="Cơ cấu thu nhập" rows={rows} /></div><div className="mt-5 rounded-xl bg-slate-50 p-4"><MoneyRow label="Lương đóng bảo hiểm" value={config.insuranceSalary} /></div>{config.note && <p className="mt-4 text-sm text-slate-600">Ghi chú: {config.note}</p>}</DialogFrame>;
}

export function PendingPayrollDialog({ item, onClose }: { item: PayrollSummary; onClose: () => void }) {
  const additions = [["Phụ cấp khác", item.otherAllowanceAmount], ["Công tác phí", item.businessTripAllowance], ["Thưởng tuân thủ", item.complianceBonus], ["Hỗ trợ công tác", item.workTripSupport], ["Hỗ trợ ca đêm", item.nightShiftAmount]] as const;
  const advances = [["Tạm ứng đợt 1", item.advancePayment1], ["Tạm ứng đợt 2", item.advancePayment2], ["Ứng phép chờ việc", item.pendingLeaveAdvance]] as const;
  return <DialogFrame title={item.cycleName} subtitle="Kỳ lương đang xử lý — số liệu chưa phải kết quả cuối cùng" onClose={onClose}><SummaryBox label="Thực nhận dự kiến" value={item.estimatedNetSalary || 0} tone="amber" /><div className="mt-5 grid gap-5 sm:grid-cols-2"><MoneySection title="Khoản bổ sung" rows={additions} /><MoneySection title="Tạm ứng / khấu trừ" rows={advances} danger /></div>{item.note && <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Ghi chú: {item.note}</p>}</DialogFrame>;
}

function DialogFrame({ title, subtitle, onClose, wide = false, children }: { title: string; subtitle: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-xl sm:border sm:border-slate-300 ${wide ? "max-w-4xl" : "max-w-xl"}`}><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-300 bg-slate-50/95 px-5 py-4 backdrop-blur sm:px-6"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Personal workspace</p><h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><button aria-label="Đóng" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-950 text-white hover:bg-emerald-600"><X className="h-5 w-5" /></button></header><div className="p-5 sm:p-6">{children}</div></div></div>;
}

function SummaryBox({ label, value, tone }: { label: string; value: string | number; tone: "blue" | "rose" | "emerald" | "amber" }) { const tones = { blue: "bg-blue-50 text-blue-800", rose: "bg-rose-50 text-rose-800", emerald: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-800" }; return <div className={`rounded-xl p-4 ${tones[tone]}`}><p className="text-xs font-bold opacity-70">{label}</p><p className="mt-1 text-xl font-black">{formatVND(value || 0)} đ</p></div>; }
function SectionTitle({ title }: { title: string }) { return <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h3>; }
function MoneySection({ title, rows, danger = false }: { title: string; rows: readonly (readonly [string, string | number | undefined])[]; danger?: boolean }) { return <section><SectionTitle title={title} /><div className="mt-3 space-y-2.5">{rows.map(([label, value]) => <MoneyRow key={label} label={label} value={value || 0} danger={danger} />)}</div></section>; }
function MoneyRow({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) { return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-slate-600">{label}</span><span className={danger && Number(value) > 0 ? "font-black text-rose-600" : "font-black text-slate-900"}>{formatVND(value)} đ</span></div>; }
