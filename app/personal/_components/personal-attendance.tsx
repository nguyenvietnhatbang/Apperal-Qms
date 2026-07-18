"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck2, ChevronLeft, ChevronRight, Clock3, Timer, TriangleAlert, X } from "lucide-react";
import type { AttendanceRecord, PersonalUser } from "@/features/personal/types";
import PersonalShell from "./personal-shell";

interface PersonalAttendanceProps {
  user: PersonalUser;
  initialMonth: string;
  initialRecords: AttendanceRecord[];
}

const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function PersonalAttendance({ user, initialMonth, initialRecords }: PersonalAttendanceProps) {
  const attendanceCache = useRef(new Map<string, AttendanceRecord[]>([[initialMonth, initialRecords]]));
  const activeRequest = useRef(0);
  const [month, setMonth] = useState(initialMonth);
  const [records, setRecords] = useState(initialRecords);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedRecords = attendanceCache.current.get(month);
    if (cachedRecords) {
      setRecords(cachedRecords);
      setIsLoading(false);
      return;
    }

    const requestId = ++activeRequest.current;
    const controller = new AbortController();
    setRecords([]);
    setIsLoading(true);
    setError(null);
    void fetch(`/api/personal/attendance?month=${month}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) throw new Error(payload.error?.message);
        const attendance = (payload.data.attendance || []) as AttendanceRecord[];
        attendanceCache.current.set(month, attendance);
        if (activeRequest.current === requestId) setRecords(attendance);
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
          .then((payload) => { if (payload.success) attendanceCache.current.set(targetMonth, payload.data.attendance || []); })
          .catch(() => undefined);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [month]);

  const recordByDate = useMemo(
    () => new Map(records.map((record) => [String(record.workDate).slice(0, 10), record])),
    [records],
  );
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const firstDayIndex = (new Date(year, monthIndex - 1, 1).getDay() + 6) % 7;
  const totals = getAttendanceTotals(records);

  const changeMonth = (offset: number) => {
    const nextMonth = offsetMonth(month, offset);
    const cachedRecords = attendanceCache.current.get(nextMonth);
    setSelectedRecord(null);
    if (cachedRecords) setRecords(cachedRecords);
    setMonth(nextMonth);
  };

  return (
    <PersonalShell user={user}>
      <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg shadow-slate-200 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-xs font-bold tracking-[0.14em] text-cyan-300">CHẤM CÔNG CÁ NHÂN</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Lịch làm việc tháng {monthIndex}/{year}</h1><p className="mt-1 text-sm text-slate-300">Rê chuột vào ngày có màu để xem ngay toàn bộ chi tiết.</p></div>
          <div className="grid grid-cols-3 gap-2 lg:min-w-[430px]"><HeaderMetric icon={<CalendarCheck2 />} label="Ngày công" value={totals.workdays.toFixed(1)} /><HeaderMetric icon={<Timer />} label="Tăng ca" value={`${totals.overtime.toFixed(1)}h`} /><HeaderMetric icon={<TriangleAlert />} label="Đi trễ" value={`${totals.lateDays} ngày`} /></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600"><Legend tone="bg-emerald-400" label="Đi làm" /><Legend tone="bg-blue-500" label="Có tăng ca" /><Legend tone="bg-amber-400" label="Trễ / về sớm" /><Legend tone="bg-rose-400" label="Nghỉ / không công" /></div>
          <div className="flex items-center justify-between gap-2 sm:justify-end"><button aria-label="Tháng trước" onClick={() => changeMonth(-1)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50"><ChevronLeft className="h-5 w-5" /></button><p className="min-w-28 text-center text-sm font-black">Tháng {monthIndex}/{year}</p><button aria-label="Tháng sau" onClick={() => changeMonth(1)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50"><ChevronRight className="h-5 w-5" /></button></div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : (
          <div className="relative mt-3">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDays.map((day) => <div key={day} className="py-2 text-center text-[11px] font-black uppercase tracking-wide text-slate-400">{day}</div>)}
              {Array.from({ length: firstDayIndex }).map((_, index) => <div key={`blank-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const dateKey = `${month}-${String(day).padStart(2, "0")}`;
                const record = recordByDate.get(dateKey);
                const columnIndex = (firstDayIndex + index) % 7;
                return <CalendarDay key={dateKey} dateKey={dateKey} day={day} record={record} columnIndex={columnIndex} loading={isLoading} onSelect={setSelectedRecord} />;
              })}
            </div>
            {isLoading && <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-white/45 backdrop-blur-[1px]"><span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-lg">Đang tải tháng {monthIndex}/{year}...</span></div>}
          </div>
        )}
      </section>

      {selectedRecord && <MobileAttendanceDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
    </PersonalShell>
  );
}

