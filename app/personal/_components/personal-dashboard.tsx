"use client";

import { useState } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  IdCard,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { formatDate, formatVND } from "@/lib/format";
import type { PayrollSummary, PersonalOverview, PersonalUser } from "@/features/personal/types";
import PersonalShell from "./personal-shell";
import { PayslipDialog, PendingPayrollDialog, SalaryConfigDialog } from "./personal-salary-dialogs";

interface PersonalDashboardProps {
  user: PersonalUser;
  initialOverview: PersonalOverview;
}

function getDefaultCycleKey(overview: PersonalOverview) {
  if (overview.payrollHistory[0]) return `locked:${overview.payrollHistory[0].cycleId}`;
  if (overview.pendingPayrolls[0]) return `pending:${overview.pendingPayrolls[0].cycleId}`;
  return "";
}

export default function PersonalDashboard({ user, initialOverview }: PersonalDashboardProps) {
  const [selectedCycleKey, setSelectedCycleKey] = useState(() => getDefaultCycleKey(initialOverview));
  const [payslip, setPayslip] = useState<any>(null);
  const [isSalaryConfigOpen, setIsSalaryConfigOpen] = useState(false);
  const [pendingPayroll, setPendingPayroll] = useState<PayrollSummary | null>(null);
  const [loadingCycleId, setLoadingCycleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedLockedPayroll = initialOverview.payrollHistory.find(
    (item) => selectedCycleKey === `locked:${item.cycleId}`,
  );
  const selectedPendingPayroll = initialOverview.pendingPayrolls.find(
    (item) => selectedCycleKey === `pending:${item.cycleId}`,
  );
  const selectedPayroll = selectedLockedPayroll || selectedPendingPayroll;
  const isPending = Boolean(selectedPendingPayroll);

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

  return (
    <PersonalShell user={user}>
      <ProfileHeader overview={initialOverview} />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,0.75fr)]">
        <PayrollWorkspace
          overview={initialOverview}
          selectedCycleKey={selectedCycleKey}
          selectedPayroll={selectedPayroll}
          isPending={isPending}
          loadingCycleId={loadingCycleId}
          onCycleChange={setSelectedCycleKey}
          onOpenPayslip={openPayslip}
          onOpenPending={setPendingPayroll}
        />

        <aside className="grid gap-4">
          <SalaryConfigurationCard overview={initialOverview} onOpen={() => setIsSalaryConfigOpen(true)} />
          <EmployeeInformationCard overview={initialOverview} />
        </aside>
      </div>

      {payslip && <PayslipDialog payslip={payslip} onClose={() => setPayslip(null)} />}
      {isSalaryConfigOpen && initialOverview.salaryConfig && (
        <SalaryConfigDialog config={initialOverview.salaryConfig} onClose={() => setIsSalaryConfigOpen(false)} />
      )}
      {pendingPayroll && <PendingPayrollDialog item={pendingPayroll} onClose={() => setPendingPayroll(null)} />}
    </PersonalShell>
  );
}

