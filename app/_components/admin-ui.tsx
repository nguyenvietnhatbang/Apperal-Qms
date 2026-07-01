"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

type ApiList<T> = {
  success: true;
  data: T[];
  pagination?: { page: number; limit: number; total: number };
};

type ApiData<T> = {
  success: true;
  data: T;
};

type ApiError = {
  success: false;
  error: { message: string; details?: unknown };
};

type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "password" | "checkbox" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type ResourceConfig<T extends { id: string }> = {
  key: string;
  title: string;
  description: string;
  endpoint: string;
  columns: Column<T>[];
  fields: Field[];
  searchPlaceholder?: string;
  defaultItem: Record<string, unknown>;
  beforeSubmit?: (values: Record<string, unknown>) => Record<string, unknown>;
  extraActions?: (row: T, reload: () => void) => React.ReactNode;
};

function apiMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Không thể tải dữ liệu";
}

async function readApi<T>(response: Response) {
  const payload = (await response.json()) as ApiData<T> | ApiList<T> | ApiError;
  if (!payload.success) throw new Error(payload.error.message);
  return payload;
}

function StatusBadge({ value }: { value: unknown }) {
  const text = String(value ?? "");
  const normalized = text.toLowerCase();
  const labelMap: Record<string, string> = {
    active: "Đang hoạt động",
    inactive: "Tạm dừng",
    locked: "Đã khóa",
    paid: "Đã chi trả",
    cancelled: "Đã hủy",
    terminated: "Đã nghỉ",
    draft: "Nháp",
    imported: "Đã import",
    cleaned: "Đã làm sạch",
    calculated: "Đã tính",
    admin: "Admin",
    user: "User",
    role: "Role",
  };
  const tone =
    normalized === "active" || normalized === "admin" || normalized === "cleaned" || normalized === "calculated"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "locked" || normalized === "paid"
        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
        : normalized === "inactive" || normalized === "cancelled" || normalized === "terminated"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : normalized === "draft" || normalized === "imported" || normalized === "user" || normalized === "role"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <span className={`inline-flex min-w-16 justify-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {labelMap[normalized] ?? text}
    </span>
  );
}

export function AdminShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-3 py-3 sm:px-4 lg:px-5">
        <header className="flex min-h-14 flex-col gap-2 border-b border-zinc-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Hệ thống nội bộ</div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-normal">{title}</h1>
            <p className="mt-0.5 text-sm text-zinc-600">{description}</p>
          </div>
          <a className="btn-secondary" href="/modules">
            Danh sách module
          </a>
        </header>
        {children}
      </div>
    </main>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <aside className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm">
      <div className="mb-2 flex items-center gap-2 border-b border-zinc-100 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <LayoutDashboard className="h-4 w-4" />
        Điều hướng
      </div>
      <div className="grid gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
            active === tab.key
              ? "bg-zinc-950 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
          }`}
          type="button"
          onClick={() => onChange(tab.key)}
        >
          <span>{tab.label}</span>
          {active === tab.key ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> : null}
        </button>
      ))}
      </div>
    </aside>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-zinc-950/10">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="icon-btn" title="Đóng" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function ResourceForm({
  fields,
  initial,
  onSubmit,
  submitting,
}: {
  fields: Field[];
  initial: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      {fields.map((field) => {
        const value = values[field.name];
        const common = {
          id: field.name,
          name: field.name,
          required: field.required,
          className: "input",
          value: typeof value === "boolean" ? "" : String(value ?? ""),
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setValues((current) => ({
              ...current,
              [field.name]:
                field.type === "number"
                  ? Number(event.target.value)
                  : event.target.value,
            })),
        };

        return (
          <label key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            <span className="mb-1.5 block text-sm font-semibold text-zinc-700">{field.label}</span>
            {field.type === "checkbox" ? (
              <div className="flex h-10 items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3">
                <input
                  checked={Boolean(value)}
                  className="h-4 w-4 accent-zinc-950"
                  type="checkbox"
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.name]: event.target.checked }))
                  }
                />
                <span className="text-sm text-zinc-600">Bật/tắt</span>
              </div>
            ) : field.type === "select" ? (
              <select {...common}>
                <option value="">-- Chọn --</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea {...common} rows={3} />
            ) : (
              <input {...common} type={field.type ?? "text"} />
            )}
          </label>
        );
      })}
      <div className="-mx-5 -mb-5 mt-2 flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:col-span-2">
        <button className="btn-primary" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Lưu
        </button>
      </div>
    </form>
  );
}

