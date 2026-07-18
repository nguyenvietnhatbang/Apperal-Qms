"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PersonalShell from "./personal-shell";

interface Props { user: { displayName: string; factoryName: string; employeeId: string | null }; }
const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function PersonalAttendance({ user }: Props) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<any[]>([]);
  const [recordsByMonth, setRecordsByMonth] = useState<Record<string, any[]>>({});
  const [activeRecord, setActiveRecord] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedRecords = recordsByMonth[month];
    if (cachedRecords) { setRecords(cachedRecords); setIsLoading(false); return; }
    const controller = new AbortController();
    setIsLoading(true); setError(null);
    void fetch(`/api/personal/attendance?month=${month}`, { signal: controller.signal }).then((response) => response.json()).then((payload) => {
      if (!payload.success) throw new Error(payload.error?.message);
      const attendance = payload.data.attendance || [];
      setRecords(attendance);
      setRecordsByMonth((current) => ({ ...current, [month]: attendance }));
    }).catch((loadError) => { if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "Không thể tải chấm công."); }).finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [month, recordsByMonth]);

  const recordByDate = useMemo(() => new Map(records.map((record) => [String(record.workDate).slice(0, 10), record])), [records]);
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const firstDayIndex = (new Date(year, monthIndex - 1, 1).getDay() + 6) % 7;
  const totalWorkdays = records.reduce((sum, record) => sum + Number(record.workdayCount || 0), 0);
  const totalOt = records.reduce((sum, record) => sum + Number(record.overtimeHours || 0), 0);
  const lateCount = records.filter((record) => Number(record.lateMinutes || 0) > 0).length;
  const changeMonth = (offset: number) => { const date = new Date(year, monthIndex - 1 + offset, 1); setActiveRecord(null); setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`); };

  return <PersonalShell user={user}>
    <section className="rounded-3xl bg-slate-900 p-5 text-white sm:p-6"><p className="text-xs font-bold tracking-[0.14em] text-cyan-200">LỊCH LÀM VIỆC</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Chấm công của bạn</h1><p className="mt-2 text-sm text-slate-300">Rê chuột hoặc chạm vào ô màu để xem chi tiết ngày công.</p></section>
    <section className="grid gap-3 sm:grid-cols-3"><SmallStat label="Ngày công" value={`${totalWorkdays.toFixed(1)} công`} /><SmallStat label="Tăng ca" value={`${totalOt.toFixed(1)} giờ`} /><SmallStat label="Đi trễ" value={`${lateCount} ngày`} /></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Tháng {monthIndex}/{year}</h2><p className="mt-1 text-sm text-slate-500">Mỗi ô chỉ biểu thị trạng thái; xem chi tiết khi tương tác.</p></div><div className="flex gap-2"><button aria-label="Tháng trước" onClick={() => changeMonth(-1)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 hover:bg-slate-50"><ChevronLeft className="h-5 w-5" /></button><button aria-label="Tháng sau" onClick={() => changeMonth(1)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 hover:bg-slate-50"><ChevronRight className="h-5 w-5" /></button></div></div><div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-slate-600"><Legend tone="bg-emerald-100" label="Đi làm" /><Legend tone="bg-blue-100" label="Có tăng ca" /><Legend tone="bg-amber-100" label="Đi trễ / về sớm" /><Legend tone="bg-rose-100" label="Nghỉ / không có công" /></div>{error ? <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : <><div className={`mt-6 grid grid-cols-7 gap-1.5 sm:gap-2 ${isLoading ? "opacity-60" : ""}`}>{weekDays.map((day) => <div key={day} className="py-2 text-center text-xs font-black text-slate-400">{day}</div>)}{Array.from({ length: firstDayIndex }).map((_, index) => <div key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const dateKey = `${month}-${String(day).padStart(2, "0")}`; const record = recordByDate.get(dateKey); return <CalendarCell key={dateKey} day={day} record={record} loading={isLoading} active={activeRecord?.workDate === record?.workDate} onActivate={setActiveRecord} />; })}</div>{isLoading && <p className="mt-3 text-center text-xs font-bold text-slate-500">Đang cập nhật dữ liệu tháng...</p>}<AttendanceDetail record={activeRecord} /></>}</section>
  </PersonalShell>;
}

function CalendarCell({ day, record, loading, active, onActivate }: { day: number; record: any; loading: boolean; active: boolean; onActivate: (record: any) => void }) { const hasWork = Number(record?.workdayCount || 0) > 0; const hasOt = Number(record?.overtimeHours || 0) > 0; const hasIssue = Number(record?.lateMinutes || 0) > 0 || Number(record?.earlyLeaveMinutes || 0) > 0; const tone = !record ? "bg-slate-50 text-slate-400" : !hasWork ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100" : hasIssue ? "bg-amber-50 text-amber-800 ring-1 ring-amber-100" : hasOt ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"; return <button type="button" disabled={!record || loading} onMouseEnter={() => record && onActivate(record)} onFocus={() => record && onActivate(record)} onClick={() => record && onActivate(record)} className={`min-h-14 rounded-xl p-2 text-left transition sm:min-h-20 sm:p-3 ${tone} ${active ? "ring-2 ring-slate-800 ring-offset-2" : "hover:-translate-y-0.5 hover:shadow-sm"}`}><p className="text-sm font-black">{day}</p>{loading && <span className="mt-2 block h-1.5 w-6 animate-pulse rounded bg-slate-200" />}</button>; }
function AttendanceDetail({ record }: { record: any }) { if (!record) return <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">Rê chuột hoặc chạm vào một ngày có màu để xem chi tiết.</p>; const hasWork = Number(record.workdayCount || 0) > 0; return <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-slate-900">{String(record.workDate).slice(0, 10)}</p><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold">{hasWork ? `${Number(record.workdayCount).toFixed(1)} công` : record.symbol || "Nghỉ"}</span></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><p>Vào / ra: <b>{record.checkIn?.slice(0, 5) || "--:--"} – {record.checkOut?.slice(0, 5) || "--:--"}</b></p><p>Tăng ca: <b>{Number(record.overtimeHours || 0).toFixed(1)} giờ</b></p><p>{Number(record.lateMinutes || 0) > 0 ? `Đi trễ: ${record.lateMinutes} phút` : Number(record.earlyLeaveMinutes || 0) > 0 ? `Về sớm: ${record.earlyLeaveMinutes} phút` : "Đúng giờ"}</p></div></div>; }
function SmallStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
function Legend({ tone, label }: { tone: string; label: string }) { return <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${tone}`} />{label}</span>; }
