import { query, queryOne, transaction } from "@/lib/db";
import { parseVNDecimal } from "@/lib/format";
import { EmployeeService } from "@/features/employees/services/employee-service";
import { SalaryConfigService } from "@/features/employees/services/salary-config-service";

export class AttendanceCleaningService {
  /**
   * Process all raw rows of an import task, clean them, and insert into attendance_records.
   */
  static async cleanAndProcessImport(importId: string) {
    return await transaction(async (client) => {
      // Get the import task details
      const imp = await client.query(
        `SELECT id, payroll_cycle_id, file_name, status 
         FROM attendance_imports 
         WHERE id = $1`,
        [importId]
      );
      if (imp.rows.length === 0) throw new Error("Không tìm thấy đợt import");
      const { payroll_cycle_id } = imp.rows[0];

      // Get all raw rows
      const rawRowsRes = await client.query(
        `SELECT id, row_number, raw_data 
         FROM attendance_raw_rows 
         WHERE import_id = $1 
         ORDER BY row_number ASC`,
        [importId]
      );
      const rawRows = rawRowsRes.rows;

      let validRows = 0;
      let invalidRows = 0;
      const errorSummary: any[] = [];

      // Clear any existing attendance_records for this cycle/import
      await client.query(
        `DELETE FROM attendance_records WHERE payroll_cycle_id = $1`,
        [payroll_cycle_id]
      );

      const parsedRecords: any[] = [];

      for (const row of rawRows) {
        const { row_number, raw_data } = row;
        const errors: string[] = [];

        try {
          // Normalize column keys to map easily
          const data: Record<string, string> = {};
          Object.keys(raw_data).forEach(k => {
            // strip accents and normalize
            const normalizedKey = k.toLowerCase().trim()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/đ/g, "d")
              .replace(/\s+/g, "")
              .replace(/\./g, ""); // remove dots like in n.vien
            data[normalizedKey] = String(raw_data[k] || "").trim();
          });

          // Extract fields with normalization fallbacks
          const employeeCode = data["manv"] || data["manvien"] || data["masobangluong"] || data["maso"] || data["ma"];
          const employeeName = data["tennhanvien"] || data["tennv"] || data["hoten"] || data["ten"];
          const rawDateStr = data["ngay"];
          const departmentName = data["phongban"] || data["bophan"];
          const positionTitle = data["chucvu"] || data["chucdanh"];
          const weekdayName = data["thu"];
          const shiftName = data["tenca"] || data["ca"];

          if (!employeeCode) {
            throw new Error(`Dòng ${row_number}: Không tìm thấy Mã nhân viên.`);
          }
          if (!employeeName) {
            throw new Error(`Dòng ${row_number}: Không tìm thấy Tên nhân viên.`);
          }
          if (!rawDateStr) {
            throw new Error(`Dòng ${row_number}: Không tìm thấy Ngày làm việc.`);
          }

          // Parse and clean Date (DD/MM/YYYY to YYYY-MM-DD)
          let workDate: string;
          if (rawDateStr.includes("/")) {
            const parts = rawDateStr.split("/");
            if (parts.length !== 3) throw new Error(`Định dạng ngày không hợp lệ: ${rawDateStr}`);
            workDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          } else if (rawDateStr.includes("-")) {
            const parts = rawDateStr.split("-");
            if (parts[0].length === 4) {
              workDate = rawDateStr; // already YYYY-MM-DD
            } else if (parts.length === 3) {
              workDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            } else {
              throw new Error(`Định dạng ngày không hợp lệ: ${rawDateStr}`);
            }
          } else {
            // Excel serial date number
            const serial = parseInt(rawDateStr, 10);
            if (!isNaN(serial) && serial > 30000) {
              const date = new Date((serial - 25569) * 86400 * 1000);
              workDate = date.toISOString().split("T")[0];
            } else {
              throw new Error(`Định dạng ngày không hợp lệ: ${rawDateStr}`);
            }
          }

          // Clean numbers
          const workdayCount = parseVNDecimal(data["cong"]);
          const workHours = parseVNDecimal(data["gio"]);
          const extraWorkdayCount = parseVNDecimal(data["cong+"]);
          const extraHours = parseVNDecimal(data["gio+"]);
          const lateMinutes = Math.round(parseVNDecimal(data["vaotre"]));
          const earlyLeaveMinutes = Math.round(parseVNDecimal(data["rasom"]));
          const overtimeNormalHours = parseVNDecimal(data["tc1"]);
          const overtimeSundayHours = parseVNDecimal(data["tc2"]);
          const overtimeHolidayHours = parseVNDecimal(data["tc3"]);
          const symbol = data["kihieu"];
          const extraSymbol = data["kihieu+"];
          const totalHours = parseVNDecimal(data["tonggio"]);

          // Time fields parsing helper
          const parseTime = (timeStr: string) => {
            if (!timeStr || timeStr === "-" || timeStr === "") return null;
            if (timeStr.includes(":")) {
              const parts = timeStr.split(":");
              return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:00`;
            }
            return null;
          };

          const checkIn1 = parseTime(data["vao1"]);
          const checkOut1 = parseTime(data["ra1"]);
          const checkIn2 = parseTime(data["vao2"]);
          const checkOut2 = parseTime(data["ra2"]);
          const checkIn3 = parseTime(data["vao3"]);
          const checkOut3 = parseTime(data["ra3"]);

          // Map employee or auto-create if not exists
          let emp = await client.query(
            `SELECT id FROM employees WHERE employee_code = $1 AND deleted_at IS NULL`,
            [employeeCode]
          );

          let employeeId: string;
          if (emp.rows.length === 0) {
            // Auto-create active employee
            const newEmp = await EmployeeService.createEmployee({
              employeeCode,
              fullName: employeeName,
              departmentName: departmentName || "Chưa phân loại",
              positionTitle: positionTitle || "Nhân viên",
              status: "active",
            });
            employeeId = newEmp.id;

            // Create default salary config for auto-created employee (base_salary = 0)
            await SalaryConfigService.createSalaryConfig({
              employeeId,
              effectiveFrom: "2026-01-01",
              totalSalary: 0,
              insuranceSalary: 0,
              baseSalary: 0,
              note: "Cấu hình lương tự động tạo khi import chấm công thô.",
            });
          } else {
            employeeId = emp.rows[0].id;
          }

          parsedRecords.push({
            employeeId,
            employeeCode,
            employeeName,
            workDate,
            weekdayName: weekdayName || null,
            departmentName: departmentName || null,
            positionTitle: positionTitle || null,
            shiftName: shiftName || null,
            checkIn1,
            checkOut1,
            checkIn2,
            checkOut2,
            checkIn3,
            checkOut3,
            workdayCount,
            workHours,
            extraWorkdayCount,
            extraHours,
            lateMinutes,
            earlyLeaveMinutes,
            overtimeNormalHours,
            overtimeSundayHours,
            overtimeHolidayHours,
            symbol: symbol || null,
            extraSymbol: extraSymbol || null,
            totalHours,
          });

          validRows++;
        } catch (err: any) {
          invalidRows++;
          errors.push(err.message || String(err));
          errorSummary.push({ rowNumber: row_number, errors });
          
          // Save errors back to raw row
          await client.query(
            `UPDATE attendance_raw_rows 
             SET validation_errors = $1 
             WHERE id = $2`,
            [JSON.stringify(errors), row.id]
          );
        }
      }

      // Group and deduplicate parsed records by (employeeCode, workDate)
      const groupedMap = new Map<string, any>();
      for (const rec of parsedRecords) {
        const key = `${rec.employeeCode}_${rec.workDate}`;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, { ...rec });
        } else {
          const existing = groupedMap.get(key);
          
          // Aggregate numeric columns
          existing.workdayCount += rec.workdayCount;
          existing.workHours += rec.workHours;
          existing.extraWorkdayCount += rec.extraWorkdayCount;
          existing.extraHours += rec.extraHours;
          existing.lateMinutes += rec.lateMinutes;
          existing.earlyLeaveMinutes += rec.earlyLeaveMinutes;
          existing.overtimeNormalHours += rec.overtimeNormalHours;
          existing.overtimeSundayHours += rec.overtimeSundayHours;
          existing.overtimeHolidayHours += rec.overtimeHolidayHours;
          existing.totalHours += rec.totalHours;

          // Resolve times: checkIn1 should be earliest, checkOut1 should be latest
          if (rec.checkIn1 && (!existing.checkIn1 || rec.checkIn1 < existing.checkIn1)) {
            existing.checkIn1 = rec.checkIn1;
          }
          if (rec.checkOut1 && (!existing.checkOut1 || rec.checkOut1 > existing.checkOut1)) {
            existing.checkOut1 = rec.checkOut1;
          }

          // Keep first non-empty symbol
          if (!existing.symbol && rec.symbol) {
            existing.symbol = rec.symbol;
          }
          if (!existing.extraSymbol && rec.extraSymbol) {
            existing.extraSymbol = rec.extraSymbol;
          }

          // Concatenate shifts if distinct
          if (rec.shiftName && existing.shiftName && !existing.shiftName.includes(rec.shiftName)) {
            existing.shiftName = `${existing.shiftName}, ${rec.shiftName}`;
          } else if (!existing.shiftName) {
            existing.shiftName = rec.shiftName;
          }
        }
      }

      // Insert the consolidated, cleaned records
      for (const r of groupedMap.values()) {
        await client.query(
          `INSERT INTO attendance_records (
             payroll_cycle_id, import_id, employee_id, employee_code, employee_name, work_date, weekday_name,
             department_name, position_title, shift_name, check_in_1, check_out_1, check_in_2, check_out_2, 
             check_in_3, check_out_3, workday_count, work_hours, extra_workday_count, extra_hours, late_minutes, 
             early_leave_minutes, overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours, 
             symbol, extra_symbol, total_hours
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`,
          [
            payroll_cycle_id,
            importId,
            r.employeeId,
            r.employeeCode,
            r.employeeName,
            r.workDate,
            r.weekdayName,
            r.departmentName,
            r.positionTitle,
            r.shiftName,
            r.checkIn1,
            r.checkOut1,
            r.checkIn2,
            r.checkOut2,
            r.checkIn3,
            r.checkOut3,
            r.workdayCount,
            r.workHours,
            r.extraWorkdayCount,
            r.extraHours,
            r.lateMinutes,
            r.earlyLeaveMinutes,
            r.overtimeNormalHours,
            r.overtimeSundayHours,
            r.overtimeHolidayHours,
            r.symbol,
            r.extraSymbol,
            r.totalHours,
          ]
        );
      }

      // Update import status
      await client.query(
        `UPDATE attendance_imports 
         SET valid_rows = $1, invalid_rows = $2, error_summary = $3, status = 'processed', processed_at = now()
         WHERE id = $4`,
        [validRows, invalidRows, JSON.stringify(errorSummary), importId]
      );

      // Update cycle status to 'cleaned'
      await client.query(
        `UPDATE payroll_cycles 
         SET status = 'cleaned', updated_at = now() 
         WHERE id = $1`,
        [payroll_cycle_id]
      );

      return {
        validRows,
        invalidRows,
        errorSummary,
      };
    });
  }

  /**
   * Get cleaned records for a cycle
   */
  static async getRecordsByCycleId(cycleId: string, search?: string) {
    let sql = `SELECT id, employee_code as "employeeCode", employee_name as "employeeName", work_date as "workDate",
                      weekday_name as "weekdayName", department_name as "departmentName", position_title as "positionTitle",
                      shift_name as "shiftName", check_in_1 as "checkIn1", check_out_1 as "checkOut1",
                      check_in_2 as "checkIn2", check_out_2 as "checkOut2", workday_count as "workdayCount",
                      work_hours as "workHours", late_minutes as "lateMinutes", early_leave_minutes as "earlyLeaveMinutes",
                      overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
                      overtime_holiday_hours as "overtimeHolidayHours", symbol, total_hours as "totalHours"
               FROM attendance_records
               WHERE payroll_cycle_id = $1`;
    const params: any[] = [cycleId];

    if (search) {
      sql += ` AND (employee_code ILIKE $2 OR employee_name ILIKE $2 OR department_name ILIKE $2)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC, work_date ASC`;

    return await query(sql, params);
  }
}
