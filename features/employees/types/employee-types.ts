import { z } from "zod";

export const employeeSchema = z.object({
  employeeCode: z.string().min(1).max(50),
  fullName: z.string().min(1).max(180),
  gender: z.string().max(20).optional().nullable(),
  departmentName: z.string().max(150).optional().nullable(),
  positionTitle: z.string().max(150).optional().nullable(),
  joinedDate: z.string().optional().nullable(),
  status: z.enum(["active", "inactive", "terminated"]).default("active"),
  dependentCount: z.coerce.number().int().min(0).default(0),
  hasChildUnder6: z.boolean().default(false),
});

export const salaryConfigSchema = z.object({
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional().nullable(),
  totalSalary: z.coerce.number().min(0).default(0),
  insuranceSalary: z.coerce.number().min(0).default(0),
  baseSalary: z.coerce.number().min(0).default(0),
  positionAllowance: z.coerce.number().min(0).default(0),
  responsibilityAllowance: z.coerce.number().min(0).default(0),
  seniorityAllowance: z.coerce.number().min(0).default(0),
  safetyAllowance: z.coerce.number().min(0).default(0),
  phoneAllowance: z.coerce.number().min(0).default(0),
  travelAllowance: z.coerce.number().min(0).default(0),
  housingAllowance: z.coerce.number().min(0).default(0),
  attendanceBonus: z.coerce.number().min(0).default(0),
  otherBonus: z.coerce.number().min(0).default(0),
  mealAllowance: z.coerce.number().min(0).default(0),
  note: z.string().optional().nullable(),
});
