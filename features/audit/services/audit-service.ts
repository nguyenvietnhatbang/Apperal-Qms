import { query, queryOne, transaction } from "@/lib/db";
import { SalaryConfigService } from "@/features/employees/services/salary-config-service";
import { PayrollRuleService } from "@/features/payroll/services/payroll-rule-service";
import {
  AuditRuleConfig,
  auditDailyAttendance,
} from "./audit-rule-utils";

interface AuditConfigRow {
  id: string;
  code: string;
  name: string;
  max_overtime_hours_per_day: string;
  max_overtime_hours_per_month: string;
  max_overtime_hours_per_year: string;
  allow_sunday_work: boolean;
  enable_overtime_tier_2: boolean;
  note: string | null;
}

function toNumber(value: unknown) {
  return Number.parseFloat(String(value || 0)) || 0;
}

function mapAuditConfig(row: AuditConfigRow): AuditRuleConfig & {
  id: string;
  code: string;
  name: string;
  note: string | null;
} {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    maxOvertimeHoursPerDay: toNumber(row.max_overtime_hours_per_day),
    maxOvertimeHoursPerMonth: toNumber(row.max_overtime_hours_per_month),
    maxOvertimeHoursPerYear: toNumber(row.max_overtime_hours_per_year),
    allowSundayWork: row.allow_sunday_work,
    enableOvertimeTier2: row.enable_overtime_tier_2,
    note: row.note,
  };
}

export class AuditService {
  static async getActiveConfig() {
    const config = await queryOne<AuditConfigRow>(
      `SELECT id, code, name, max_overtime_hours_per_day, max_overtime_hours_per_month,
              max_overtime_hours_per_year, allow_sunday_work, enable_overtime_tier_2, note
       FROM audit_configs
       WHERE code = 'default' AND is_active = true`
    );

    if (!config) {
      throw new Error("Chưa có cấu hình audit mặc định.");
    }

    return mapAuditConfig(config);
  }

  static async updateActiveConfig(data: Partial<AuditRuleConfig> & { note?: string | null }) {
    const updated = await queryOne<AuditConfigRow>(
      `UPDATE audit_configs
       SET max_overtime_hours_per_day = COALESCE($1, max_overtime_hours_per_day),
           max_overtime_hours_per_month = COALESCE($2, max_overtime_hours_per_month),
           max_overtime_hours_per_year = COALESCE($3, max_overtime_hours_per_year),
           allow_sunday_work = COALESCE($4, allow_sunday_work),
           enable_overtime_tier_2 = COALESCE($5, enable_overtime_tier_2),
           note = COALESCE($6, note),
           updated_at = now()
       WHERE code = 'default'
       RETURNING id, code, name, max_overtime_hours_per_day, max_overtime_hours_per_month,
                 max_overtime_hours_per_year, allow_sunday_work, enable_overtime_tier_2, note`,
      [
        data.maxOvertimeHoursPerDay ?? null,
        data.maxOvertimeHoursPerMonth ?? null,
        data.maxOvertimeHoursPerYear ?? null,
        data.allowSundayWork ?? null,
        data.enableOvertimeTier2 ?? null,
        data.note ?? null,
      ]
    );

    if (!updated) throw new Error("Không cập nhật được cấu hình audit.");
    return mapAuditConfig(updated);
  }

