/**
 * Utility functions for formatting currencies, numbers, and dates.
 */

/**
 * Format a number to Vietnamese Dong currency format: e.g. 15.100.000
 */
export function formatVND(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  // Round to nearest integer (or round to nearest thousand if needed, but standard VND is integer format)
  const rounded = Math.round(num);
  return new Intl.NumberFormat("vi-VN").format(rounded);
}

/**
 * Format a number to standard decimal format with a specific precision: e.g., 23.5 -> 23,5 (Vietnamese style) or 23.5
 */
export function formatDecimal(val: number | string | null | undefined, precision = 2, vnStyle = true): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "0";
  
  // Remove trailing zeros after decimal point
  const formatted = Number(num.toFixed(precision)).toString();
  if (vnStyle) {
    return formatted.replace(".", ",");
  }
  return formatted;
}

/**
 * Parse a Vietnamese decimal string (e.g. "23,5") to a Javascript number (e.g. 23.5)
 */
export function parseVNDecimal(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  
  // Replace Vietnamese thousands separator (dots) with empty, and decimal separator (comma) with dot
  // Note: if there are dots like "15.100.000", remove them.
  let cleaned = val.toString().trim();
  
  // If there are commas and dots, we need to be careful.
  // Standard format: "23,5" -> "23.5"
  // "1.234,56" -> "1234.56"
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Has both. Assume dots are thousands and commas are decimals
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    // Has comma. If it acts as a decimal separator (e.g., "23,5" or "23,50"), replace with dot.
    // If it acts as thousands separator like "1,234", wait, in Vietnamese it's usually "1.234"
    cleaned = cleaned.replace(",", ".");
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Format date string (YYYY-MM-DD) to DD/MM/YYYY
 */
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "";
  
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format cycle code YYYY-MM to readable Vietnamese format: e.g. "Tháng 05/2026"
 */
export function formatCycleName(code: string): string {
  if (!code || !code.includes("-")) return code;
  const [year, month] = code.split("-");
  return `Tháng ${month}/${year}`;
}
