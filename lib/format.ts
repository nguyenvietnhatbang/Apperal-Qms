export function formatDate(value?: string | Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

export function formatMoney(value?: string | number | null) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(numeric);
}

export function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value !== "string") return fallback;
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value: number) {
  return Math.round(value);
}