  static async generateAuditAttendance(cycleId: string, actorId: string) {
    const config = await this.getActiveConfig();

    return await transaction(async (client) => {
      const cycleRes = await client.query(
        `SELECT id, code, period_start, period_end
         FROM payroll_cycles
         WHERE id = $1`,
        [cycleId]
      );
      if (cycleRes.rows.length === 0) throw new Error("Không tìm thấy chu kỳ lương.");

      const cycle = cycleRes.rows[0];
      const yearStart = `${new Date(cycle.period_start).getUTCFullYear()}-01-01`;

      const sourceRes = await client.query(
        `SELECT id, payroll_cycle_id, employee_id, employee_code, employee_name, work_date, weekday_name,
                department_name, position_title, shift_name, check_in_1, check_out_1, check_in_2, check_out_2,
                check_in_3, check_out_3, workday_count, work_hours, late_minutes, early_leave_minutes,
                overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours, symbol, extra_symbol, total_hours
         FROM attendance_records
         WHERE payroll_cycle_id = $1
         ORDER BY employee_code ASC, work_date ASC`,
        [cycleId]
      );

      await client.query(`DELETE FROM audit_payroll_items WHERE payroll_cycle_id = $1`, [cycleId]);
      await client.query(`DELETE FROM audit_attendance_records WHERE payroll_cycle_id = $1`, [cycleId]);

      const employeeYearTotals = new Map<string, number>();
      const employeeMonthTotals = new Map<string, number>();

      const yearTotalsRes = await client.query(
        `SELECT employee_code, COALESCE(SUM(overtime_normal_hours), 0) as total
         FROM audit_attendance_records
         WHERE work_date >= $1 AND work_date < $2 AND payroll_cycle_id <> $3
         GROUP BY employee_code`,
        [yearStart, cycle.period_start, cycleId]
      );
      for (const row of yearTotalsRes.rows) {
        employeeYearTotals.set(row.employee_code, toNumber(row.total));
      }

      let adjustedRows = 0;
      for (const source of sourceRes.rows) {
        const audited = auditDailyAttendance(
          {
            workDate: source.work_date,
            weekdayName: source.weekday_name,
            workdayCount: toNumber(source.workday_count),
            workHours: toNumber(source.work_hours),
            overtimeNormalHours: toNumber(source.overtime_normal_hours),
            overtimeSundayHours: toNumber(source.overtime_sunday_hours),
            overtimeHolidayHours: toNumber(source.overtime_holiday_hours),
          },
          config
        );

        const employeeCode = source.employee_code;
        const monthTotal = employeeMonthTotals.get(employeeCode) || 0;
        const yearTotal = employeeYearTotals.get(employeeCode) || 0;
        const monthRemaining = Math.max(0, config.maxOvertimeHoursPerMonth - monthTotal);
        const yearRemaining = Math.max(0, config.maxOvertimeHoursPerYear - yearTotal);
        const cappedOvertime = Math.min(audited.overtimeNormalHours, monthRemaining, yearRemaining);
        const reasons = [...audited.reasons];

        if (cappedOvertime !== audited.overtimeNormalHours) {
          reasons.push("TC1 bị giới hạn theo trần 40h/tháng hoặc 300h/năm.");
        }

        employeeMonthTotals.set(employeeCode, monthTotal + cappedOvertime);
        employeeYearTotals.set(employeeCode, yearTotal + cappedOvertime);
        if (reasons.length > 0) adjustedRows++;

        await client.query(
          `INSERT INTO audit_attendance_records (
             payroll_cycle_id, source_attendance_record_id, audit_config_id, employee_id, employee_code, employee_name,
             work_date, weekday_name, department_name, position_title, shift_name, check_in_1, check_out_1,
             check_in_2, check_out_2, check_in_3, check_out_3, original_workday_count, original_work_hours,
             original_overtime_normal_hours, original_overtime_sunday_hours, original_overtime_holiday_hours,
             workday_count, work_hours, overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours,
             late_minutes, early_leave_minutes, symbol, extra_symbol, total_hours, adjustment_reason, note
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                   $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)`,
          [
            cycleId,
            source.id,
            config.id,
            source.employee_id,
            employeeCode,
            source.employee_name,
            source.work_date,
            source.weekday_name,
            source.department_name,
            source.position_title,
            source.shift_name,
            source.check_in_1,
            source.check_out_1,
            source.check_in_2,
            source.check_out_2,
            source.check_in_3,
            source.check_out_3,
            source.workday_count,
            source.work_hours,
            source.overtime_normal_hours,
            source.overtime_sunday_hours,
            source.overtime_holiday_hours,
            audited.workdayCount,
            audited.workHours,
            cappedOvertime,
            audited.overtimeSundayHours,
            audited.overtimeHolidayHours,
            source.late_minutes,
            source.early_leave_minutes,
            source.symbol,
            source.extra_symbol,
            source.total_hours,
            JSON.stringify(reasons),
            reasons.join(" "),
          ]
        );
      }

      await client.query(
        `INSERT INTO payroll_audit_logs (payroll_cycle_id, actor_user_id, action, payload)
         VALUES ($1, $2, 'generate_audit_attendance', $3)`,
        [
          cycleId,
          actorId,
          JSON.stringify({ totalRows: sourceRes.rows.length, adjustedRows, configCode: config.code }),
        ]
      );

      return { totalRows: sourceRes.rows.length, adjustedRows };
    });
  }

