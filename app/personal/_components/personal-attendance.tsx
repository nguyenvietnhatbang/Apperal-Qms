"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import PersonalShell from "./personal-shell";

interface Props { user: { displayName: string; factoryName: string; employeeId: string | null }; }
const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function PersonalAttendance({ user }: Props) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setIsLoading(true); setError(null); void fetch(`/api/personal/overview?month=${month}`).then((response) => response.json()).then((payload) => { if (!payload.success) throw new Error(payload.error?.message); setRecords(payload.data.attendance || []); }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Không thể tải chấm công.")).finally(() => setIsLoading(false)); }, [month]);

  const recordByDate = useMemo(() => new Map(records.map((record) => [String(record.workDate).slice(0, 10), record])), [records]);
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const firstDayIndex = (new Date(year, monthIndex - 1, 1).getDay() + 6) % 7;
  const totalWorkdays = records.reduce((sum, record) => sum + Number(record.workdayCount || 0), 0);
  const totalOt = records.reduce((sum, record) => sum + Number(record.overtimeHours || 0), 0);
  const lateCount = records.filter((record) => Number(record.lateMinutes || 0) > 0).length;
  const changeMonth = (offset: number) => { const date = new Date(year, monthIndex - 1 + offset, 1); setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`); };

  return <PersonalShell user={user}>
    <section className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8"><p className="text-sm font-bold tracking-wide text-cyan-200">LỊCH LÀM VIỆC</p><h1 className="mt-2 text-3xl font-black">Chấm công của bạn</h1><p className="mt-2 text-sm text-slate-300">Theo dõi ngày làm, tăng ca và các mốc cần lưu ý ngay trên lịch.</p></section>
    <section className="grid gap-3 sm:grid-cols-3"><SmallStat label="Ngày công" value={`${totalWorkdays.toFixed(1)} công`} /><SmallStat label="Tăng ca" value={`${totalOt.toFixed(1)} giờ`} /><SmallStat label="Đi trễ" value={`${lateCount} ngày`} /></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Tháng {monthIndex}/{year}</h2><p className="mt-1 text-sm text-slate-500">Mỗi ô thể hiện trạng thái chấm công trong ngày.</p></div><div className="flex gap-2"><button onClick={() => changeMonth(-1)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 hover:bg-slate-50"><ChevronLeft className="h-5 w-5" /></button><button onClick={() => changeMonth(1)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 hover:bg-slate-50"><ChevronRight className="h-5 w-5" /></button></div></div><div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-slate-600"><Legend tone="bg-emerald-100" label="Đi làm" /><Legend tone="bg-blue-100" label="Có tăng ca" /><Legend tone="bg-amber-100" label="Đi trễ / về sớm" /><Legend tone="bg-rose-100" label="Nghỉ / không có công" /></div>{error ? <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : <div className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-2">{weekDays.map((day) => <div key={day} className="py-2 text-center text-xs font-black text-slate-400">{day}</div>)}{Array.from({ length: firstDayIndex }).map((_, index) => <div key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const dateKey = `${month}-${String(day).padStart(2, "0")}`; const record = recordByDate.get(dateKey); return <CalendarCell key={dateKey} day={day} record={record} loading={isLoading} />; })}</div>}</section>
  </PersonalShell>;
}

function CalendarCell({ day, record, loading }: { day: number; record: any; loading: boolean }) { const hasWork = Number(record?.workdayCount || 0) > 0; const hasOt = Number(record?.overtimeHours || 0) > 0; const hasIssue = Number(record?.lateMinutes || 0) > 0 || Number(record?.earlyLeaveMinutes || 0) > 0; const tone = !record ? "bg-slate-50 text-slate-400" : !hasWork ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100" : hasIssue ? "bg-amber-50 text-amber-800 ring-1 ring-amber-100" : hasOt ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"; return <div className={`min-h-20 rounded-xl p-2 sm:min-h-28 sm:p-3 ${tone}`}><p className="text-sm font-black">{day}</p>{loading ? <div className="mt-3 h-3 animate-pulse rounded bg-slate-200" /> : record ? <div className="mt-2 space-y-1 text-[10px] font-bold leading-tight sm:text-xs"><p>{hasWork ? `${Number(record.workdayCount).toFixed(1)} công` : record.symbol || "Nghỉ"}</p>{hasOt && <p className="text-blue-700">+{Number(record.overtimeHours).toFixed(1)}h OT</p>}{hasIssue && <p className="text-amber-700">{Number(record.lateMinutes || 0) > 0 ? `Trễ ${record.lateMinutes}p` : `Sớm ${record.earlyLeaveMinutes}p`}</p>}<p className="hidden sm:block">{record.checkIn?.slice(0, 5) || "--:--"} · {record.checkOut?.slice(0, 5) || "--:--"}</p></div> : null}</div>; }
function SmallStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
function Legend({ tone, label }: { tone: string; label: string }) { return <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${tone}`} />{label}</span>; }