function ProfileHeader({ overview }: { overview: PersonalOverview }) {
  const latestAttendance = overview.attendance[0];
  return (
    <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-200">
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-500 text-xl font-black">
            {overview.profile.fullName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.14em] text-blue-300">HỒ SƠ CÁ NHÂN</p>
            <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl">{overview.profile.fullName}</h1>
            <p className="mt-1 truncate text-sm text-slate-300">
              {overview.profile.employeeCode} · {overview.profile.positionTitle || "Nhân viên"} · {overview.profile.departmentName || "Chưa phân bộ phận"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <Clock3 className="h-5 w-5 text-cyan-300" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Chấm công gần nhất</p>
            <p className="mt-0.5 text-sm font-black">
              {latestAttendance ? `${formatDate(latestAttendance.workDate)} · ${latestAttendance.checkIn?.slice(0, 5) || "--:--"}–${latestAttendance.checkOut?.slice(0, 5) || "--:--"}` : "Chưa có dữ liệu"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PayrollWorkspace({
  overview,
  selectedCycleKey,
  selectedPayroll,
  isPending,
  loadingCycleId,
  onCycleChange,
  onOpenPayslip,
  onOpenPending,
}: {
  overview: PersonalOverview;
  selectedCycleKey: string;
  selectedPayroll?: PayrollSummary;
  isPending: boolean;
  loadingCycleId: string | null;
  onCycleChange: (value: string) => void;
  onOpenPayslip: (cycleId: string) => Promise<void>;
  onOpenPending: (item: PayrollSummary) => void;
}) {
  const netSalary = selectedPayroll?.netSalary ?? selectedPayroll?.estimatedNetSalary ?? 0;
  const incomeRows = selectedPayroll ? [
    ["Lương theo công", selectedPayroll.monthlySalaryAmount],
    ["Phụ cấp theo cấu hình", selectedPayroll.allowanceAmount],
    ["Phụ cấp khác", selectedPayroll.otherAllowanceAmount],
    ["Công tác phí", selectedPayroll.businessTripAllowance],
    ["Thưởng tuân thủ", selectedPayroll.complianceBonus],
    ["Hỗ trợ công tác", selectedPayroll.workTripSupport],
    ["Tiền ca đêm", selectedPayroll.nightShiftAmount],
  ] as const : [];
  const deductionRows = selectedPayroll ? [
    ["Bảo hiểm người lao động", selectedPayroll.employeeInsuranceAmount],
    ["Phí công đoàn", selectedPayroll.unionFeeAmount],
    ["Thuế thu nhập cá nhân", selectedPayroll.personalIncomeTaxAmount],
    ["Tạm ứng đợt 1", selectedPayroll.advancePayment1],
    ["Tạm ứng đợt 2", selectedPayroll.advancePayment2],
    ["Ứng phép chờ việc", selectedPayroll.pendingLeaveAdvance],
  ] as const : [];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.12em] text-blue-700">BẢNG LƯƠNG CÁ NHÂN</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Chi tiết theo kỳ lương</h2>
          </div>
          <select
            aria-label="Chọn kỳ lương"
            value={selectedCycleKey}
            onChange={(event) => onCycleChange(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:max-w-[320px]"
          >
            {overview.pendingPayrolls.length > 0 && (
              <optgroup label="Đang xử lý">
                {overview.pendingPayrolls.map((item) => <option key={`pending:${item.cycleId}`} value={`pending:${item.cycleId}`}>{item.cycleName} · Chưa chốt</option>)}
              </optgroup>
            )}
            {overview.payrollHistory.length > 0 && (
              <optgroup label="Đã chốt">
                {overview.payrollHistory.map((item) => <option key={`locked:${item.cycleId}`} value={`locked:${item.cycleId}`}>{item.cycleName} · Đã chốt</option>)}
              </optgroup>
            )}
            {!selectedPayroll && <option value="">Chưa có kỳ lương</option>}
          </select>
        </div>
      </header>

      {!selectedPayroll ? (
        <div className="p-10 text-center text-sm text-slate-500">Chưa có dữ liệu bảng lương.</div>
      ) : (
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-slate-950">{selectedPayroll.cycleName}</h3>
                <StatusBadge pending={isPending} />
              </div>
              <p className="mt-1 text-sm text-slate-500">{formatDate(selectedPayroll.periodStart)} – {formatDate(selectedPayroll.periodEnd)}</p>
            </div>
            <p className="text-xs font-semibold text-slate-500">{isPending ? "Số liệu có thể thay đổi trước khi chốt" : "Số liệu đã được chốt"}</p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <SalaryMetric label={isPending ? "Thực nhận dự kiến" : "Thực nhận"} value={netSalary} tone="emerald" />
            <SalaryMetric label="Tổng thu nhập" value={selectedPayroll.grossIncome} tone="blue" />
            <SalaryMetric label="Tổng khấu trừ" value={selectedPayroll.totalDeduction} tone="rose" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
            <WorkMetric label="Ngày công" value={`${number(selectedPayroll.actualWorkdays)} công`} />
            <WorkMetric label="Nghỉ hưởng lương" value={`${number(selectedPayroll.paidLeaveDays)} ngày`} />
            <WorkMetric label="Nghỉ không lương" value={`${number(selectedPayroll.unpaidLeaveDays)} ngày`} />
            <WorkMetric label="Tổng tăng ca" value={`${totalOvertime(selectedPayroll)} giờ`} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SalaryBreakdown title="Các khoản thu nhập" icon={<BadgeDollarSign className="h-4 w-4 text-emerald-600" />} rows={incomeRows} />
            <SalaryBreakdown title="Các khoản khấu trừ" icon={<ShieldCheck className="h-4 w-4 text-rose-600" />} rows={deductionRows} danger />
          </div>

          {selectedPayroll.note && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Ghi chú: {selectedPayroll.note}</p>}

          <button
            onClick={() => isPending ? onOpenPending(selectedPayroll) : void onOpenPayslip(selectedPayroll.cycleId)}
            disabled={loadingCycleId === selectedPayroll.cycleId}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white transition disabled:opacity-60 ${isPending ? "bg-amber-600 hover:bg-amber-700" : "bg-slate-950 hover:bg-blue-700"}`}
          >
            <FileText className="h-4 w-4" />
            {loadingCycleId === selectedPayroll.cycleId ? "Đang tải phiếu lương..." : isPending ? "Xem khoản bổ sung và tạm ứng" : "Mở phiếu lương đầy đủ"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}

function SalaryConfigurationCard({ overview, onOpen }: { overview: PersonalOverview; onOpen: () => void }) {
  const config = overview.salaryConfig;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black tracking-wide text-slate-500">CẤU HÌNH LƯƠNG</p><h2 className="mt-1 text-lg font-black">Mức lương đang áp dụng</h2></div><CircleDollarSign className="h-6 w-6 text-blue-600" /></div>
      {config ? <><p className="mt-4 text-3xl font-black text-slate-950">{formatVND(config.totalSalary)} <span className="text-base">đ</span></p><p className="mt-1 text-xs text-slate-500">Hiệu lực từ {formatDate(config.effectiveFrom)}</p><div className="mt-4 space-y-2 border-t border-slate-100 pt-4"><CompactLine label="Lương cơ bản" value={config.baseSalary} /><CompactLine label="Lương đóng bảo hiểm" value={config.insuranceSalary} /><CompactLine label="Tổng phụ cấp" value={Number(config.totalSalary) - Number(config.baseSalary)} /></div><button onClick={onOpen} className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">Xem toàn bộ cấu hình</button></> : <p className="mt-4 text-sm text-slate-500">Chưa có cấu hình lương đang hiệu lực.</p>}
    </section>
  );
}

function EmployeeInformationCard({ overview }: { overview: PersonalOverview }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black tracking-wide text-slate-500">THÔNG TIN CÔNG VIỆC</p><h2 className="mt-1 text-lg font-black">Hồ sơ nhân viên</h2></div><UserRound className="h-6 w-6 text-violet-600" /></div>
      <div className="mt-4 grid gap-3 text-sm">
        <InfoLine icon={<IdCard />} label="Mã nhân viên" value={overview.profile.employeeCode} />
        <InfoLine icon={<BriefcaseBusiness />} label="Vị trí" value={overview.profile.positionTitle || "Chưa cập nhật"} />
        <InfoLine icon={<UserRound />} label="Bộ phận" value={overview.profile.departmentName || "Chưa cập nhật"} />
        <InfoLine icon={<CalendarClock />} label="Ngày vào làm" value={overview.profile.joinedDate ? formatDate(overview.profile.joinedDate) : "Chưa cập nhật"} />
      </div>
    </section>
  );
}

function SalaryMetric({ label, value, tone }: { label: string; value?: string | number; tone: "emerald" | "blue" | "rose" }) {
  const tones = { emerald: "bg-emerald-50 text-emerald-800", blue: "bg-blue-50 text-blue-800", rose: "bg-rose-50 text-rose-800" };
  return <div className={`rounded-xl p-4 ${tones[tone]}`}><p className="text-xs font-bold opacity-70">{label}</p><p className="mt-1 text-xl font-black">{formatVND(value || 0)} đ</p></div>;
}

function WorkMetric({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-3"><p className="text-[11px] font-bold text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-slate-900">{value}</p></div>;
}

function SalaryBreakdown({ title, icon, rows, danger = false }: { title: string; icon: React.ReactNode; rows: readonly (readonly [string, string | number | undefined])[]; danger?: boolean }) {
  return <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-sm font-black text-slate-900">{icon}{title}</div><div className="mt-3 space-y-2.5">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-600">{label}</span><span className={danger && Number(value || 0) > 0 ? "font-black text-rose-600" : "font-black text-slate-900"}>{formatVND(value || 0)} đ</span></div>)}</div></div>;
}

function CompactLine({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className="font-black">{formatVND(value)} đ</span></div>;
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="truncate font-bold text-slate-900">{value}</p></div></div>;
}

function StatusBadge({ pending }: { pending: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${pending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{pending ? "Chưa chốt" : "Đã chốt"}</span>;
}

function number(value?: string | number) {
  return Number(value || 0).toFixed(1);
}

function totalOvertime(payroll: PayrollSummary) {
  return (Number(payroll.overtimeHours || 0) + Number(payroll.overtimeSundayHours || 0) + Number(payroll.overtimeHolidayHours || 0)).toFixed(1);
}