export function ResourceTable<T extends { id: string }>({ config }: { config: ResourceConfig<T> }) {
  const [rows, setRows] = useState<T[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; item?: T } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      page: String(pagination.page),
      limit: String(pagination.limit),
    });
    if (search) params.set("search", search);
    return `${config.endpoint}?${params.toString()}`;
  }, [config.endpoint, pagination.limit, pagination.page, search]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = (await readApi<T[]>(await fetch(url))) as ApiList<T>;
      setRows(payload.data);
      if (payload.pagination) setPagination(payload.pagination);
    } catch (fetchError) {
      setError(apiMessage(fetchError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The table synchronizes with the server whenever filters/pagination change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const submit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    setError("");
    const body = config.beforeSubmit ? config.beforeSubmit(values) : values;
    const endpoint = modal?.mode === "edit" ? `${config.endpoint}/${modal.item?.id}` : config.endpoint;
    const method = modal?.mode === "edit" ? "PATCH" : "POST";

    try {
      await readApi(
        await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setModal(null);
      await load();
    } catch (submitError) {
      setError(apiMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (row: T) => {
    if (!window.confirm("Xác nhận xóa/hủy dữ liệu này?")) return;
    setError("");
    try {
      await readApi(await fetch(`${config.endpoint}/${row.id}`, { method: "DELETE" }));
      await load();
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const rangeStart = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b border-zinc-200 bg-white px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{config.title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{config.description}</p>
        </div>
        {config.fields.length ? (
          <button className="btn-primary" type="button" onClick={() => setModal({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Tạo mới
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 lg:grid-cols-[1fr_auto_auto] lg:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="input pl-9"
            placeholder={config.searchPlaceholder ?? "Tìm kiếm"}
            value={search}
            onChange={(event) => {
              setPagination((current) => ({ ...current, page: 1 }));
              setSearch(event.target.value);
            }}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <Database className="h-4 w-4 text-zinc-400" />
          <span>{pagination.total} bản ghi</span>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            disabled={!search && loading}
            type="button"
            onClick={() => {
              setSearch("");
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          >
            <X className="h-4 w-4" />
            Xóa lọc
          </button>
          <button className="btn-secondary" disabled={loading} type="button" onClick={load}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Tải lại
          </button>
        </div>
      </div>

      {error ? (
        <div className="m-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="overflow-x-auto bg-white">
        <table className="min-w-[960px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
            <tr>
              {config.columns.map((column) => (
                <th key={column.key} className="border-b border-zinc-200 px-3 py-2.5 font-semibold">
                  {column.label}
                </th>
              ))}
              <th className="sticky right-0 z-30 border-b border-l border-zinc-200 bg-zinc-100 px-3 py-2.5 text-right font-semibold shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index} className="border-b border-zinc-100">
                  {config.columns.map((column) => (
                    <td key={column.key} className="px-3 py-2">
                      <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                    </td>
                  ))}
                  <td className="sticky right-0 border-l border-zinc-200 bg-white px-3 py-2">
                    <div className="ml-auto h-8 w-20 animate-pulse rounded bg-zinc-100" />
                  </td>
                </tr>
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 transition-colors hover:bg-emerald-50/35">
                  {config.columns.map((column) => (
                    <td key={column.key} className="max-w-72 truncate px-3 py-2 align-middle text-zinc-800">
                      {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "")}
                    </td>
                  ))}
                  <td className="sticky right-0 z-10 border-l border-zinc-200 bg-white px-3 py-2 text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]">
                    <div className="flex justify-end gap-1">
                      {config.extraActions?.(row, load)}
                      {config.fields.length ? (
                        <>
                          <button className="icon-btn" title="Sửa" type="button" onClick={() => setModal({ mode: "edit", item: row })}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="icon-btn-danger" title="Xóa" type="button" onClick={() => remove(row)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-12 text-center text-zinc-500" colSpan={config.columns.length + 1}>
                  <Database className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
                  <div className="font-medium text-zinc-700">Không có dữ liệu phù hợp</div>
                  <div className="mt-1 text-sm text-zinc-500">Thử xóa bộ lọc hoặc tạo bản ghi mới.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Hiển thị {rangeStart}-{rangeEnd} / {pagination.total}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            disabled={pagination.page <= 1 || loading}
            type="button"
            onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 py-2">
            {pagination.page}/{totalPages}
          </span>
          <button
            className="btn-secondary"
            disabled={pagination.page >= totalPages || loading}
            type="button"
            onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {modal ? (
        <Modal title={modal.mode === "edit" ? "Cập nhật" : "Tạo mới"} onClose={() => setModal(null)}>
          <ResourceForm
            fields={config.fields}
            initial={{ ...config.defaultItem, ...(modal.item as Record<string, unknown> | undefined) }}
            submitting={submitting}
            onSubmit={submit}
          />
        </Modal>
      ) : null}
    </section>
  );
}

export function badge(value: unknown) {
  return <StatusBadge value={value} />;
}