function CalendarDay({ dateKey, day, record, columnIndex, loading, onSelect }: { dateKey: string; day: number; record?: AttendanceRecord; columnIndex: number; loading: boolean; onSelect: (record: AttendanceRecord) => void }) {
  const state = getAttendanceState(record);
  const isToday = dateKey === getTodayKey();
  const tooltipPosition = columnIndex === 0 ? "left-0" : columnIndex === 6 ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <button
      type="button"
      disabled={!record || loading}
      onClick={() => record && onSelect(record)}
      className={`group relative isolate aspect-square rounded-xl p-2 text-left transition sm:aspect-[1.25/1] sm:p-3 ${state.cellClass} ${record ? "cursor-pointer hover:z-30 hover:-translate-y-0.5 hover:shadow-lg focus-visible:z-30" : "cursor-default"} ${isToday ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
    >
      <span className="text-sm font-black sm:text-base">{day}</span>
      {record && <span className={`absolute bottom-2 right-2 h-2 w-2 rounded-full sm:bottom-3 sm:right-3 ${state.dotClass}`} />}
      {record && <div className={`pointer-events-none invisible absolute bottom-[calc(100%+10px)] z-50 hidden w-64 rounded-2xl bg-slate-950 p-4 text-left text-white opacity-0 shadow-2xl transition group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 sm:block ${tooltipPosition}`}><AttendanceTooltipContent record={record} /><span className={`absolute top-full h-0 w-0 border-x-[7px] border-t-[7px] border-x-transparent border-t-slate-950 ${columnIndex === 0 ? "left-5" : columnIndex === 6 ? "right-5" : "left-1/2 -translate-x-1/2"}`} /></div>}
    </button>
  );
}

function AttendanceTooltipContent({ record }: { record: AttendanceRecord }) {
  const state = getAttendanceState(record);
  return <><div className="flex items-center justify-between gap-3"><p className="font-black">{formatCalendarDate(record.workDate)}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${state.badgeClass}`}>{state.label}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><TooltipMetric label="Ngày công" value={`${Number(record.workdayCount || 0).toFixed(1)} công`} /><TooltipMetric label="Giờ làm" value={`${Number(record.workHours || 0).toFixed(1)} giờ`} /><TooltipMetric label="Giờ vào" value={record.checkIn?.slice(0, 5) || "--:--"} /><TooltipMetric label="Giờ ra" value={record.checkOut?.slice(0, 5) || "--:--"} /><TooltipMetric label="Tăng ca" value={`${Number(record.overtimeHours || 0).toFixed(1)} giờ`} /><TooltipMetric label="Trễ / sớm" value={`${Number(record.lateMinutes || 0)}p / ${Number(record.earlyLeaveMinutes || 0)}p`} /></div></>;
}

function MobileAttendanceDrawer({ record, onClose }: { record: AttendanceRecord; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:hidden" onClick={onClose}><div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black tracking-wide text-blue-700">CHI TIẾT CHẤM CÔNG</p><h2 className="mt-1 text-xl font-black">{formatCalendarDate(record.workDate)}</h2></div><button aria-label="Đóng" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><MobileMetric label="Ngày công" value={`${Number(record.workdayCount || 0).toFixed(1)} công`} /><MobileMetric label="Giờ làm" value={`${Number(record.workHours || 0).toFixed(1)} giờ`} /><MobileMetric label="Giờ vào" value={record.checkIn?.slice(0, 5) || "--:--"} /><MobileMetric label="Giờ ra" value={record.checkOut?.slice(0, 5) || "--:--"} /><MobileMetric label="Tăng ca" value={`${Number(record.overtimeHours || 0).toFixed(1)} giờ`} /><MobileMetric label="Đi trễ / về sớm" value={`${Number(record.lateMinutes || 0)}p / ${Number(record.earlyLeaveMinutes || 0)}p`} /></div></div></div>;
}

function HeaderMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><span className="text-cyan-300 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 text-lg font-black">{value}</p></div>; }
function TooltipMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-white/8 p-2"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-0.5 text-xs font-black">{value}</p></div>; }
function MobileMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>; }
function Legend({ tone, label }: { tone: string; label: string }) { return <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${tone}`} />{label}</span>; }

function getAttendanceState(record?: AttendanceRecord) {
  if (!record) return { label: "Không dữ liệu", cellClass: "bg-slate-50 text-slate-400", dotClass: "bg-slate-300", badgeClass: "bg-slate-700 text-slate-200" };
  const hasWork = Number(record.workdayCount || 0) > 0;
  const hasOvertime = Number(record.overtimeHours || 0) > 0;
  const hasIssue = Number(record.lateMinutes || 0) > 0 || Number(record.earlyLeaveMinutes || 0) > 0;
  if (!hasWork) return { label: record.symbol || "Nghỉ", cellClass: "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-100", dotClass: "bg-rose-500", badgeClass: "bg-rose-500/20 text-rose-200" };
  if (hasIssue) return { label: "Trễ / về sớm", cellClass: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-100", dotClass: "bg-amber-500", badgeClass: "bg-amber-500/20 text-amber-200" };
  if (hasOvertime) return { label: "Có tăng ca", cellClass: "bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-100", dotClass: "bg-blue-500", badgeClass: "bg-blue-500/20 text-blue-200" };
  return { label: "Đi làm", cellClass: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-100", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-500/20 text-emerald-200" };
}

function getAttendanceTotals(records: AttendanceRecord[]) {
  return records.reduce((totals, record) => ({ workdays: totals.workdays + Number(record.workdayCount || 0), overtime: totals.overtime + Number(record.overtimeHours || 0), lateDays: totals.lateDays + (Number(record.lateMinutes || 0) > 0 ? 1 : 0) }), { workdays: 0, overtime: 0, lateDays: 0 });
}

function offsetMonth(month: string, offset: number) { const [year, monthIndex] = month.split("-").map(Number); const date = new Date(year, monthIndex - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function getTodayKey() { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const value = (type: string) => parts.find((part) => part.type === type)?.value; return `${value("year")}-${value("month")}-${value("day")}`; }
function formatCalendarDate(value: string) { const [year, month, day] = String(value).slice(0, 10).split("-"); return `${day}/${month}/${year}`; }
