import { describe, test, expect } from "vitest";
import { parseVNDecimal, formatVND, formatDecimal } from "@/lib/format";

describe("Payroll Formatting & Parsing", () => {
  test("parseVNDecimal should convert Vietnamese decimals to Javascript floats", () => {
    expect(parseVNDecimal("23,5")).toBe(23.5);
    expect(parseVNDecimal("8,02")).toBe(8.02);
    expect(parseVNDecimal("0")).toBe(0);
    expect(parseVNDecimal("12")).toBe(12);
    expect(parseVNDecimal("1.234,56")).toBe(1234.56);
    expect(parseVNDecimal(23.5)).toBe(23.5);
    expect(parseVNDecimal(null)).toBe(0);
    expect(parseVNDecimal("")).toBe(0);
  });

  test("formatVND should format money into Vietnamese dot-separated strings", () => {
    expect(formatVND(15100000)).toBe("15.100.000");
    expect(formatVND("28000000")).toBe("28.000.000");
    expect(formatVND(0)).toBe("0");
    expect(formatVND(null)).toBe("0");
    expect(formatVND(26923076.92)).toBe("26.923.077"); // rounding check
  });

  test("formatDecimal should format floats into Vietnamese comma-separated decimals", () => {
    expect(formatDecimal(23.5, 1)).toBe("23,5");
    expect(formatDecimal(8.024, 2)).toBe("8,02");
    expect(formatDecimal("0", 2)).toBe("0");
  });
});
