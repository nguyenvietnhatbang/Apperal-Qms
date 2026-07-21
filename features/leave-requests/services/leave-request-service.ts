import { query, queryOne } from "@/lib/db";

export const leaveTypes = ["paid_leave", "sick_leave", "late_with_permission"] as const;
export type LeaveType = (typeof leaveTypes)[number];

export interface LeaveRequestInput {
  employeeId: string;
  factoryId: string;
  leaveType: LeaveType;
  leaveDate: string;
  durationDays: number;
  reason: string;
  requestedBy: string;
}

export class LeaveRequestService {
  static async create(input: LeaveRequestInput) {
    return queryOne(
      `INSERT INTO leave_requests (employee_id, factory_id, leave_type, leave_date, duration_days, reason, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [input.employeeId, input.factoryId, input.leaveType, input.leaveDate, input.durationDays, input.reason, input.requestedBy],
    );
  }

  static async listForEmployee(employeeId: string, factoryId: string) {
    return query(
      `SELECT id, leave_type as "leaveType", leave_date as "leaveDate", duration_days as "durationDays", reason,
              status, review_note as "reviewNote", reviewed_at as "reviewedAt", created_at as "createdAt"
       FROM leave_requests
       WHERE employee_id = $1 AND factory_id = $2
       ORDER BY leave_date DESC, created_at DESC`,
      [employeeId, factoryId],
    );
  }

  static async listForApproval(factoryId: string) {
    return query(
      `SELECT lr.id, lr.leave_type as "leaveType", lr.leave_date as "leaveDate", lr.duration_days as "durationDays",
              lr.reason, lr.status, lr.review_note as "reviewNote", lr.created_at as "createdAt",
              e.employee_code as "employeeCode", e.full_name as "employeeName", e.department_name as "departmentName"
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE lr.factory_id = $1
       ORDER BY CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END, lr.leave_date DESC, lr.created_at DESC`,
      [factoryId],
    );
  }

  static async review(id: string, factoryId: string, reviewerId: string, status: "approved" | "rejected", reviewNote: string | null) {
    return queryOne(
      `UPDATE leave_requests
       SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
       WHERE id = $4 AND factory_id = $5 AND status = 'pending'
       RETURNING id`,
      [status, reviewNote, reviewerId, id, factoryId],
    );
  }
}
