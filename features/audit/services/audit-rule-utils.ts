export interface AuditRuleConfig {
  maxOvertimeHoursPerDay: number;
  maxOvertimeHoursPerMonth: number;
  maxOvertimeHoursPerYear: number;
  allowSundayWork: boolean;
  enableOvertimeTier2: boolean;
}

export interface AuditAttendanceInput {
  workDate: string | Date;
  weekdayName?: string | null;
  workdayCount: number;
  workHours: number;
  overtimeNormalHours: number;
  overtimeSundayHours: number;
  overtimeHolidayHours: number;
}

export interface AuditAttendanceResult {
  workdayCount: number;
  workHours: number;
  overtimeNormalHours: number;
  overtimeSundayHours: number;
  overtimeHolidayHours: number;
  reasons: string[];
}

const sundayNames = new Set(["chu nhat", "chunhat", "cn", "sunday", "sun"]);

function normalizeText(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "");
}

export function isSundayWorkDate(workDate: string | Date, weekdayName?: string | null) {
  const normalizedWeekday = normalizeText(weekdayName);
  // Imported PostgreSQL dates can be represented as the previous UTC day in
  // Asia/Ho_Chi_Minh. When the source supplies a weekday, it is authoritative.
  if (normalizedWeekday) return sundayNames.has(normalizedWeekday);

  const date = typeof workDate === "string" ? new Date(`${workDate}T00:00:00Z`) : workDate;
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 0;
}

export function reduceOvertimeToDailyRemainder(hours: number, dailyLimit: number) {
  if (hours <= 0 || dailyLimit <= 0) return 0;
  return Math.max(0, Number(Math.min(hours, dailyLimit).toFixed(2)));
}

export function auditDailyAttendance(input: AuditAttendanceInput, config: AuditRuleConfig): AuditAttendanceResult {
  const reasons: string[] = [];

  if (!config.allowSundayWork && isSundayWorkDate(input.workDate, input.weekdayName)) {
    return {
      workdayCount: 0,
      workHours: 0,
      overtimeNormalHours: 0,
      overtimeSundayHours: 0,
      overtimeHolidayHours: 0,
      reasons: ["Không tính công/tăng ca Chủ Nhật theo cấu hình audit."],
    };
  }

  const tier2Hours = config.enableOvertimeTier2 ? input.overtimeSundayHours : 0;
  const normalOvertimeSource = input.overtimeNormalHours + (config.enableOvertimeTier2 ? 0 : input.overtimeSundayHours);
  // Keep approved daily OT from the raw import intact here. The payroll audit
  // applies the configured monthly/yearly ceiling cumulatively afterwards.
  const auditedNormalOvertime = normalOvertimeSource;

  if (!config.enableOvertimeTier2 && input.overtimeSundayHours > 0) {
    reasons.push("TC2 được đưa về TC1 vì audit không bật tăng ca 2.");
  }

  return {
    workdayCount: input.workdayCount,
    workHours: input.workHours,
    overtimeNormalHours: auditedNormalOvertime,
    overtimeSundayHours: tier2Hours,
    overtimeHolidayHours: input.overtimeHolidayHours,
    reasons,
  };
}
