import { describe, expect, it } from "vitest";
import {
  normalizeAttendanceRow,
  parseAttendanceBuffer,
  parseVietnameseDate,
} from "@/features/timekeeping/services/attendance-cleaning-service";

describe("attendance parsing", () => {
  it("finds the real header and normalizes rows", () => {
    const content = [
      "CHI TIET CHAM CONG",
      "Tu ngay 01/04/2026 den ngay 11/04/2026",
      "Mã N.Viên\tTên nhân viên\tNgày\tCông\tGiờ\tTC1\tTC2\tTC3\tTổng giờ",
      "16NAT\tNGUYEN ANH TU\t01/04/2026\t0,5\t4\t1,5\t0\t0\t5,5",
    ].join("\n");
    const rows = parseAttendanceBuffer("test.csv", Buffer.from(content));
    expect(rows).toHaveLength(1);
    expect(normalizeAttendanceRow(rows[0].raw)).toMatchObject({
      employeeCode: "16NAT",
      workDate: "2026-04-01",
      workdayCount: 0.5,
      overtimeNormalHours: 1.5,
    });
  });

  it("parses dd/MM/yyyy dates", () => {
    expect(parseVietnameseDate("11/04/2026")).toBe("2026-04-11");
  });
});
