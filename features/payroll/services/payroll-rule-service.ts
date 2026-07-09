import { query, queryOne } from "@/lib/db";

export class PayrollRuleService {
  /**
   * Get all payroll rules
   */
  static async getRules(factoryId: string) {
    return await query(
      `SELECT id, code, name, value, unit, description, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM payroll_rules
       WHERE factory_id = $1
       ORDER BY code ASC`,
      [factoryId]
    );
  }

  /**
   * Get active rules as a key-value map for quick lookup
   */
  static async getRulesMap(factoryId: string): Promise<Record<string, number>> {
    const rules = await query(
      `SELECT code, value FROM payroll_rules WHERE factory_id = $1 AND is_active = true`,
      [factoryId]
    );
    const map: Record<string, number> = {};
    rules.forEach((r) => {
      map[r.code] = parseFloat(r.value);
    });
    return map;
  }

  /**
   * Update rule value
   */
  static async updateRule(id: string, value: number, factoryId: string) {
    return await queryOne(
      `UPDATE payroll_rules
       SET value = $1, updated_at = now()
       WHERE id = $2 AND factory_id = $3
       RETURNING id, code, name, value, unit`,
      [value, id, factoryId]
    );
  }
}
