"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Timer, TriangleAlert, X } from "lucide-react";
import type { AttendanceRecord, PersonalLeaveSummary, PersonalUser } from "@/features/personal/types";
import PersonalShell from "./personal-shell";
import PersonalLeaveRequests from "./personal-leave-requests";

interface PersonalAttendanceProps {
  user: PersonalUser;
  initialMonth: string;
  initialRecords: AttendanceRecord[];
  initialLeaveSummary: PersonalLeaveSummary | null;
  embedded?: boolean;
}

const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

interface AttendanceMonthData {
  attendance: AttendanceRecord[];
  leaveSummary: PersonalLeaveSummary | null;
}

export default function PersonalAttendance({ user, initialMonth, initialRecords, initialLeaveSummary, embedded = false }: PersonalAttendanceProps) {
  const attendanceCache = useRef(new Map<string, AttendanceMonthData>([[initialMonth, { attendance: initialRecords, leaveSummary: initialLeaveSummary }]]));
  const activeRequest = useRef(0);
  const [month, setMonth] = useState(initialMonth);
  const [records, setRecords] = useState(initialRecords);
  const [leaveSummary, setLeaveSummary] = useState(initialLeaveSummary);
  const [inspectedRecord, setInspectedRecord] = useState<AttendanceRecord | null>(null);
  const [mobileRecord, setMobileRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedRecords = attendanceCache.current.get(month);
    if (cachedRecords) {
      setRecords(cachedRecords.attendance);
      setLeaveSummary(cachedRecords.leaveSummary);
      setIsLoading(false);
      return;
    }

    const requestId = ++activeRequest.current;
    const controller = new AbortController();
    setRecords([]);
    setLeaveSummary(null);
    setIsLoading(true);
    setError(null);
    void fetch(`/api/personal/attendance?month=${month}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) throw new Error(payload.error?.message);
        const attendanceData = payload.data as AttendanceMonthData;
        const nextData = { attendance: attendanceData.attendance || [], leaveSummary: attendanceData.leaveSummary || null };
        attendanceCache.current.set(month, nextData);
        if (activeRequest.current === requestId) {
          setRecords(nextData.attendance);
          setLeaveSummary(nextData.leaveSummary);
        }
      })
      .catch((loadError) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError") && activeRequest.current === requestId) {
          setError(loadError instanceof Error ? loadError.message : "Không thể tải chấm công.");
        }
      })
      .finally(() => { if (activeRequest.current === requestId) setIsLoading(false); });
    return () => controller.abort();
  }, [month]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const targetMonth of [offsetMonth(month, -1), offsetMonth(month, 1)]) {
        if (attendanceCache.current.has(targetMonth)) continue;
        void fetch(`/api/personal/attendance?month=${targetMonth}`)
          .then((response) => response.json())
          .then((payload) => {
            if (payload.success) {
              attendanceCache.current.set(targetMonth, {
                attendance: payload.data.attendance || [],
                leaveSummary: payload.data.leaveSummary || null,
              });
            }
          })
          .catch(() => undefined);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [month]);

  const recordByDate = useMemo(() => new Map(records.map((record) => [String(record.workDate).slice(0, 10), record])), [records]);
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const firstDayIndex = (new Date(year, monthIndex - 1, 1).getDay() + 6) % 7;
  const totals = getAttendanceTotals(records);

  const changeMonth = (offset: number) => {
    const nextMonth = offsetMonth(month, offset);
    const cachedRecords = attendanceCache.current.get(nextMonth);
    setInspectedRecord(null);
    setMobileRecord(null);
    if (cachedRecords) {
      setRecords(cachedRecords.attendance);
      setLeaveSummary(cachedRecords.leaveSummary);
    }
    setMonth(nextMonth);
  };

  const content = (
    <>
      <section className="border-b border-slate-300 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Time & attendance</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Chấm công cá nhân</h1><p className="mt-1 text-sm text-slate-500">Rê vào một ngày để xem đầy đủ dữ liệu ngay bên cạnh lịch.</p></div>
          <div className="grid grid-cols-3 gap-2 xl:min-w-[720px] xl:grid-cols-6"><HeaderMetric icon={<CalendarDays />} label="Ngày công" value={totals.workdays.toFixed(1)} /><HeaderMetric icon={<Timer />} label="Tổng OT" value={`${totals.overtime.toFixed(1)}h`} /><HeaderMetric icon={<TriangleAlert />} label="Bất thường" value={`${totals.issueDays} ngày`} /><HeaderMetric icon={<CalendarDays />} label="Tổng ngày phép" value={leaveDays(leaveSummary?.annualLeaveTotal)} /><HeaderMetric icon={<CalendarDays />} label="Đã nghỉ cộng dồn" value={leaveDays(leaveSummary?.annualLeaveUsedCumulative)} /><HeaderMetric icon={<CalendarDays />} label="Nghỉ trong tháng" value={leaveDays(leaveSummary?.paidLeaveDays)} /></div>
        </div>
      </section>

      <section className="overflow-visible rounded-xl border border-slate-300 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-600"><Legend tone="bg-emerald-500" label="Đi làm" /><Legend tone="bg-sky-500" label="Tăng ca" /><Legend tone="bg-amber-500" label="Trễ / về sớm" /><Legend tone="bg-rose-500" label="Nghỉ" /></div>
          <div className="flex items-center justify-between gap-2 sm:justify-end"><button aria-label="Tháng trước" onClick={() => changeMonth(-1)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-300 bg-white hover:border-emerald-500 hover:text-emerald-600"><ChevronLeft className="h-4 w-4" /></button><p className="min-w-32 text-center text-sm font-black">Tháng {monthIndex}/{year}</p><button aria-label="Tháng sau" onClick={() => changeMonth(1)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-300 bg-white hover:border-emerald-500 hover:text-emerald-600"><ChevronRight className="h-4 w-4" /></button></div>
        </div>

        {error ? <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : (
          <div className="grid items-start xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="relative p-3 sm:p-4 xl:border-r xl:border-slate-200">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {weekDays.map((day) => <div key={day} className="py-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{day}</div>)}
                {Array.from({ length: firstDayIndex }).map((_, index) => <div key={`blank-${index}`} />)}
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1;
                  const dateKey = `${month}-${String(day).padStart(2, "0")}`;
                  const record = recordByDate.get(dateKey);
                  return <CalendarDay key={dateKey} dateKey={dateKey} day={day} record={record} loading={isLoading} active={inspectedRecord?.workDate === record?.workDate} onInspect={setInspectedRecord} onOpenMobile={setMobileRecord} />;
                })}
              </div>
              {isLoading && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[1px]"><span className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-black text-white">Đang tải tháng {monthIndex}/{year}</span></div>}
            </div>
            <div className="hidden min-h-[560px] xl:block"><AttendanceInspector record={inspectedRecord} /></div>
          </div>
        )}
      </section>

      <PersonalLeaveRequests />

      {mobileRecord && <MobileAttendanceDrawer record={mobileRecord} onClose={() => setMobileRecord(null)} />}
    </>
  );
  return embedded ? content : <PersonalShell user={user}>{content}</PersonalShell>;
}

function CalendarDay({ dateKey, day, record, loading, active, onInspect, onOpenMobile }: { dateKey: string; day: number; record?: AttendanceRecord; loading: boolean; active: boolean; onInspect: (record: AttendanceRecord | null) => void; onOpenMobile: (record: AttendanceRecord) => void }) {
  const state = getAttendanceState(record);
  const isToday = dateKey === getTodayKey();
  return <button type="button" disabled={!record || loading} onMouseEnter={() => record && onInspect(record)} onMouseLeave={() => onInspect(null)} onFocus={() => record && onInspect(record)} onBlur={() => onInspect(null)} onClick={() => { if (record) onOpenMobile(record); }} className={`group relative aspect-square border p-2 text-left transition sm:aspect-[1.35/1] sm:p-3 ${state.cellClass} ${record ? "hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" : "cursor-default"} ${active ? "border-slate-950 shadow-md" : "border-transparent"} ${isToday ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}><span className="text-sm font-black sm:text-base">{day}</span>{record && <><span className={`absolute right-2 top-2 h-2 w-2 rounded-full sm:right-3 sm:top-3 ${state.dotClass}`} /><span className="absolute bottom-2 left-2 hidden text-[9px] font-black uppercase tracking-wide opacity-0 transition group-hover:opacity-100 sm:block">Xem chi tiết</span></>}</button>;
}

function AttendanceInspector({ record }: { record: AttendanceRecord | null }) {
  if (!record) return <div className="grid min-h-[560px] place-items-center p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Clock3 className="h-5 w-5" /></div><p className="mt-4 font-black text-slate-900">Chi tiết trong ngày</p><p className="mt-1 text-sm leading-6 text-slate-500">Rê chuột vào một ô có màu.<br />Thông tin sẽ hiện ngay tại đây.</p></div></div>;
  const state = getAttendanceState(record);
  return <div className="p-5"><div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">Ngày đang xem</p><h2 className="mt-1 text-2xl font-black text-slate-950">{formatCalendarDate(record.workDate)}</h2><p className="mt-1 text-xs text-slate-500">{record.weekdayName || "--"} · {record.shiftName || "Chưa có ca"}</p></div><span className={`px-2.5 py-1 text-[10px] font-black uppercase ${state.badgeClass}`}>{state.label}</span></div><InspectorContent record={record} /></div>;
}

function InspectorContent({ record }: { record: AttendanceRecord }) {
  return <div className="mt-4 space-y-5"><DetailSection title="Các lượt vào – ra"><div className="grid grid-cols-3 gap-2"><TimePair label="Lượt 1" checkIn={record.checkIn} checkOut={record.checkOut} /><TimePair label="Lượt 2" checkIn={record.checkIn2} checkOut={record.checkOut2} /><TimePair label="Lượt 3" checkIn={record.checkIn3} checkOut={record.checkOut3} /></div></DetailSection><DetailSection title="Công và giờ làm"><div className="grid grid-cols-2 gap-x-4 gap-y-3"><DetailValue label="Ngày công" value={`${decimal(record.workdayCount)} công`} /><DetailValue label="Giờ làm" value={`${decimal(record.workHours)} giờ`} /><DetailValue label="Công bổ sung" value={`${decimal(record.extraWorkdayCount)} công`} /><DetailValue label="Giờ bổ sung" value={`${decimal(record.extraHours)} giờ`} /><DetailValue label="Tổng giờ" value={`${decimal(record.totalHours)} giờ`} /><DetailValue label="Ký hiệu" value={record.symbol || "--"} /></div></DetailSection><DetailSection title="Tăng ca và bất thường"><div className="grid grid-cols-2 gap-x-4 gap-y-3"><DetailValue label="OT thường" value={`${decimal(record.overtimeHours)} giờ`} /><DetailValue label="OT Chủ nhật" value={`${decimal(record.overtimeSundayHours)} giờ`} /><DetailValue label="OT ngày lễ" value={`${decimal(record.overtimeHolidayHours)} giờ`} /><DetailValue label="Đi trễ" value={`${Number(record.lateMinutes || 0)} phút`} /><DetailValue label="Về sớm" value={`${Number(record.earlyLeaveMinutes || 0)} phút`} /><DetailValue label="Ký hiệu thêm" value={record.extraSymbol || "--"} /></div></DetailSection>{(record.departmentName || record.positionTitle || record.note) && <DetailSection title="Thông tin khác"><div className="space-y-2"><DetailRow label="Bộ phận" value={record.departmentName || "--"} /><DetailRow label="Vị trí" value={record.positionTitle || "--"} />{record.note && <DetailRow label="Ghi chú" value={record.note} />}</div></DetailSection>}</div>;
}

function MobileAttendanceDrawer({ record, onClose }: { record: AttendanceRecord; onClose: () => void }) { return <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 xl:hidden" onClick={onClose}><div className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4"><div><p className="text-xs font-black uppercase tracking-wide text-emerald-600">Chi tiết chấm công</p><h2 className="mt-1 text-2xl font-black">{formatCalendarDate(record.workDate)}</h2><p className="text-sm text-slate-500">{record.shiftName || "Chưa có ca làm"}</p></div><button aria-label="Đóng" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-200"><X className="h-5 w-5" /></button></div><InspectorContent record={record} /></div></div>; }

function HeaderMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-xl border-l-2 border-emerald-500 bg-white px-3 py-2.5 shadow-sm"><span className="text-emerald-600 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="text-lg font-black text-slate-950">{value}</p></div>; }
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{title}</h3>{children}</section>; }
function TimePair({ label, checkIn, checkOut }: { label: string; checkIn: string | null; checkOut: string | null }) { return <div className="bg-slate-100 p-2.5 text-center"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="mt-1 text-xs font-black text-slate-900">{time(checkIn)}–{time(checkOut)}</p></div>; }
function DetailValue({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] text-slate-400">{label}</p><p className="mt-0.5 text-sm font-black text-slate-900">{value}</p></div>; }
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 text-xs"><span className="text-slate-500">{label}</span><span className="text-right font-bold text-slate-900">{value}</span></div>; }
function Legend({ tone, label }: { tone: string; label: string }) { return <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${tone}`} />{label}</span>; }

function getAttendanceState(record?: AttendanceRecord) { if (!record) return { label: "Không dữ liệu", cellClass: "bg-slate-50 text-slate-300", dotClass: "bg-slate-300", badgeClass: "bg-slate-200 text-slate-600" }; const hasWork = Number(record.workdayCount || 0) > 0; const hasOvertime = totalOvertime(record) > 0; const hasIssue = Number(record.lateMinutes || 0) > 0 || Number(record.earlyLeaveMinutes || 0) > 0; if (!hasWork) return { label: record.symbol || "Nghỉ", cellClass: "bg-rose-50 text-rose-900", dotClass: "bg-rose-500", badgeClass: "bg-rose-100 text-rose-700" }; if (hasIssue) return { label: "Bất thường", cellClass: "bg-amber-50 text-amber-950", dotClass: "bg-amber-500", badgeClass: "bg-amber-100 text-amber-700" }; if (hasOvertime) return { label: "Có OT", cellClass: "bg-sky-50 text-sky-950", dotClass: "bg-sky-500", badgeClass: "bg-sky-100 text-sky-700" }; return { label: "Đi làm", cellClass: "bg-emerald-50 text-emerald-950", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-100 text-emerald-700" }; }
function getAttendanceTotals(records: AttendanceRecord[]) { return records.reduce((totals, record) => ({ workdays: totals.workdays + Number(record.workdayCount || 0), overtime: totals.overtime + totalOvertime(record), issueDays: totals.issueDays + (Number(record.lateMinutes || 0) > 0 || Number(record.earlyLeaveMinutes || 0) > 0 ? 1 : 0) }), { workdays: 0, overtime: 0, issueDays: 0 }); }
function totalOvertime(record: AttendanceRecord) { return Number(record.overtimeHours || 0) + Number(record.overtimeSundayHours || 0) + Number(record.overtimeHolidayHours || 0); }
function leaveDays(value?: string | number) { return value === undefined ? "--" : `${Number(value || 0).toFixed(1)} ngày`; }
function offsetMonth(month: string, offset: number) { const [year, monthIndex] = month.split("-").map(Number); const date = new Date(year, monthIndex - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function getTodayKey() { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const value = (type: string) => parts.find((part) => part.type === type)?.value; return `${value("year")}-${value("month")}-${value("day")}`; }
function formatCalendarDate(value: string) { const [year, month, day] = String(value).slice(0, 10).split("-"); return `${day}/${month}/${year}`; }
function decimal(value: string | number) { return Number(value || 0).toFixed(1); }
function time(value: string | null) { return value?.slice(0, 5) || "--:--"; }
