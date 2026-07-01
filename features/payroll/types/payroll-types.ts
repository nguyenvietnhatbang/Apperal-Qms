import { z } from "zod";

export const payrollRuleSchema = z.object({
  code: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(150),
  value: z.coerce.number(),
  unit: z.string().min(1).max(30),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const payrollCycleSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  standardWorkdays: z.coerce.number().positive().default(26),
  standardHoursPerDay: z.coerce.number().positive().default(8),
  note: z.string().optional().nullable(),
});

export const cycleStatusSchema = z.object({
  status: z.enum(["draft", "imported", "cleaned", "calculated", "locked", "paid", "cancelled"]),
});

export type PayrollCycleStatus = z.infer<typeof cycleStatusSchema>["status"];

export type PayrollRuleMap = Record<string, number>;

export type PayrollCalculationInput = {
  totalSalary: number;
  insuranceSalary: number;
  standardWorkdays: number;
  standardHoursPerDay: number;
  paidWorkdays: number;
  paidLeaveDays: number;
  holidayDays: number;
  overtimeNormalHours: number;
  overtimeSundayHours: number;
  overtimeHolidayHours: number;
  allowanceAmount: number;
  advancePayment1?: number;
  advancePayment2?: number;
  personalIncomeTaxAmount?: number;
  rules: PayrollRuleMap;
};
