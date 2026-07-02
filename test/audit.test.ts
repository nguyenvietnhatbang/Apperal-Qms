import { describe, expect, test } from "vitest";
import {
  auditDailyAttendance,
  isSundayWorkDate,
  reduceOvertimeToDailyRemainder,
} from "@/features/audit/services/audit-rule-utils";

const defaultConfig = {
  maxOvertimeHoursPerDay: 4,
  maxOvertimeHoursPerMonth: 40,
  maxOvertimeHoursPerYear: 300,
  allowSundayWork: false,
  enableOvertimeTier2: false,
};

describe("Audit overtime rules", () => {
  test("reduces overtime by 4-hour blocks and keeps the remainder", () => {
    expect(reduceOvertimeToDailyRemainder(9, 4)).toBe(1);
    expect(reduceOvertimeToDailyRemainder(5, 4)).toBe(1);
    expect(reduceOvertimeToDailyRemainder(4.5, 4)).toBe(0.5);
    expect(reduceOvertimeToDailyRemainder(4, 4)).toBe(4);
  });

  test("moves TC2 into TC1 when audit tier 2 is disabled", () => {
    const result = auditDailyAttendance(
      {
        workDate: "2026-07-01",
        workdayCount: 1,
        workHours: 8,
        overtimeNormalHours: 3,
        overtimeSundayHours: 2,
        overtimeHolidayHours: 0,
      },
      defaultConfig
    );

    expect(result.overtimeNormalHours).toBe(1);
    expect(result.overtimeSundayHours).toBe(0);
  });

  test("removes work and overtime on Sundays by default", () => {
    expect(isSundayWorkDate("2026-07-05", "Chủ Nhật")).toBe(true);

    const result = auditDailyAttendance(
      {
        workDate: "2026-07-05",
        weekdayName: "Chủ Nhật",
        workdayCount: 1,
        workHours: 8,
        overtimeNormalHours: 2,
        overtimeSundayHours: 6,
        overtimeHolidayHours: 0,
      },
      defaultConfig
    );

    expect(result.workdayCount).toBe(0);
    expect(result.workHours).toBe(0);
    expect(result.overtimeNormalHours).toBe(0);
    expect(result.overtimeSundayHours).toBe(0);
  });
});
