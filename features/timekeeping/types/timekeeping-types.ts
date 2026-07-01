import { z } from "zod";

export const attendanceImportSchema = z.object({
  payrollCycleId: z.string().uuid(),
});

export type ParsedAttendanceRow = {
  rowNumber: number;
  raw: Record<string, string>;
};

export type AttendanceValidationError = {
  rowNumber: number;
  employeeCode?: string;
  errors: string[];
};
