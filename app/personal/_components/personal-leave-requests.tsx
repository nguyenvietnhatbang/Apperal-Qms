"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Loader2, X } from "lucide-react";

type LeaveRequest = { id: string; leaveType: "paid_leave" | "sick_leave" | "late_with_permission"; leaveDate: string; durationDays: string | number; reason: string; status: string; reviewNote: string | null };

const typeLabels = { paid_leave: "Phép hưởng lương", sick_leave: "Nghỉ ốm hưởng lương", late_with_permission: "Đi trễ có phép" };
const statusLabels: Record<string, string> = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", cancelled: "Đã hủy" };

export default function PersonalLeaveRequests() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveType, setLeaveType] = useState<LeaveRequest["leaveType"]>("paid_leave");
  const [leaveDate, setLeaveDate] = useState("");
  const [durationDays, setDurationDays] = useState<0.5 | 1>(1);
  const [reason, setReason] = useState("");

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/personal/leave-requests");
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error?.message);
      setRequests(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải lịch sử đơn nghỉ.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadRequests(); });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch("/api/personal/leave-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leaveType, leaveDate, durationDays, reason }) });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error?.message);
      setIsDialogOpen(false);
      setReason("");
      await loadRequests();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể gửi đơn nghỉ.");
    } finally {
      setIsSaving(false);
    }
  };

  return <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Leave requests</p><h2 className="mt-1 text-lg font-black text-slate-950">Đơn nghỉ của tôi</h2><p className="mt-1 text-sm text-slate-500">Phép và nghỉ ốm được tính lương sau khi đơn được duyệt.</p></div><button type="button" onClick={() => { setError(null); setIsDialogOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white hover:bg-emerald-600"><CalendarPlus className="h-4 w-4" />Tạo đơn nghỉ</button></div>
    {error && !isDialogOpen && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
    {isLoading ? <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Đang tải đơn nghỉ...</div> : requests.length === 0 ? <p className="mt-4 text-sm text-slate-500">Chưa có đơn nghỉ.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Ngày</th><th className="px-3 py-2.5">Loại đơn</th><th className="px-3 py-2.5">Thời lượng</th><th className="px-3 py-2.5">Lý do</th><th className="px-3 py-2.5">Trạng thái</th></tr></thead><tbody>{requests.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-3 font-semibold">{String(item.leaveDate).slice(0, 10).split("-").reverse().join("/")}</td><td className="px-3 py-3">{typeLabels[item.leaveType]}</td><td className="px-3 py-3">{Number(item.durationDays).toFixed(1)} ngày</td><td className="max-w-72 truncate px-3 py-3" title={item.reason}>{item.reason}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.status === "approved" ? "bg-emerald-100 text-emerald-700" : item.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{statusLabels[item.status]}</span>{item.reviewNote && <p className="mt-1 max-w-52 text-xs text-slate-500">{item.reviewNote}</p>}</td></tr>)}</tbody></table></div>}
    {isDialogOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"><form onSubmit={submit} className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-xl"><header className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="font-black text-slate-950">Tạo đơn nghỉ</h3><p className="mt-1 text-sm text-slate-500">Đơn cần được duyệt trước khi áp dụng vào lương.</p></div><button type="button" onClick={() => setIsDialogOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><div className="grid gap-4 p-5"><label className="grid gap-1.5 text-sm font-bold text-slate-700">Loại đơn<select value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveRequest["leaveType"])} className="rounded-lg border border-slate-300 px-3 py-2.5 font-medium"><option value="paid_leave">Phép hưởng lương</option><option value="sick_leave">Nghỉ ốm hưởng lương</option><option value="late_with_permission">Đi trễ có phép</option></select></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-bold text-slate-700">Ngày nghỉ<input required type="date" value={leaveDate} onChange={(event) => setLeaveDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 font-medium" /></label><label className="grid gap-1.5 text-sm font-bold text-slate-700">Thời lượng<select value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value) as 0.5 | 1)} className="rounded-lg border border-slate-300 px-3 py-2.5 font-medium"><option value={1}>Cả ca · 1 ngày</option><option value={0.5}>Nửa ca · 0.5 ngày</option></select></label></div><label className="grid gap-1.5 text-sm font-bold text-slate-700">Lý do<textarea required minLength={3} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 rounded-lg border border-slate-300 px-3 py-2.5 font-medium" placeholder="Nhập lý do..." /></label>{error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}</div><footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={() => setIsDialogOpen(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600">Hủy</button><button disabled={isSaving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{isSaving ? "Đang gửi..." : "Gửi đơn"}</button></footer></form></div>}
  </section>;
}
