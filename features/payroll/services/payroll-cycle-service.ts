import { query, queryOne, transaction } from "@/lib/db";

export interface CycleData {
  id?: string;
  factoryId?: string;
  code: string; // YYYY-MM
  name: string; // e.g. "Tháng 05/2026"
  periodStart: string;
  periodEnd: string;
  standardWorkdays?: number;
  standardHoursPerDay?: number;
  note?: string | null;
}

export class PayrollCycleService {
  /**
   * Get all payroll cycles
   */
  static async getCycles(factoryId: string) {
    return await query(
      `SELECT c.id, c.factory_id as "factoryId", f.name as "factoryName", c.code, c.name,
              c.period_start as "periodStart", c.period_end as "periodEnd",
              c.standard_workdays as "standardWorkdays", c.standard_hours_per_day as "standardHoursPerDay",
              c.status, c.calculated_at as "calculatedAt", c.locked_at as "lockedAt", 
              c.paid_at as "paidAt", c.note, u.display_name as "createdBy", c.created_at as "createdAt"
       FROM payroll_cycles c
       JOIN factories f ON f.id = c.factory_id
       LEFT JOIN app_users u ON c.created_by = u.id
       WHERE c.factory_id = $1
       ORDER BY c.code DESC`,
      [factoryId]
    );
  }

  /**
   * Get cycle details by ID
   */
  static async getCycleById(id: string, factoryId: string) {
    return await queryOne(
      `SELECT id, factory_id as "factoryId", code, name, period_start as "periodStart", period_end as "periodEnd",
              standard_workdays as "standardWorkdays", standard_hours_per_day as "standardHoursPerDay",
              status, calculated_at as "calculatedAt", locked_at as "lockedAt", 
              paid_at as "paidAt", note, created_by as "createdBy"
       FROM payroll_cycles
       WHERE id = $1 AND factory_id = $2`,
      [id, factoryId]
    );
  }

  /**
   * Create a new payroll cycle
   */
  static async createCycle(data: CycleData, userId: string, factoryId: string) {
    return await queryOne(
      `INSERT INTO payroll_cycles (factory_id, code, name, period_start, period_end, standard_workdays, standard_hours_per_day, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, factory_id as "factoryId", code, name, status`,
      [
        factoryId,
        data.code,
        data.name,
        data.periodStart,
        data.periodEnd,
        data.standardWorkdays !== undefined ? data.standardWorkdays : 26,
        data.standardHoursPerDay !== undefined ? data.standardHoursPerDay : 8,
        data.note || null,
        userId,
      ]
    );
  }

  /**
   * Update cycle status with auditing
   */
  static async updateCycleStatus(id: string, status: string, actorId: string, factoryId: string, note?: string) {
    return await transaction(async (client) => {
      // Get current cycle details
      const cycleRes = await client.query(
        `SELECT status FROM payroll_cycles WHERE id = $1 AND factory_id = $2`,
        [id, factoryId]
      );
      if (cycleRes.rows.length === 0) throw new Error("Không tìm thấy chu kỳ lương.");
      
      const previousStatus = cycleRes.rows[0].status;
      if (previousStatus === status) return true;

      // Update cycle
      let updateSql = `UPDATE payroll_cycles SET status = $1, updated_at = now()`;
      const params = [status, id, factoryId];

      if (status === "calculated") {
        updateSql += `, calculated_at = now()`;
      } else if (status === "locked") {
        updateSql += `, locked_at = now()`;
      } else if (status === "paid") {
        updateSql += `, paid_at = now()`;
      }
      
      updateSql += ` WHERE id = $2 AND factory_id = $3`;
      await client.query(updateSql, params);

      // Insert audit log
      await client.query(
        `INSERT INTO payroll_audit_logs (payroll_cycle_id, actor_user_id, action, previous_status, next_status, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          actorId,
          `change_status_to_${status}`,
          previousStatus,
          status,
          JSON.stringify({ note: note || `Đổi trạng thái từ ${previousStatus} sang ${status}` }),
        ]
      );

      return true;
    });
  }

  /**
   * Delete a payroll cycle (Only allows deleting in Draft status)
   */
  static async deleteCycle(id: string, factoryId: string) {
    const cycle = await queryOne("SELECT status FROM payroll_cycles WHERE id = $1 AND factory_id = $2", [id, factoryId]);
    if (!cycle) throw new Error("Không tìm thấy chu kỳ lương.");
    if (cycle.status !== "draft" && cycle.status !== "cancelled") {
      throw new Error("Chỉ có thể xóa chu kỳ lương ở trạng thái Nháp (Draft) hoặc Đã hủy (Cancelled).");
    }

    await query(`DELETE FROM payroll_cycles WHERE id = $1 AND factory_id = $2`, [id, factoryId]);
    return true;
  }
}
