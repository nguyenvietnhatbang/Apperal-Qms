import { z } from "zod";

export const departmentSchema = z.object({
  code: z.string().min(2).max(50).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
  isAdmin: z.boolean().default(false),
  isActive: z.boolean().default(true),
  permissions: z
    .array(
      z.object({
        moduleId: z.string().uuid(),
        canView: z.boolean().default(false),
        canCreate: z.boolean().default(false),
        canUpdate: z.boolean().default(false),
        canDelete: z.boolean().default(false),
        canApprove: z.boolean().default(false),
      }),
    )
    .optional(),
});

export const userCreateSchema = z.object({
  username: z.string().min(3).max(80).regex(/^[a-zA-Z0-9_.-]+$/),
  displayName: z.string().min(1).max(150),
  email: z.string().email().optional().nullable().or(z.literal("")),
  departmentId: z.string().uuid().optional().nullable(),
  password: z.string().min(8),
  status: z.enum(["active", "inactive", "locked"]).default("active"),
  isAdmin: z.boolean().default(false),
});

export const userUpdateSchema = userCreateSchema.partial().extend({
  password: z.string().min(8).optional().or(z.literal("")),
});
