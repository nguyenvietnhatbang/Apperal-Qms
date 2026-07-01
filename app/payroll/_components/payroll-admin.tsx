"use client";

import { useEffect, useState } from "react";
import { Calculator, Lock, Upload } from "lucide-react";
import { AdminShell, ResourceTable, Tabs, badge, type ResourceConfig } from "@/app/_components/admin-ui";

type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  gender: string | null;
  departmentName: string | null;
  positionTitle: string | null;
  status: string;
};

type Rule = {
  id: string;
  code: string;
  name: string;
  value: string;
  unit: string;
  isActive: boolean;
};

type Cycle = {
  id: string;
  code: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  standardWorkdays: string;
  status: string;
};

type PayrollItem = {
  id: string;
  cycleCode: string;
  employeeCode: string;
  employeeName: string;
  actualWorkdays: string;
  grossIncome: string;
  totalDeduction: string;
  netSalary: string;
};

type SalaryConfig = {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  totalSalary: string;
  insuranceSalary: string;
  baseSalary: string;
};

async function postAction(endpoint: string, body?: unknown) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.error?.message ?? "Thao tác thất bại");
  return payload.data;
}

function CycleActions({ row, reload }: { row: Cycle; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (action: "calculate" | "locked" | "paid" | "calculated") => {
    setBusy(true);
    try {
      if (action === "calculate") await postAction(`/api/payroll/cycles/${row.id}/calculate`);
      else await postAction(`/api/payroll/cycles/${row.id}/status`, { status: action });
      reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="icon-btn" disabled={busy} title="Tính lương" type="button" onClick={() => run("calculate")}>
        <Calculator className="h-4 w-4" />
      </button>
      <button className="icon-btn" disabled={busy} title="Khóa chu kỳ" type="button" onClick={() => run("locked")}>
        <Lock className="h-4 w-4" />
      </button>
    </>
  );
}

function ImportPanel() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/payroll/cycles?limit=100")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) setCycles(payload.data);
      });
  }, []);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-white px-4 py-4">
        <h2 className="text-lg font-semibold">Import chấm công</h2>
        <p className="mt-1 text-sm text-zinc-600">Upload CSV/XLSX, hệ thống tự tìm header và làm sạch dữ liệu.</p>
      </div>
      <form
        className="grid gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-4 lg:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!cycleId || !file) return;
          setBusy(true);
          setMessage("");
          const formData = new FormData();
          formData.set("payrollCycleId", cycleId);
          formData.set("file", file);
          const response = await fetch("/api/timekeeping/imports", { method: "POST", body: formData });
          const payload = await response.json();
          setBusy(false);
          setMessage(
            payload.success
              ? `Import xong: ${payload.data.validRows}/${payload.data.totalRows} dòng hợp lệ`
              : payload.error?.message ?? "Import thất bại",
          );
        }}
      >
        <select className="input" value={cycleId} onChange={(event) => setCycleId(event.target.value)}>
          <option value="">Chọn chu kỳ</option>
          {cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.code} - {cycle.name}
            </option>
          ))}
        </select>
        <input className="input" type="file" accept=".csv,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button className="btn-primary" disabled={busy} type="submit">
          <Upload className="h-4 w-4" />
          Import
        </button>
      </form>
      {message ? <div className="m-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}
    </section>
  );
}