  static async calculateAuditPayroll(cycleId: string, actorId: string) {
    const config = await this.getActiveConfig();

    return await transaction(async (client) => {
      const cycleRes = await client.query(
        `SELECT id, code, period_end, standard_workdays, standard_hours_per_day, status
         FROM payroll_cycles
         WHERE id = $1`,
        [cycleId]
      );
      if (cycleRes.rows.length === 0) throw new Error("Không tìm thấy chu kỳ lương.");

      const cycle = cycleRes.rows[0];
      const auditCount = await client.query(
        `SELECT COUNT(*)::int as count FROM audit_attendance_records WHERE payroll_cycle_id = $1`,
        [cycleId]
      );
      if (auditCount.rows[0].count === 0) {
        throw new Error("Chưa có bảng chấm công audit. Hãy chạy audit trước khi tính lương audit.");
      }

      const rules = await PayrollRuleService.getRulesMap();
      const stdWorkdays = toNumber(cycle.standard_workdays);
      const stdHoursPerDay = toNumber(cycle.standard_hours_per_day);
      const otNormalRate = rules["overtime_normal_rate"] || 1.5;
      const otSundayRate = rules["overtime_sunday_rate"] || 2;
      const otHolidayRate = rules["overtime_holiday_rate"] || 3;
      const empInsRate = rules["employee_insurance_rate"] || 0.105;
      const empUnionRate = rules["employee_union_rate"] || 0.01;
      const ctyBHXH = rules["company_social_insurance_rate"] || 0.175;
      const ctyBHYT = rules["company_health_insurance_rate"] || 0.03;
      const ctyBHTN = rules["company_unemployment_insurance_rate"] || 0.01;
      const ctyUnion = rules["company_union_rate"] || 0.02;

      const employeesRes = await client.query(
        `SELECT id, employee_code, full_name, gender, dependent_count, has_child_under_6
         FROM employees
         WHERE deleted_at IS NULL AND status = 'active'
         ORDER BY employee_code ASC`
      );

      await client.query(`DELETE FROM audit_payroll_items WHERE payroll_cycle_id = $1`, [cycleId]);
      const periodEndStr = new Date(cycle.period_end).toISOString().split("T")[0];

      let calculatedRows = 0;
      for (const emp of employeesRes.rows) {
        const salaryConfig = await SalaryConfigService.getActiveConfig(emp.id, periodEndStr);
        if (!salaryConfig) continue;

        const attendanceRes = await client.query(
          `SELECT workday_count, overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours, symbol
           FROM audit_attendance_records
           WHERE payroll_cycle_id = $1 AND employee_id = $2`,
          [cycleId, emp.id]
        );
        if (attendanceRes.rows.length === 0) continue;

        let actualWorkdays = 0;
        let paidLeaveDays = 0;
        let holidayDays = 0;
        let unpaidLeaveDays = 0;
        let overtimeNormalHours = 0;
        let overtimeSundayHours = 0;
        let overtimeHolidayHours = 0;

        for (const att of attendanceRes.rows) {
          const workdayVal = toNumber(att.workday_count);
          const sym = String(att.symbol || "").toUpperCase().trim();
          if (sym === "PN" || sym === "P") {
            paidLeaveDays += 1;
          } else if (sym === "L" || sym === "LE") {
            holidayDays += 1;
          } else if (sym === "RO" || sym === "KP") {
            unpaidLeaveDays += 1;
          } else {
            actualWorkdays += workdayVal;
          }

          overtimeNormalHours += toNumber(att.overtime_normal_hours);
          overtimeSundayHours += toNumber(att.overtime_sunday_hours);
          overtimeHolidayHours += toNumber(att.overtime_holiday_hours);
        }

        const totalSalary = toNumber(salaryConfig.totalSalary);
        const insuranceSalary = toNumber(salaryConfig.insuranceSalary);
        const baseSalary = toNumber(salaryConfig.baseSalary);
        const dailyRate = totalSalary / stdWorkdays;
        const otBase = baseSalary > 0 ? baseSalary : insuranceSalary > 0 ? insuranceSalary : totalSalary;
        const hourlyBase = otBase / stdWorkdays / stdHoursPerDay;
        const leaveBase = insuranceSalary > 0 ? insuranceSalary : baseSalary > 0 ? baseSalary : totalSalary;
        const dailyLeaveRate = leaveBase / stdWorkdays;

        const monthlySalaryAmount = Math.round(dailyRate * actualWorkdays);
        const paidLeaveAmount = Math.round(dailyLeaveRate * (paidLeaveDays + holidayDays));
        const overtimeNormalAmount = Math.round(overtimeNormalHours * hourlyBase * otNormalRate);
        const overtimeSundayAmount = Math.round(overtimeSundayHours * hourlyBase * otSundayRate);
        const overtimeHolidayAmount = Math.round(overtimeHolidayHours * hourlyBase * otHolidayRate);

        const seniorityAllowance = toNumber(salaryConfig.seniorityAllowance);
        let menstrualAllowance = 0;
        const isFemale = emp.gender === "Nữ" || emp.gender === "Female";
        if (isFemale && (actualWorkdays > 0 || paidLeaveDays > 0)) {
          menstrualAllowance = Math.round((leaveBase / stdWorkdays / stdHoursPerDay) * 1.5);
        }

        const childAllowance = emp.has_child_under_6 ? 100000 * (emp.dependent_count > 0 ? emp.dependent_count : 1) : 0;
        const flatAllowanceAmount = seniorityAllowance + menstrualAllowance + childAllowance;
        const grossIncome = monthlySalaryAmount + paidLeaveAmount + overtimeNormalAmount + overtimeSundayAmount + overtimeHolidayAmount + flatAllowanceAmount;
        const employeeInsuranceAmount = Math.round(insuranceSalary * empInsRate);
        const unionFeeAmount = Math.round(Math.min(baseSalary * empUnionRate, 30000));
        const companyInsuranceAmount = Math.round(insuranceSalary * (ctyBHXH + ctyBHYT + ctyBHTN + ctyUnion));
        const personalDeduction = 11000000;
        const dependentDeduction = 4400000 * (emp.dependent_count || 0);
        const taxableIncome = Math.max(0, grossIncome - employeeInsuranceAmount - unionFeeAmount - personalDeduction - dependentDeduction);

        let pitAmount = 0;
        if (taxableIncome > 0) {
          if (taxableIncome <= 5000000) pitAmount = taxableIncome * 0.05;
          else if (taxableIncome <= 10000000) pitAmount = taxableIncome * 0.1 - 250000;
          else if (taxableIncome <= 18000000) pitAmount = taxableIncome * 0.15 - 750000;
          else if (taxableIncome <= 32000000) pitAmount = taxableIncome * 0.2 - 1650000;
          else if (taxableIncome <= 52000000) pitAmount = taxableIncome * 0.25 - 3250000;
          else if (taxableIncome <= 80000000) pitAmount = taxableIncome * 0.3 - 5850000;
          else pitAmount = taxableIncome * 0.35 - 9850000;
          pitAmount = Math.round(pitAmount);
        }

        const totalDeduction = employeeInsuranceAmount + unionFeeAmount + pitAmount;
        const netSalary = grossIncome - totalDeduction;
        const secondPaymentAmount = Math.round(netSalary / 1000) * 1000;

        const itemRes = await client.query(
          `INSERT INTO audit_payroll_items (
             payroll_cycle_id, employee_id, employee_code, employee_name, salary_config_snapshot, rule_snapshot,
             audit_config_snapshot, actual_workdays, paid_leave_days, holiday_days, unpaid_leave_days,
             overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours, monthly_salary_amount,
             paid_leave_amount, overtime_normal_amount, overtime_sunday_amount, overtime_holiday_amount,
             allowance_amount, gross_income, company_insurance_amount, employee_insurance_amount, union_fee_amount,
             personal_income_tax_amount, advance_payment_1, advance_payment_2, total_deduction, net_salary,
             second_payment_amount, note
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                   $17, $18, $19, $20, $21, $22, $23, $24, $25, 0, 0, $26, $27, $28, $29)
           RETURNING id`,
          [
            cycleId,
            emp.id,
            emp.employee_code,
            emp.full_name,
            JSON.stringify(salaryConfig),
            JSON.stringify(rules),
            JSON.stringify(config),
            actualWorkdays,
            paidLeaveDays,
            holidayDays,
            unpaidLeaveDays,
            overtimeNormalHours,
            overtimeSundayHours,
            overtimeHolidayHours,
            monthlySalaryAmount,
            paidLeaveAmount,
            overtimeNormalAmount,
            overtimeSundayAmount,
            overtimeHolidayAmount,
            flatAllowanceAmount,
            grossIncome,
            companyInsuranceAmount,
            employeeInsuranceAmount,
            unionFeeAmount,
            pitAmount,
            totalDeduction,
            netSalary,
            secondPaymentAmount,
            `Tính lương audit cho chu kỳ ${cycle.code}.`,
          ]
        );

        const itemId = itemRes.rows[0].id;
        const lines = [
          { code: "audit_luong_ngay_cong", name: `Audit lương ngày công (${actualWorkdays} ngày)`, qty: actualWorkdays, rate: dailyRate, amount: monthlySalaryAmount, type: "earning", order: 10 },
          { code: "audit_luong_phep_le", name: `Audit lương phép, lễ (${paidLeaveDays + holidayDays} ngày)`, qty: paidLeaveDays + holidayDays, rate: dailyLeaveRate, amount: paidLeaveAmount, type: "earning", order: 20 },
          { code: "audit_tang_ca_1", name: `Audit tăng ca 1 (${overtimeNormalHours}h)`, qty: overtimeNormalHours, rate: hourlyBase * otNormalRate, amount: overtimeNormalAmount, type: "earning", order: 30 },
          { code: "audit_khau_tru_bhxh", name: "BHXH khấu trừ", qty: empInsRate, rate: insuranceSalary, amount: employeeInsuranceAmount, type: "deduction", order: 100 },
        ];

        for (const line of lines) {
          await client.query(
            `INSERT INTO audit_payroll_item_lines (audit_payroll_item_id, line_code, line_name, quantity, rate, amount, line_type, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [itemId, line.code, line.name, line.qty, line.rate, line.amount, line.type, line.order]
          );
        }
        calculatedRows++;
      }

      await client.query(
        `INSERT INTO payroll_audit_logs (payroll_cycle_id, actor_user_id, action, payload)
         VALUES ($1, $2, 'calculate_audit_payroll', $3)`,
        [cycleId, actorId, JSON.stringify({ calculatedRows, configCode: config.code })]
      );

      return { calculatedRows };
    });
  }

  static async getAuditAttendanceRecords(cycleId: string, search?: string) {
    let sql = `SELECT id, employee_code as "employeeCode", employee_name as "employeeName", work_date as "workDate",
                      weekday_name as "weekdayName", department_name as "departmentName", position_title as "positionTitle",
                      shift_name as "shiftName", check_in_1 as "checkIn1", check_out_1 as "checkOut1",
                      original_workday_count as "originalWorkdayCount", original_work_hours as "originalWorkHours",
                      original_overtime_normal_hours as "originalOvertimeNormalHours",
                      original_overtime_sunday_hours as "originalOvertimeSundayHours",
                      workday_count as "workdayCount", work_hours as "workHours",
                      overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
                      overtime_holiday_hours as "overtimeHolidayHours", late_minutes as "lateMinutes",
                      early_leave_minutes as "earlyLeaveMinutes", symbol, total_hours as "totalHours",
                      adjustment_reason as "adjustmentReason", note
               FROM audit_attendance_records
               WHERE payroll_cycle_id = $1`;
    const params: string[] = [cycleId];

    if (search) {
      sql += ` AND (employee_code ILIKE $2 OR employee_name ILIKE $2 OR department_name ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC, work_date ASC`;
    return await query(sql, params);
  }

  static async getAuditPayrollItems(cycleId: string, search?: string) {
    let sql = `SELECT id, payroll_cycle_id as "payrollCycleId", employee_id as "employeeId",
                      employee_code as "employeeCode", employee_name as "employeeName",
                      actual_workdays as "actualWorkdays", paid_leave_days as "paidLeaveDays",
                      holiday_days as "holidayDays", unpaid_leave_days as "unpaidLeaveDays",
                      overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
                      overtime_holiday_hours as "overtimeHolidayHours", monthly_salary_amount as "monthlySalaryAmount",
                      paid_leave_amount as "paidLeaveAmount", overtime_normal_amount as "overtimeNormalAmount",
                      overtime_sunday_amount as "overtimeSundayAmount", overtime_holiday_amount as "overtimeHolidayAmount",
                      allowance_amount as "allowanceAmount", gross_income as "grossIncome",
                      company_insurance_amount as "companyInsuranceAmount", employee_insurance_amount as "employeeInsuranceAmount",
                      union_fee_amount as "unionFeeAmount", personal_income_tax_amount as "personalIncomeTaxAmount",
                      total_deduction as "totalDeduction", net_salary as "netSalary",
                      second_payment_amount as "secondPaymentAmount", note, calculated_at as "calculatedAt"
               FROM audit_payroll_items
               WHERE payroll_cycle_id = $1`;
    const params: string[] = [cycleId];

    if (search) {
      sql += ` AND (employee_code ILIKE $2 OR employee_name ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC`;
    return await query(sql, params);
  }
}
