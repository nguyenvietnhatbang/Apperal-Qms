import { query, queryOne, transaction } from "@/lib/db";
import { PayrollRuleService } from "./payroll-rule-service";

export class PayrollCalculationService {
  /**
   * Calculate payroll for all employees in a cycle and save snapshot results
   */
  static async calculateCyclePayroll(cycleId: string, actorId: string, factoryId: string, allowFinalizedCycleUpdate = false) {
    return await transaction(async (client) => {
      // 1. Fetch cycle info
      const cycleRes = await client.query(
        `SELECT id, factory_id, code, name, period_start, period_end, standard_workdays, standard_hours_per_day, status 
         FROM payroll_cycles 
         WHERE id = $1 AND factory_id = $2`,
        [cycleId, factoryId]
      );
      if (cycleRes.rows.length === 0) throw new Error("Không tìm thấy chu kỳ lương.");
      const cycle = cycleRes.rows[0];
      
      const isFinalizedCycle = cycle.status === "locked" || cycle.status === "paid";
      if (isFinalizedCycle && !allowFinalizedCycleUpdate) {
        throw new Error("Không thể tính lại lương cho chu kỳ đã khóa hoặc đã thanh toán.");
      }

      // 2. Fetch global rules
      const rules = await PayrollRuleService.getRulesMap(cycle.factory_id);
      const stdWorkdays = parseFloat(cycle.standard_workdays);
      const stdHoursPerDay = parseFloat(cycle.standard_hours_per_day);
      
      const otNormalRate = rules["overtime_normal_rate"] || 1.5;
      const otSundayRate = rules["overtime_sunday_rate"] || 2.0;
      const otHolidayRate = rules["overtime_holiday_rate"] || 3.0;
      const empInsRate = rules["employee_insurance_rate"] || 0.105;
      const empUnionRate = rules["employee_union_rate"] || 0.01;

      // 3. Only calculate employees who actually have attendance in this cycle.
      // Employees missing from the raw import are intentionally skipped.
      const employeesRes = await client.query(
        `SELECT id, employee_code, full_name, gender, status, dependent_count, has_child_under_6 
         FROM employees e
         WHERE e.deleted_at IS NULL AND e.status = 'active' AND e.factory_id = $1
           AND EXISTS (
             SELECT 1 FROM attendance_records ar
             WHERE ar.payroll_cycle_id = $2 AND ar.employee_id = e.id
           )
         ORDER BY employee_code ASC`,
        [cycle.factory_id, cycleId]
      );
      const employees = employeesRes.rows;
      const employeeIds = employees.map((employee: any) => employee.id);

      // 4. Clear existing calculations for this cycle
      await client.query(`DELETE FROM payroll_items WHERE payroll_cycle_id = $1`, [cycleId]);

      const periodStartStr = new Date(cycle.period_start).toISOString().split("T")[0];
      const periodEndStr = new Date(cycle.period_end).toISOString().split("T")[0];
      const salaryConfigsRes = employeeIds.length > 0
        ? await client.query(
            `SELECT DISTINCT ON (employee_id)
                    id, employee_id as "employeeId", effective_from as "effectiveFrom", effective_to as "effectiveTo",
                    total_salary as "totalSalary", insurance_salary as "insuranceSalary", base_salary as "baseSalary",
                    position_allowance as "positionAllowance", responsibility_allowance as "responsibilityAllowance",
                    seniority_allowance as "seniorityAllowance", safety_allowance as "safetyAllowance",
                    phone_allowance as "phoneAllowance", travel_allowance as "travelAllowance",
                    housing_allowance as "housingAllowance", attendance_bonus as "attendanceBonus",
                    other_bonus as "otherBonus", meal_allowance as "mealAllowance", note
             FROM employee_salary_configs
             WHERE employee_id = ANY($1::uuid[])
               AND effective_from <= $2::date
               AND (effective_to IS NULL OR effective_to >= $3::date)
             ORDER BY employee_id, effective_from DESC`,
            [employeeIds, periodEndStr, periodStartStr]
          )
        : { rows: [] };
      const salaryConfigByEmployeeId = new Map<string, any>(
        salaryConfigsRes.rows.map((config: any) => [config.employeeId, config])
      );

      const attendanceTotalsRes = employeeIds.length > 0
        ? await client.query(
            `WITH cycle_attendance AS (
               SELECT DISTINCT ON (employee_id, work_date)
                      employee_id, work_date, symbol, workday_count,
                      overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours
               FROM attendance_records
               WHERE payroll_cycle_id = $1
                 AND employee_id = ANY($2::uuid[])
                 AND work_date >= $3::date
                 AND work_date <= $4::date
               ORDER BY employee_id, work_date, updated_at DESC, created_at DESC, id DESC
             )
             SELECT employee_id as "employeeId",
                    COALESCE(SUM(CASE
                      WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('PN', 'P', 'BH') THEN 1
                      WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('PN/2', 'P/2', 'BH/2') THEN 0.5
                      ELSE 0
                    END), 0) as "paidLeaveDays",
                    COALESCE(SUM(CASE
                      WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('L', 'LE') THEN 1
                      WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('L/2', 'LE/2') THEN 0.5
                      ELSE 0
                    END), 0) as "holidayDays",
                    COALESCE(SUM(CASE
                      WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('RO', 'KP', 'K') THEN 1
                      WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('RO/2', 'KP/2', 'K/2') THEN 0.5
                      ELSE 0
                    END), 0) as "unpaidLeaveDays",
                    COALESCE(SUM(GREATEST(
                      workday_count - CASE
                        WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('PN', 'P', 'BH', 'L', 'LE', 'RO', 'KP', 'K') THEN 1
                        WHEN UPPER(TRIM(COALESCE(symbol, ''))) IN ('PN/2', 'P/2', 'BH/2', 'L/2', 'LE/2', 'RO/2', 'KP/2', 'K/2') THEN 0.5
                        ELSE 0
                      END,
                      0
                    )), 0) as "actualWorkdays",
                    COALESCE(SUM(overtime_normal_hours), 0) as "overtimeNormalHours",
                    COALESCE(SUM(overtime_sunday_hours), 0) as "overtimeSundayHours",
                    COALESCE(SUM(overtime_holiday_hours), 0) as "overtimeHolidayHours"
             FROM cycle_attendance
             GROUP BY employee_id`,
            [cycleId, employeeIds, periodStartStr, periodEndStr]
          )
        : { rows: [] };
      const attendanceTotalsByEmployeeId = new Map<string, any>(
        attendanceTotalsRes.rows.map((attendance: any) => [attendance.employeeId, attendance])
      );
      if (attendanceTotalsByEmployeeId.size === 0) {
        throw new Error("Không có dữ liệu chấm công trong khoảng ngày của chu kỳ lương.");
      }

      const adjustmentsRes = employeeIds.length > 0
        ? await client.query(
            `SELECT employee_id as "employeeId",
                    annual_leave_total as "annualLeaveTotal",
                    paid_leave_hours as "paidLeaveHours",
                    annual_leave_used_cumulative as "annualLeaveUsedCumulative",
                    annual_leave_remaining as "annualLeaveRemaining",
                    personal_leave_days as "personalLeaveDays",
                    personal_leave_amount as "personalLeaveAmount",
                    business_trip_allowance as "businessTripAllowance",
                    compliance_bonus as "complianceBonus",
                    work_trip_support as "workTripSupport",
                    night_shift_hours as "nightShiftHours",
                    night_shift_amount as "nightShiftAmount",
                    excess_overtime_normal_hours as "excessOvertimeNormalHours",
                    excess_overtime_sunday_hours as "excessOvertimeSundayHours",
                    excess_overtime_holiday_hours as "excessOvertimeHolidayHours",
                    excess_overtime_normal_amount as "excessOvertimeNormalAmount",
                    excess_overtime_sunday_amount as "excessOvertimeSundayAmount",
                    excess_overtime_holiday_amount as "excessOvertimeHolidayAmount",
                    advance_payment_1 as "advancePayment1",
                    advance_payment_2 as "advancePayment2",
                    pending_leave_advance as "pendingLeaveAdvance",
                    other_allowance_amount as "otherAllowanceAmount",
                    actual_workdays_override as "actualWorkdaysOverride",
                    paid_leave_days_override as "paidLeaveDaysOverride",
                    unpaid_leave_days_override as "unpaidLeaveDaysOverride",
                    holiday_days_override as "holidayDaysOverride",
                    overtime_normal_hours_override as "overtimeNormalHoursOverride",
                    overtime_sunday_hours_override as "overtimeSundayHoursOverride",
                    overtime_holiday_hours_override as "overtimeHolidayHoursOverride",
                    employee_insurance_amount_override as "employeeInsuranceAmountOverride",
                    union_fee_amount_override as "unionFeeAmountOverride",
                    personal_income_tax_amount_override as "personalIncomeTaxAmountOverride",
                    menstrual_allowance_amount_override as "menstrualAllowanceAmountOverride",
                    child_allowance_amount_override as "childAllowanceAmountOverride",
                    payroll_excluded as "payrollExcluded"
             FROM payroll_adjustments
             WHERE payroll_cycle_id = $1 AND employee_id = ANY($2::uuid[])`,
            [cycleId, employeeIds]
          )
        : { rows: [] };
      const adjustmentsByEmployeeId = new Map<string, any>(
        adjustmentsRes.rows.map((adjustment: any) => [adjustment.employeeId, adjustment])
      );

      const payrollRows: any[] = [];
      const payrollLinesByEmployeeId = new Map<string, any[]>();

      for (const emp of employees) {
        // Fetch active salary config for the employee at the end of the period
        const salaryConfig = salaryConfigByEmployeeId.get(emp.id);
        if (!salaryConfig) {
          // Skip if no salary config is set
          console.warn(`Employee ${emp.employee_code} has no active salary configuration for date ${periodEndStr}`);
          continue;
        }

        const adjustment = adjustmentsByEmployeeId.get(emp.id) || {};
        const payrollExcluded = adjustment.payrollExcluded === true;
        const attendanceTotals = attendanceTotalsByEmployeeId.get(emp.id) || {
          actualWorkdays: 0,
          paidLeaveDays: 0,
          holidayDays: 0,
          unpaidLeaveDays: 0,
          overtimeNormalHours: 0,
          overtimeSundayHours: 0,
          overtimeHolidayHours: 0,
        };
        if (!attendanceTotalsByEmployeeId.has(emp.id) && !adjustmentsByEmployeeId.has(emp.id)) continue;
        const actualWorkdays = adjustment.actualWorkdaysOverride === null || adjustment.actualWorkdaysOverride === undefined
          ? parseFloat(attendanceTotals?.actualWorkdays || 0)
          : parseFloat(adjustment.actualWorkdaysOverride);
        const paidLeaveDays = adjustment.paidLeaveDaysOverride === null || adjustment.paidLeaveDaysOverride === undefined
          ? parseFloat(attendanceTotals?.paidLeaveDays || 0)
          : parseFloat(adjustment.paidLeaveDaysOverride);
        const holidayDays = adjustment.holidayDaysOverride === null || adjustment.holidayDaysOverride === undefined
          ? parseFloat(attendanceTotals?.holidayDays || 0)
          : parseFloat(adjustment.holidayDaysOverride);
        const unpaidLeaveDays = adjustment.unpaidLeaveDaysOverride === null || adjustment.unpaidLeaveDaysOverride === undefined
          ? parseFloat(attendanceTotals?.unpaidLeaveDays || 0)
          : parseFloat(adjustment.unpaidLeaveDaysOverride);
        const overtimeNormalHours = adjustment.overtimeNormalHoursOverride === null || adjustment.overtimeNormalHoursOverride === undefined
          ? parseFloat(attendanceTotals?.overtimeNormalHours || 0)
          : parseFloat(adjustment.overtimeNormalHoursOverride);
        const overtimeSundayHours = adjustment.overtimeSundayHoursOverride === null || adjustment.overtimeSundayHoursOverride === undefined
          ? parseFloat(attendanceTotals?.overtimeSundayHours || 0)
          : parseFloat(adjustment.overtimeSundayHoursOverride);
        const overtimeHolidayHours = adjustment.overtimeHolidayHoursOverride === null || adjustment.overtimeHolidayHoursOverride === undefined
          ? parseFloat(attendanceTotals?.overtimeHolidayHours || 0)
          : parseFloat(adjustment.overtimeHolidayHoursOverride);
        const annualLeaveTotal = parseFloat(adjustment.annualLeaveTotal || 0);
        const paidLeaveHours = parseFloat(adjustment.paidLeaveHours || 0);
        const annualLeaveUsedCumulative = parseFloat(adjustment.annualLeaveUsedCumulative || 0);
        const annualLeaveRemaining = parseFloat(adjustment.annualLeaveRemaining || 0);
        const personalLeaveDays = parseFloat(adjustment.personalLeaveDays || unpaidLeaveDays || 0);
        const personalLeaveAmount = parseFloat(adjustment.personalLeaveAmount || 0);
        const businessTripAllowance = parseFloat(adjustment.businessTripAllowance || 0);
        const complianceBonus = parseFloat(adjustment.complianceBonus || 0);
        const workTripSupport = parseFloat(adjustment.workTripSupport || 0);
        const nightShiftHours = parseFloat(adjustment.nightShiftHours || 0);
        const nightShiftAmount = parseFloat(adjustment.nightShiftAmount || 0);
        const otherAllowanceAmount = parseFloat(adjustment.otherAllowanceAmount || 0);
        const excessOvertimeNormalHours = parseFloat(adjustment.excessOvertimeNormalHours || 0);
        const excessOvertimeSundayHours = parseFloat(adjustment.excessOvertimeSundayHours || 0);
        const excessOvertimeHolidayHours = parseFloat(adjustment.excessOvertimeHolidayHours || 0);
        const excessOvertimeNormalAmount = parseFloat(adjustment.excessOvertimeNormalAmount || 0);
        const excessOvertimeSundayAmount = parseFloat(adjustment.excessOvertimeSundayAmount || 0);
        const excessOvertimeHolidayAmount = parseFloat(adjustment.excessOvertimeHolidayAmount || 0);

        // Calculate rates
        const totalSalary = parseFloat(salaryConfig.totalSalary || 0);
        const insuranceSalary = parseFloat(salaryConfig.insuranceSalary || 0);
        const baseSalary = parseFloat(salaryConfig.baseSalary || 0);

        // Daily and hourly rates
        const dailyRate = totalSalary / stdWorkdays;
        
        // The reference payroll sheet calculates OT from the insurance salary.
        const otBase = insuranceSalary > 0 ? insuranceSalary : (baseSalary > 0 ? baseSalary : totalSalary);
        const hourlyBase = otBase / stdWorkdays / stdHoursPerDay;

        // Leave base is insuranceSalary (fallback to baseSalary, then totalSalary)
        const leaveBase = insuranceSalary > 0 ? insuranceSalary : (baseSalary > 0 ? baseSalary : totalSalary);
        const dailyLeaveRate = leaveBase / stdWorkdays;

        // Earnings
        // The source sheet rounds the monthly work and leave components to
        // thousand VND before composing total income.
        const monthlySalaryAmount = payrollExcluded ? 0 : Math.round((dailyRate * actualWorkdays) / 1000) * 1000;
        const paidLeaveAmount = payrollExcluded ? 0 : Math.round((dailyLeaveRate * (paidLeaveDays + holidayDays)) / 1000) * 1000;
        
        const overtimeNormalAmount = payrollExcluded ? 0 : Math.round(overtimeNormalHours * hourlyBase * otNormalRate);
        const overtimeSundayAmount = payrollExcluded ? 0 : Math.round(overtimeSundayHours * hourlyBase * otSundayRate);
        const overtimeHolidayAmount = payrollExcluded ? 0 : Math.round(overtimeHolidayHours * hourlyBase * otHolidayRate);

        // Allowances & bonuses
        const seniorityAllowance = parseFloat(salaryConfig.seniorityAllowance || 0);
        const positionAllowance = parseFloat(salaryConfig.positionAllowance || 0);
        const responsibilityAllowance = parseFloat(salaryConfig.responsibilityAllowance || 0);
        const safetyAllowance = parseFloat(salaryConfig.safetyAllowance || 0);
        const phoneAllowance = parseFloat(salaryConfig.phoneAllowance || 0);
        const travelAllowance = parseFloat(salaryConfig.travelAllowance || 0);
        const housingAllowance = parseFloat(salaryConfig.housingAllowance || 0);
        const attendanceBonus = parseFloat(salaryConfig.attendanceBonus || 0);
        const otherBonus = parseFloat(salaryConfig.otherBonus || 0);
        const mealAllowance = parseFloat(salaryConfig.mealAllowance || 0);

        // Female menstrual allowance (1.5 hours)
        let menstrualAllowance = adjustment.menstrualAllowanceAmountOverride === null || adjustment.menstrualAllowanceAmountOverride === undefined
          ? 0
          : parseFloat(adjustment.menstrualAllowanceAmountOverride);
        const isFemale = emp.gender === "Nữ" || emp.gender === "Female";
        if ((adjustment.menstrualAllowanceAmountOverride === null || adjustment.menstrualAllowanceAmountOverride === undefined) && isFemale && (actualWorkdays > 0 || paidLeaveDays > 0)) {
          const insHourlyRate = leaveBase / stdWorkdays / stdHoursPerDay;
          menstrualAllowance = Math.round(insHourlyRate * 1.5);
        }

        // Child under 6 allowance (100.000 per child)
        let childAllowance = adjustment.childAllowanceAmountOverride === null || adjustment.childAllowanceAmountOverride === undefined
          ? 0
          : parseFloat(adjustment.childAllowanceAmountOverride);
        if ((adjustment.childAllowanceAmountOverride === null || adjustment.childAllowanceAmountOverride === undefined) && emp.has_child_under_6) {
          const childCount = emp.dependent_count > 0 ? emp.dependent_count : 1;
          childAllowance = 100000 * childCount;
        }

        // Total allowances flat (excluding pro-rated allowances which are built into total_salary)
        // Seniority allowance is paid flat on top as observed in the template sheet
        const flatAllowanceAmount = payrollExcluded ? 0 : seniorityAllowance + menstrualAllowance + childAllowance +
          businessTripAllowance + complianceBonus + workTripSupport + nightShiftAmount + otherAllowanceAmount;

        // The source payroll sheet keeps personal leave/BH as a separate informational
        // amount and does not include it in total income. Its total income is rounded
        // to the nearest thousand before deductions are applied.
        const grossIncomeBeforeRounding = monthlySalaryAmount + paidLeaveAmount +
          overtimeNormalAmount + overtimeSundayAmount + overtimeHolidayAmount + flatAllowanceAmount;
        const grossIncome = Math.round(grossIncomeBeforeRounding / 1000) * 1000;

        // Deductions
        const employeeInsuranceAmount = payrollExcluded ? 0 : adjustment.employeeInsuranceAmountOverride === null || adjustment.employeeInsuranceAmountOverride === undefined
          ? Math.round(insuranceSalary * empInsRate)
          : Math.round(parseFloat(adjustment.employeeInsuranceAmountOverride));
        // Union fee is 1% of base salary capped at 30,000 VND
        const unionFeeAmount = payrollExcluded ? 0 : adjustment.unionFeeAmountOverride === null || adjustment.unionFeeAmountOverride === undefined
          ? Math.round(Math.min(baseSalary * empUnionRate, 30000))
          : Math.round(parseFloat(adjustment.unionFeeAmountOverride));

        // Company trích đóng (BHXH 17.5%, BHYT 3%, BHTN 1%, Kinh phí công đoàn 2%)
        const ctyBHXH = rules["company_social_insurance_rate"] || 0.175;
        const ctyBHYT = rules["company_health_insurance_rate"] || 0.03;
        const ctyBHTN = rules["company_unemployment_insurance_rate"] || 0.01;
        const ctyUnion = rules["company_union_rate"] || 0.02;
        const companyInsuranceAmount = Math.round(insuranceSalary * (ctyBHXH + ctyBHYT + ctyBHTN + ctyUnion));

        // Simple Personal Income Tax (PIT) Calculation
        // Taxable income = Gross Income - Insurance - Personal deduction (11,000,000) - Dependent deduction (4,400,000 * count)
        const personalDeduction = 11000000;
        const dependentDeduction = 4400000 * (emp.dependent_count || 0);
        const taxableIncome = Math.max(0, grossIncome - employeeInsuranceAmount - unionFeeAmount - personalDeduction - dependentDeduction);
        
        let pitAmount = adjustment.personalIncomeTaxAmountOverride === null || adjustment.personalIncomeTaxAmountOverride === undefined
          ? 0
          : Math.round(parseFloat(adjustment.personalIncomeTaxAmountOverride));
        if ((adjustment.personalIncomeTaxAmountOverride === null || adjustment.personalIncomeTaxAmountOverride === undefined) && taxableIncome > 0) {
          // PIT progressive brackets (Vietnam)
          // <= 5M: 5%
          // 5M - 10M: 10%
          // 10M - 18M: 15%
          // 18M - 32M: 20%
          // 32M - 52M: 25%
          // 52M - 80M: 30%
          // > 80M: 35%
          if (taxableIncome <= 5000000) {
            pitAmount = taxableIncome * 0.05;
          } else if (taxableIncome <= 10000000) {
            pitAmount = taxableIncome * 0.10 - 250000;
          } else if (taxableIncome <= 18000000) {
            pitAmount = taxableIncome * 0.15 - 750000;
          } else if (taxableIncome <= 32000000) {
            pitAmount = taxableIncome * 0.20 - 1650000;
          } else if (taxableIncome <= 52000000) {
            pitAmount = taxableIncome * 0.25 - 3250000;
          } else if (taxableIncome <= 80000000) {
            pitAmount = taxableIncome * 0.30 - 5850000;
          } else {
            pitAmount = taxableIncome * 0.35 - 9850000;
          }
          pitAmount = Math.round(pitAmount);
        }

        // Advance payments (tạm ứng) - check if recorded in any other tables or default to 0
        const advancePayment1 = parseFloat(adjustment.advancePayment1 || 0);
        const advancePayment2 = parseFloat(adjustment.advancePayment2 || 0);
        const pendingLeaveAdvance = parseFloat(adjustment.pendingLeaveAdvance || 0);

        // pendingLeaveAdvance is stored as a day quantity from the source sheet,
        // not as a monetary deduction.
        const totalDeduction = employeeInsuranceAmount + unionFeeAmount + pitAmount + advancePayment1 + advancePayment2;
        const netSalary = grossIncome - totalDeduction;

        // Round final net salary to nearest thousand VND
        const secondPaymentAmount = Math.round(netSalary / 1000) * 1000;

        payrollRows.push({
          employeeId: emp.id,
          employeeCode: emp.employee_code,
          employeeName: emp.full_name,
          salaryConfigSnapshot: salaryConfig,
          ruleSnapshot: rules,
          actualWorkdays,
          paidLeaveDays,
          paidLeaveHours,
          annualLeaveTotal,
          annualLeaveUsedCumulative,
          annualLeaveRemaining,
          holidayDays,
          personalLeaveDays,
          unpaidLeaveDays,
          overtimeNormalHours,
          overtimeSundayHours,
          overtimeHolidayHours,
          nightShiftHours,
          excessOvertimeNormalHours,
          excessOvertimeSundayHours,
          excessOvertimeHolidayHours,
          monthlySalaryAmount,
          personalLeaveAmount,
          paidLeaveAmount,
          overtimeNormalAmount,
          overtimeSundayAmount,
          overtimeHolidayAmount,
          nightShiftAmount,
          excessOvertimeNormalAmount,
          excessOvertimeSundayAmount,
          excessOvertimeHolidayAmount,
          allowanceAmount: flatAllowanceAmount,
          otherAllowanceAmount,
          businessTripAllowance,
          complianceBonus,
          workTripSupport,
          menstrualAllowanceAmount: menstrualAllowance,
          childAllowanceAmount: childAllowance,
          grossIncome,
          companyInsuranceAmount,
          employeeInsuranceAmount,
          unionFeeAmount,
          personalIncomeTaxAmount: pitAmount,
          advancePayment1,
          advancePayment2,
          pendingLeaveAdvance,
          totalDeduction,
          netSalary,
          secondPaymentAmount,
          note: `Tính lương cho chu kỳ ${cycle.code}.`,
        });

        // 6. Write detailed lines into payroll_item_lines
        const lines = [
          { code: "luong_ngay_cong", name: `Lương ngày công (${actualWorkdays} ngày)`, qty: actualWorkdays, rate: dailyRate, amount: monthlySalaryAmount, type: "earning", order: 10 },
          { code: "luong_phep_le", name: `Lương phép, lễ (${paidLeaveDays + holidayDays} ngày)`, qty: paidLeaveDays + holidayDays, rate: dailyLeaveRate, amount: paidLeaveAmount, type: "earning", order: 20 },
        ];

        if (overtimeNormalHours > 0) {
          lines.push({ code: "tang_ca_thuong", name: `Tăng ca thường 150% (${overtimeNormalHours}h)`, qty: overtimeNormalHours, rate: hourlyBase * otNormalRate, amount: overtimeNormalAmount, type: "earning", order: 30 });
        }
        if (overtimeSundayHours > 0) {
          lines.push({ code: "tang_ca_chu_nhat", name: `Tăng ca Chủ Nhật 200% (${overtimeSundayHours}h)`, qty: overtimeSundayHours, rate: hourlyBase * otSundayRate, amount: overtimeSundayAmount, type: "earning", order: 40 });
        }
        if (overtimeHolidayHours > 0) {
          lines.push({ code: "tang_ca_le", name: `Tăng ca ngày lễ 300% (${overtimeHolidayHours}h)`, qty: overtimeHolidayHours, rate: hourlyBase * otHolidayRate, amount: overtimeHolidayAmount, type: "earning", order: 50 });
        }

        if (seniorityAllowance > 0) {
          lines.push({ code: "phu_cap_tham_nien", name: "Phụ cấp thâm niên", qty: 1, rate: seniorityAllowance, amount: seniorityAllowance, type: "allowance", order: 60 });
        }
        if (menstrualAllowance > 0) {
          lines.push({ code: "phu_cap_hanh_kinh", name: "Phụ cấp hành kinh (1,5h)", qty: 1.5, rate: leaveBase / stdWorkdays / stdHoursPerDay, amount: menstrualAllowance, type: "allowance", order: 70 });
        }
        if (childAllowance > 0) {
          lines.push({ code: "phu_cap_con_nho", name: `PC con nhỏ < 6 tuổi (${emp.dependent_count || 1} con)`, qty: emp.dependent_count || 1, rate: 100000, amount: childAllowance, type: "allowance", order: 80 });
        }
        if (otherAllowanceAmount > 0 && !payrollExcluded) {
          lines.push({ code: "phu_cap_ngoai", name: "Phụ cấp ngoài", qty: 1, rate: otherAllowanceAmount, amount: otherAllowanceAmount, type: "allowance", order: 90 });
        }

        // Deductions lines
        lines.push(
          { code: "khau_tru_bhxh", name: "BHXH Khấu trừ 10,5%", qty: 0.105, rate: insuranceSalary, amount: employeeInsuranceAmount, type: "deduction", order: 100 },
          { code: "khau_tru_doan_phi", name: "Đoàn phí 1%", qty: 0.01, rate: baseSalary, amount: unionFeeAmount, type: "deduction", order: 110 }
        );

        if (pitAmount > 0) {
          lines.push({ code: "thue_tncn", name: "Thuế TNCN", qty: 1, rate: pitAmount, amount: pitAmount, type: "deduction", order: 120 });
        }

        payrollLinesByEmployeeId.set(emp.id, lines);
      }

      if (payrollRows.length > 0) {
        const insertedItems = await client.query(
          `INSERT INTO payroll_items (
             payroll_cycle_id, employee_id, employee_code, employee_name, salary_config_snapshot, rule_snapshot,
             actual_workdays, paid_leave_days, paid_leave_hours, annual_leave_total, annual_leave_used_cumulative,
             annual_leave_remaining, holiday_days, personal_leave_days, unpaid_leave_days, overtime_normal_hours,
             overtime_sunday_hours, overtime_holiday_hours, night_shift_hours, excess_overtime_normal_hours,
             excess_overtime_sunday_hours, excess_overtime_holiday_hours, monthly_salary_amount, personal_leave_amount,
             paid_leave_amount, overtime_normal_amount, overtime_sunday_amount, overtime_holiday_amount,
             night_shift_amount, excess_overtime_normal_amount, excess_overtime_sunday_amount, excess_overtime_holiday_amount,
             allowance_amount, other_allowance_amount, business_trip_allowance, compliance_bonus, work_trip_support,
             menstrual_allowance_amount, child_allowance_amount, gross_income,
             company_insurance_amount, employee_insurance_amount,
             union_fee_amount, personal_income_tax_amount, advance_payment_1, advance_payment_2, pending_leave_advance, total_deduction,
             net_salary, second_payment_amount, note
           )
           SELECT
             $1, "employeeId", "employeeCode", "employeeName", "salaryConfigSnapshot", "ruleSnapshot",
             "actualWorkdays", "paidLeaveDays", "paidLeaveHours", "annualLeaveTotal", "annualLeaveUsedCumulative",
             "annualLeaveRemaining", "holidayDays", "personalLeaveDays", "unpaidLeaveDays", "overtimeNormalHours",
             "overtimeSundayHours", "overtimeHolidayHours", "nightShiftHours", "excessOvertimeNormalHours",
             "excessOvertimeSundayHours", "excessOvertimeHolidayHours", "monthlySalaryAmount", "personalLeaveAmount",
             "paidLeaveAmount", "overtimeNormalAmount", "overtimeSundayAmount", "overtimeHolidayAmount",
             "nightShiftAmount", "excessOvertimeNormalAmount", "excessOvertimeSundayAmount", "excessOvertimeHolidayAmount",
             "allowanceAmount", "otherAllowanceAmount", "businessTripAllowance", "complianceBonus", "workTripSupport",
             "menstrualAllowanceAmount", "childAllowanceAmount", "grossIncome",
             "companyInsuranceAmount", "employeeInsuranceAmount",
             "unionFeeAmount", "personalIncomeTaxAmount", "advancePayment1", "advancePayment2", "pendingLeaveAdvance", "totalDeduction",
             "netSalary", "secondPaymentAmount", note
           FROM jsonb_to_recordset($2::jsonb) AS payroll_data(
             "employeeId" uuid,
             "employeeCode" text,
             "employeeName" text,
             "salaryConfigSnapshot" jsonb,
             "ruleSnapshot" jsonb,
             "actualWorkdays" numeric,
             "paidLeaveDays" numeric,
             "paidLeaveHours" numeric,
             "annualLeaveTotal" numeric,
             "annualLeaveUsedCumulative" numeric,
             "annualLeaveRemaining" numeric,
             "holidayDays" numeric,
             "personalLeaveDays" numeric,
             "unpaidLeaveDays" numeric,
             "overtimeNormalHours" numeric,
             "overtimeSundayHours" numeric,
             "overtimeHolidayHours" numeric,
             "nightShiftHours" numeric,
             "excessOvertimeNormalHours" numeric,
             "excessOvertimeSundayHours" numeric,
             "excessOvertimeHolidayHours" numeric,
             "monthlySalaryAmount" numeric,
             "personalLeaveAmount" numeric,
             "paidLeaveAmount" numeric,
             "overtimeNormalAmount" numeric,
             "overtimeSundayAmount" numeric,
             "overtimeHolidayAmount" numeric,
             "nightShiftAmount" numeric,
             "excessOvertimeNormalAmount" numeric,
             "excessOvertimeSundayAmount" numeric,
             "excessOvertimeHolidayAmount" numeric,
             "allowanceAmount" numeric,
             "otherAllowanceAmount" numeric,
             "businessTripAllowance" numeric,
             "complianceBonus" numeric,
             "workTripSupport" numeric,
             "menstrualAllowanceAmount" numeric,
             "childAllowanceAmount" numeric,
             "grossIncome" numeric,
             "companyInsuranceAmount" numeric,
             "employeeInsuranceAmount" numeric,
             "unionFeeAmount" numeric,
             "personalIncomeTaxAmount" numeric,
             "advancePayment1" numeric,
             "advancePayment2" numeric,
             "pendingLeaveAdvance" numeric,
             "totalDeduction" numeric,
             "netSalary" numeric,
             "secondPaymentAmount" numeric,
             note text
           )
           RETURNING id, employee_id as "employeeId"`,
          [cycleId, JSON.stringify(payrollRows)]
        );

        const lineRows = insertedItems.rows.flatMap((item: any) => {
          const lines = payrollLinesByEmployeeId.get(item.employeeId) || [];
          return lines.map((line) => ({
            payrollItemId: item.id,
            lineCode: line.code,
            lineName: line.name,
            quantity: line.qty,
            rate: line.rate,
            amount: line.amount,
            lineType: line.type,
            sortOrder: line.order,
          }));
        });

        if (lineRows.length > 0) {
          await client.query(
            `INSERT INTO payroll_item_lines (payroll_item_id, line_code, line_name, quantity, rate, amount, line_type, sort_order)
             SELECT "payrollItemId", "lineCode", "lineName", quantity, rate, amount, "lineType", "sortOrder"
             FROM jsonb_to_recordset($1::jsonb) AS line_data(
               "payrollItemId" uuid,
               "lineCode" text,
               "lineName" text,
               quantity numeric,
               rate numeric,
               amount numeric,
               "lineType" text,
               "sortOrder" integer
             )`,
            [JSON.stringify(lineRows)]
          );
        }
      }

      const nextStatus = isFinalizedCycle ? cycle.status : "calculated";

      // Update cycle status to calculated, but keep finalized status when admin recalculates.
      await client.query(
        `UPDATE payroll_cycles SET status = $1, calculated_at = now(), updated_at = now() WHERE id = $2`,
        [nextStatus, cycleId]
      );

      // Audit log
      await client.query(
        `INSERT INTO payroll_audit_logs (payroll_cycle_id, actor_user_id, action, previous_status, next_status, payload)
         VALUES ($1, $2, 'calculate_payroll', $3, $4, $5)`,
        [
          cycleId,
          actorId,
          cycle.status,
          nextStatus,
          JSON.stringify({
            message: isFinalizedCycle
              ? "Admin cập nhật lại lương cho chu kỳ đã chốt/đã chi trả."
              : "Thực hiện tính lương tự động cho chu kỳ.",
          }),
        ]
      );

      return true;
    });
  }
}
