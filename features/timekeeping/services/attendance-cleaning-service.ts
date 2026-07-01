import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { toNumber } from "@/lib/format";
import type { ParsedAttendanceRow } from "@/features/timekeeping/types/timekeeping-types";

const emptyTokens = new Set(["", "-", "-----"]);

export function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function nullIfBlank(value: unknown) {
  const text = normalizeText(value);
  return emptyTokens.has(text) ? null : text;
}

export function parseVietnameseDate(value: unknown) {
  const text = normalizeText(value);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseTime(value: unknown) {
  const text = normalizeText(value);
  if (emptyTokens.has(text)) return null;
  return /^\d{1,2}:\d{2}$/.test(text) ? text : null;
}

export function parseNumeric(value: unknown) {
  const text = normalizeText(value);
  if (emptyTokens.has(text)) return 0;
  return toNumber(text, 0);
}

export function parseAttendanceBuffer(fileName: string, buffer: Buffer): ParsedAttendanceRow[] {
  const lower = fileName.toLowerCase();
  const records: string[][] =
    lower.endsWith(".xlsx") || lower.endsWith(".xls")
      ? XLSX.utils.sheet_to_json<string[]>(XLSX.read(buffer).Sheets[XLSX.read(buffer).SheetNames[0]], {
          header: 1,
          blankrows: false,
          raw: false,
        })
      : parse(buffer, {
          delimiter: "\t",
          relax_column_count: true,
          skip_empty_lines: false,
          bom: true,
        });

  const headerIndex = records.findIndex((row) => row.some((cell) => normalizeText(cell) === "Mã N.Viên"));
  if (headerIndex < 0) return [];

  const headers = records[headerIndex].map(normalizeText);
  return records.slice(headerIndex + 1).flatMap((row, index) => {
    if (!row.some((cell) => normalizeText(cell))) return [];
    const raw = Object.fromEntries(headers.map((header, cellIndex) => [header, normalizeText(row[cellIndex])]));
    return [{ rowNumber: headerIndex + index + 2, raw }];
  });
}

export function normalizeAttendanceRow(raw: Record<string, string>) {
  return {
    employeeCode: normalizeText(raw["Mã N.Viên"]),
    employeeName: normalizeText(raw["Tên nhân viên"]),
    departmentName: nullIfBlank(raw["Phòng ban"]),
    positionTitle: nullIfBlank(raw["Chức vụ"]),
    workDate: parseVietnameseDate(raw["Ngày"]),
    weekdayName: nullIfBlank(raw["Thứ"]),
    checkIn1: parseTime(raw["Vào 1"]),
    checkOut1: parseTime(raw["Ra 1"]),
    checkIn2: parseTime(raw["Vào 2"]),
    checkOut2: parseTime(raw["Ra 2"]),
    checkIn3: parseTime(raw["Vào 3"]),
    checkOut3: parseTime(raw["Ra 3"]),
    workdayCount: parseNumeric(raw["Công"]),
    workHours: parseNumeric(raw["Giờ"]),
    extraWorkdayCount: parseNumeric(raw["Công+"]),
    extraHours: parseNumeric(raw["Giờ+"]),
    lateMinutes: Math.round(parseNumeric(raw["Vào Trễ"])),
    earlyLeaveMinutes: Math.round(parseNumeric(raw["Ra sớm"])),
    overtimeNormalHours: parseNumeric(raw["TC1"]),
    overtimeSundayHours: parseNumeric(raw["TC2"]),
    overtimeHolidayHours: parseNumeric(raw["TC3"]),
    shiftName: nullIfBlank(raw["Tên ca"]),
    symbol: nullIfBlank(raw["Kí hiệu"]),
    extraSymbol: nullIfBlank(raw["Kí hiệu+"]),
    totalHours: parseNumeric(raw["Tổng giờ"]),
  };
}
