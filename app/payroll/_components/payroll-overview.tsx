"use client";

import { BarChart3, CalendarDays, Users, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatVND } from "@/lib/format";

interface PayrollOverviewProps {
  isAuditOnlyUser: boolean;
  cycles: any[];
  employees: any[];
  selectedCycle: any;
  attendanceRecords: any[];
  payrollItems: any[];
  verificationAttendanceRecords: any[];
  verificationPayrollItems: any[];
}

const statusLabels: Record<string, string> = { draft: "Nháp", imported: "Đã nhập", cleaned: "Đã xử lý", calculated: "Đã tính", locked: "Đã chốt", paid: "Đã chi trả" };
const chartColors = ["#2563eb", "#14b8a6", "#f59e0b", "#8b5cf6", "#64748b", "#ec4899"];

export default function PayrollOverview(props: PayrollOverviewProps) {
  const records = props.isAuditOnlyUser ? props.verificationAttendanceRecords : props.attendanceRecords;
  const payrollItems = props.isAuditOnlyUser ? props.verificationPayrollItems : props.payrollItems;
  const totalWorkdays = records.reduce((sum, item) => sum + Number(item.workdayCount || 0), 0);
  const totalNetSalary = payrollItems.reduce((sum, item) => sum + Number(item.netSalary || 0), 0);
  const statusData = Object.entries(props.cycles.reduce<Record<string, number>>((result, cycle) => {
    result[cycle.status] = (result[cycle.status] || 0) + 1;
    return result;
  }, {})).map(([status, value]) => ({ name: statusLabels[status] || status, value }));
  const employeesById = new Map(props.employees.map((employee) => [employee.id, employee]));
  const payrollByDepartment = Object.entries(payrollItems.reduce<Record<string, number>>((result, item) => {
    const employee = employeesById.get(item.employeeId);
    const departmentName = employee?.departmentName || "Chưa phân bộ phận";
    result[departmentName] = (result[departmentName] || 0) + Number(item.netSalary || 0);
    return result;
  }, {})).map(([name, amount]) => ({ name, amount })).sort((left, right) => right.amount - left.amount).slice(0, 6);

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-black text-zinc-900">Tổng quan kỳ lương</h2><p className="mt-1 text-sm text-zinc-500">{props.selectedCycle?.name || "Chưa chọn kỳ lương"}</p></div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Cập nhật theo dữ liệu hiện có</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Users />} label="Nhân sự hoạt động" value={String(props.employees.filter((item) => item.status === "active").length)} />
        <Metric icon={<CalendarDays />} label="Tổng ngày công" value={`${totalWorkdays.toFixed(1)} công`} />
        <Metric icon={<WalletCards />} label={props.isAuditOnlyUser ? "Thực nhận ước tính" : "Thực nhận kỳ này"} value={formatVND(totalNetSalary)} />
        <Metric icon={<BarChart3 />} label="Dòng dữ liệu kỳ này" value={String(records.length)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><h3 className="font-black text-zinc-900">Chi trả theo bộ phận</h3><p className="mt-1 text-sm text-zinc-500">Phân bổ thực nhận trong kỳ đang chọn</p><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={payrollByDepartment}><CartesianGrid vertical={false} stroke="#e4e4e7" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `${Math.round(value / 1_000_000)}tr`} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => formatVND(Number(value))} /><Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><h3 className="font-black text-zinc-900">Trạng thái kỳ lương</h3><p className="mt-1 text-sm text-zinc-500">Phân bổ các kỳ hiện có</p><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={3}>{statusData.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-2 text-xs">{statusData.map((item, index) => <div key={item.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />{item.name}: {item.value}</div>)}</div></section>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-bold text-zinc-500">{icon}{label}</div><p className="mt-3 text-2xl font-black text-zinc-900">{value}</p></div>;
}