function SalaryConfigPanel() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [configs, setConfigs] = useState<SalaryConfig[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    effectiveFrom: "",
    effectiveTo: "",
    totalSalary: 0,
    insuranceSalary: 0,
    baseSalary: 0,
    positionAllowance: 0,
    responsibilityAllowance: 0,
    seniorityAllowance: 0,
    safetyAllowance: 0,
    phoneAllowance: 0,
    travelAllowance: 0,
    housingAllowance: 0,
    attendanceBonus: 0,
    otherBonus: 0,
    mealAllowance: 0,
    note: "",
  });

  const loadConfigs = async (id = employeeId) => {
    if (!id) return;
    const response = await fetch(`/api/employees/${id}/salary-configs`);
    const payload = await response.json();
    if (payload.success) setConfigs(payload.data);
  };

  useEffect(() => {
    fetch("/api/employees?limit=100")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) setEmployees(payload.data);
      });
  }, []);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-white px-4 py-4">
        <h2 className="text-lg font-semibold">Cấu hình lương nhân viên</h2>
        <p className="mt-1 text-sm text-zinc-600">Mỗi nhân viên có nhiều cấu hình theo thời gian hiệu lực.</p>
      </div>
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-4">
        <label className="block max-w-xl">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-700">Nhân viên</span>
          <select
            className="input"
            value={employeeId}
            onChange={(event) => {
              setEmployeeId(event.target.value);
              void loadConfigs(event.target.value);
            }}
          >
            <option value="">Chọn nhân viên</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employeeCode} - {employee.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form
        className="grid gap-4 px-4 py-4 sm:grid-cols-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!employeeId) return;
          const response = await fetch(`/api/employees/${employeeId}/salary-configs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const payload = await response.json();
          setMessage(payload.success ? "Đã lưu cấu hình lương" : payload.error?.message ?? "Lưu thất bại");
          if (payload.success) await loadConfigs();
        }}
      >
        {[
          ["effectiveFrom", "Hiệu lực từ", "date"],
          ["effectiveTo", "Hiệu lực đến", "date"],
          ["totalSalary", "Tổng lương", "number"],
          ["insuranceSalary", "Lương đóng BH", "number"],
          ["baseSalary", "Lương cơ bản", "number"],
          ["positionAllowance", "PC chức danh", "number"],
          ["responsibilityAllowance", "PC trách nhiệm", "number"],
          ["seniorityAllowance", "PC thâm niên", "number"],
          ["mealAllowance", "PC cơm", "number"],
          ["otherBonus", "Thưởng/hỗ trợ khác", "number"],
        ].map(([name, label, type]) => (
          <label key={name}>
            <span className="mb-1.5 block text-sm font-semibold text-zinc-700">{label}</span>
            <input
              className="input"
              type={type}
              value={String(form[name as keyof typeof form] ?? "")}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [name]: type === "number" ? Number(event.target.value) : event.target.value,
                }))
              }
            />
          </label>
        ))}
        <label className="sm:col-span-3">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-700">Ghi chú</span>
          <textarea
            className="input"
            rows={2}
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          />
        </label>
        <div className="flex justify-end border-t border-zinc-200 pt-4 sm:col-span-3">
          <button className="btn-primary" type="submit">
            Lưu cấu hình
          </button>
        </div>
      </form>
      {message ? <div className="mx-4 mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}
      <div className="overflow-x-auto border-t border-zinc-200">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-3 py-2">Từ ngày</th>
              <th className="px-3 py-2">Đến ngày</th>
              <th className="px-3 py-2">Tổng lương</th>
              <th className="px-3 py-2">Lương BH</th>
              <th className="px-3 py-2">Lương cơ bản</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => (
              <tr key={config.id} className="border-t border-zinc-100 hover:bg-emerald-50/35">
                <td className="px-3 py-2">{config.effectiveFrom}</td>
                <td className="px-3 py-2">{config.effectiveTo ?? ""}</td>
                <td className="px-3 py-2">{config.totalSalary}</td>
                <td className="px-3 py-2">{config.insuranceSalary}</td>
                <td className="px-3 py-2">{config.baseSalary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PayrollAdmin() {
  const [active, setActive] = useState("employees");

  const employeeConfig: ResourceConfig<Employee> = {
    key: "employees",
    title: "Nhân viên",
    description: "Hồ sơ nhân viên dùng để map mã chấm công và cấu hình lương.",
    endpoint: "/api/employees",
    defaultItem: {
      employeeCode: "",
      fullName: "",
      gender: "",
      departmentName: "",
      positionTitle: "",
      joinedDate: "",
      status: "active",
      dependentCount: 0,
      hasChildUnder6: false,
    },
    columns: [
      { key: "employeeCode", label: "Mã NV" },
      { key: "fullName", label: "Họ tên" },
      { key: "departmentName", label: "Phòng ban" },
      { key: "positionTitle", label: "Chức vụ" },
      { key: "status", label: "Trạng thái", render: (row) => badge(row.status) },
    ],
    fields: [
      { name: "employeeCode", label: "Mã nhân viên", required: true },
      { name: "fullName", label: "Họ tên", required: true },
      { name: "gender", label: "Giới tính" },
      { name: "departmentName", label: "Phòng ban" },
      { name: "positionTitle", label: "Chức vụ" },
      { name: "joinedDate", label: "Ngày vào", type: "date" },
      {
        name: "status",
        label: "Trạng thái",
        type: "select",
        options: [
          { value: "active", label: "Đang hoạt động" },
          { value: "inactive", label: "Tạm dừng" },
          { value: "terminated", label: "Đã nghỉ" },
        ],
      },
      { name: "dependentCount", label: "Số người phụ thuộc", type: "number" },
      { name: "hasChildUnder6", label: "Có con dưới 6 tuổi", type: "checkbox" },
    ],
  };

  const ruleConfig: ResourceConfig<Rule> = {
    key: "rules",
    title: "Quy tắc tính lương",
    description: "Các rule đang active sẽ được snapshot khi tính lương.",
    endpoint: "/api/payroll/rules",
    defaultItem: { code: "", name: "", value: 0, unit: "number", description: "", isActive: true },
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Tên" },
      { key: "value", label: "Giá trị" },
      { key: "unit", label: "Đơn vị" },
      { key: "isActive", label: "Trạng thái", render: (row) => badge(row.isActive ? "active" : "inactive") },
    ],
    fields: [
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Tên", required: true },
      { name: "value", label: "Giá trị", type: "number" },
      { name: "unit", label: "Đơn vị" },
      { name: "description", label: "Mô tả", type: "textarea" },
      { name: "isActive", label: "Đang áp dụng", type: "checkbox" },
    ],
  };

  const cycleConfig: ResourceConfig<Cycle> = {
    key: "cycles",
    title: "Chu kỳ lương",
    description: "Tạo chu kỳ, import chấm công, tính lương và chốt trạng thái.",
    endpoint: "/api/payroll/cycles",
    defaultItem: {
      code: "",
      name: "",
      periodStart: "",
      periodEnd: "",
      standardWorkdays: 26,
      standardHoursPerDay: 8,
      note: "",
    },
    columns: [
      { key: "code", label: "Mã kỳ" },
      { key: "name", label: "Tên kỳ" },
      { key: "periodStart", label: "Từ ngày" },
      { key: "periodEnd", label: "Đến ngày" },
      { key: "standardWorkdays", label: "Công chuẩn" },
      { key: "status", label: "Trạng thái", render: (row) => badge(row.status) },
    ],
    fields: [
      { name: "code", label: "Mã chu kỳ", required: true },
      { name: "name", label: "Tên chu kỳ", required: true },
      { name: "periodStart", label: "Từ ngày", type: "date", required: true },
      { name: "periodEnd", label: "Đến ngày", type: "date", required: true },
      { name: "standardWorkdays", label: "Ngày công chuẩn", type: "number" },
      { name: "standardHoursPerDay", label: "Giờ/ngày", type: "number" },
      { name: "note", label: "Ghi chú", type: "textarea" },
    ],
    extraActions: (row, reload) => <CycleActions row={row} reload={reload} />,
  };

  const itemConfig: ResourceConfig<PayrollItem> = {
    key: "items",
    title: "Bảng lương",
    description: "Kết quả tính lương snapshot theo chu kỳ và nhân viên.",
    endpoint: "/api/payroll/items",
    defaultItem: {},
    columns: [
      { key: "cycleCode", label: "Chu kỳ" },
      { key: "employeeCode", label: "Mã NV" },
      { key: "employeeName", label: "Họ tên" },
      { key: "actualWorkdays", label: "Công" },
      { key: "grossIncome", label: "Tổng thu nhập" },
      { key: "totalDeduction", label: "Khấu trừ" },
      { key: "netSalary", label: "Thực nhận" },
    ],
    fields: [],
  };

  return (
    <AdminShell title="Chấm công / Tính lương" description="Quản lý nhân viên, import chấm công, chu kỳ và bảng lương.">
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Tabs
          active={active}
          tabs={[
            { key: "employees", label: "Nhân viên" },
            { key: "salary", label: "Cấu hình lương" },
            { key: "rules", label: "Quy tắc" },
            { key: "cycles", label: "Chu kỳ" },
            { key: "import", label: "Import chấm công" },
            { key: "items", label: "Bảng lương" },
          ]}
          onChange={setActive}
        />
        <div className="min-w-0">
          {active === "employees" ? <ResourceTable config={employeeConfig} /> : null}
          {active === "salary" ? <SalaryConfigPanel /> : null}
          {active === "rules" ? <ResourceTable config={ruleConfig} /> : null}
          {active === "cycles" ? <ResourceTable config={cycleConfig} /> : null}
          {active === "import" ? <ImportPanel /> : null}
          {active === "items" ? <ResourceTable config={itemConfig} /> : null}
        </div>
      </div>
    </AdminShell>
  );
}
