import { query, queryOne, transaction } from "@/lib/db";
import { parseVNDecimal } from "@/lib/format";

function normalizeEmployeeName(value: string) {
  return String(value || "")
    .replace(/\([^)]*\)/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export class AttendanceCleaningService {
  /**
   * Process all raw rows of an import task, clean them, and insert into attendance_records.
   */
  static async cleanAndProcessImport(importId: string, factoryId: string) {
    return await transaction(async (client) => {
      // Get the import task details
      const imp = await client.query(
        `SELECT i.id, i.payroll_cycle_id, i.file_name, i.status, c.factory_id
         FROM attendance_imports i
         JOIN payroll_cycles c ON c.id = i.payroll_cycle_id
         WHERE i.id = $1 AND c.factory_id = $2`,
        [importId, factoryId]
      );
      if (imp.rows.length === 0) throw new Error("Không tìm thấy đợt import");
      const { payroll_cycle_id, factory_id } = imp.rows[0];

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

          parsedRecords.push({
            employeeId: null,
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

      if (parsedRecords.length > 0) {
        // Resolve legacy/wrong source codes by the canonical employee name
        // before matching or creating employees.
        const existingEmployeesByName = await client.query(
          `SELECT id, employee_code, full_name
           FROM employees
           WHERE factory_id = $1 AND deleted_at IS NULL`,
          [factory_id]
        );
        const employeeByName = new Map<string, { employee_code: string; full_name: string }>(
          existingEmployeesByName.rows.map((employee: { employee_code: string; full_name: string }) => [
            normalizeEmployeeName(employee.full_name),
            employee,
          ])
        );
        for (const record of parsedRecords) {
          const matchedEmployee = employeeByName.get(normalizeEmployeeName(record.employeeName));
          if (matchedEmployee) {
            record.employeeCode = matchedEmployee.employee_code;
            record.employeeName = matchedEmployee.full_name;
          }
        }

        const uniqueEmployeeMap = new Map<string, any>();
        for (const record of parsedRecords) {
          if (!uniqueEmployeeMap.has(record.employeeCode)) {
            uniqueEmployeeMap.set(record.employeeCode, record);
          }
        }

        const employeeCodes = Array.from(uniqueEmployeeMap.keys());
        const existingEmployees = await client.query(
          `SELECT id, employee_code, deleted_at
           FROM employees
           WHERE employee_code = ANY($1::text[]) AND factory_id = $2`,
          [employeeCodes, factory_id]
        );

        const employeeIdByCode = new Map<string, string>();
        for (const employee of existingEmployees.rows) {
          employeeIdByCode.set(employee.employee_code, employee.id);
        }

        const deletedExistingEmployeeCodes = existingEmployees.rows
          .filter((employee: any) => employee.deleted_at)
          .map((employee: any) => employee.employee_code);

        if (deletedExistingEmployeeCodes.length > 0) {
          const employeesToRestore = deletedExistingEmployeeCodes.map((employeeCode: string) => {
            const record = uniqueEmployeeMap.get(employeeCode);
            return {
              employeeCode,
              fullName: record.employeeName,
              departmentName: record.departmentName || "Chưa phân loại",
              positionTitle: record.positionTitle || "Nhân viên",
            };
          });

          await client.query(
            `UPDATE employees AS e
             SET full_name = employee_data."fullName",
                 department_name = employee_data."departmentName",
                 position_title = employee_data."positionTitle",
                 status = 'active',
                 deleted_at = NULL,
                 updated_at = now()
             FROM jsonb_to_recordset($1::jsonb) AS employee_data(
               "employeeCode" text,
               "fullName" text,
               "departmentName" text,
               "positionTitle" text
             )
             WHERE e.employee_code = employee_data."employeeCode"
               AND e.factory_id = $2`,
            [JSON.stringify(employeesToRestore), factory_id]
          );
        }

        const missingEmployees = employeeCodes
          .filter((employeeCode) => !employeeIdByCode.has(employeeCode))
          .map((employeeCode) => {
            const record = uniqueEmployeeMap.get(employeeCode);
            return {
              employeeCode,
              fullName: record.employeeName,
              departmentName: record.departmentName || "Chưa phân loại",
              positionTitle: record.positionTitle || "Nhân viên",
            };
          });

        if (missingEmployees.length > 0) {
          const insertedEmployees = await client.query(
            `INSERT INTO employees (factory_id, employee_code, full_name, department_name, position_title, status)
             SELECT $2, "employeeCode", "fullName", "departmentName", "positionTitle", 'active'
             FROM jsonb_to_recordset($1::jsonb) AS employee_data(
               "employeeCode" text,
               "fullName" text,
               "departmentName" text,
               "positionTitle" text
             )
             RETURNING id, employee_code`,
            [JSON.stringify(missingEmployees), factory_id]
          );

          for (const employee of insertedEmployees.rows) {
            employeeIdByCode.set(employee.employee_code, employee.id);
          }

          await client.query(
            `INSERT INTO employee_salary_configs (employee_id, effective_from, total_salary, insurance_salary, base_salary, note)
             SELECT id, '2026-01-01'::date, 0, 0, 0, 'Cấu hình lương tự động tạo khi import chấm công thô.'
             FROM jsonb_to_recordset($1::jsonb) AS employee_data(id uuid)`,
            [JSON.stringify(insertedEmployees.rows)]
          );
        }

        for (const record of parsedRecords) {
          record.employeeId = employeeIdByCode.get(record.employeeCode);
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
      const attendanceRows = Array.from(groupedMap.values());
      if (attendanceRows.length > 0) {
        await client.query(
          `INSERT INTO attendance_records (
             payroll_cycle_id, import_id, employee_id, employee_code, employee_name, work_date, weekday_name,
             department_name, position_title, shift_name, check_in_1, check_out_1, check_in_2, check_out_2, 
             check_in_3, check_out_3, workday_count, work_hours, extra_workday_count, extra_hours, late_minutes, 
             early_leave_minutes, overtime_normal_hours, overtime_sunday_hours, overtime_holiday_hours, 
             symbol, extra_symbol, total_hours
           )
           SELECT
             $1,
             $2,
             "employeeId",
             "employeeCode",
             "employeeName",
             "workDate",
             "weekdayName",
             "departmentName",
             "positionTitle",
             "shiftName",
             "checkIn1",
             "checkOut1",
             "checkIn2",
             "checkOut2",
             "checkIn3",
             "checkOut3",
             "workdayCount",
             "workHours",
             "extraWorkdayCount",
             "extraHours",
             "lateMinutes",
             "earlyLeaveMinutes",
             "overtimeNormalHours",
             "overtimeSundayHours",
             "overtimeHolidayHours",
             symbol,
             "extraSymbol",
             "totalHours"
           FROM jsonb_to_recordset($3::jsonb) AS attendance_data(
             "employeeId" uuid,
             "employeeCode" text,
             "employeeName" text,
             "workDate" date,
             "weekdayName" text,
             "departmentName" text,
             "positionTitle" text,
             "shiftName" text,
             "checkIn1" time,
             "checkOut1" time,
             "checkIn2" time,
             "checkOut2" time,
             "checkIn3" time,
             "checkOut3" time,
             "workdayCount" numeric,
             "workHours" numeric,
             "extraWorkdayCount" numeric,
             "extraHours" numeric,
             "lateMinutes" integer,
             "earlyLeaveMinutes" integer,
             "overtimeNormalHours" numeric,
             "overtimeSundayHours" numeric,
             "overtimeHolidayHours" numeric,
             symbol text,
             "extraSymbol" text,
             "totalHours" numeric
           )`,
          [
            payroll_cycle_id,
            importId,
            JSON.stringify(attendanceRows),
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
   * Get cleaned records whose work dates fall inside the selected cycle period.
   */
  static async getRecordsByCycleId(cycleId: string, factoryId: string, search?: string) {
    let sql = `WITH selected_cycle AS (
                 SELECT id, factory_id, period_start, period_end
                 FROM payroll_cycles
                 WHERE id = $1 AND factory_id = $2
               ),
               cycle_attendance AS (
                 SELECT DISTINCT ON (COALESCE(ar.employee_id::text, ar.employee_code), ar.work_date)
                        ar.id, ar.employee_code, ar.employee_name, ar.work_date,
                        ar.weekday_name, ar.department_name, ar.position_title,
                        ar.shift_name, ar.check_in_1, ar.check_out_1,
                        ar.check_in_2, ar.check_out_2, ar.workday_count,
                        ar.work_hours, ar.late_minutes, ar.early_leave_minutes,
                        ar.overtime_normal_hours, ar.overtime_sunday_hours,
                        ar.overtime_holiday_hours, ar.symbol, ar.total_hours
                 FROM attendance_records ar
                 JOIN employees e ON e.id = ar.employee_id
                 CROSS JOIN selected_cycle sc
                 WHERE ar.work_date >= sc.period_start
                   AND ar.work_date <= sc.period_end
                   AND e.factory_id = sc.factory_id
                 ORDER BY COALESCE(ar.employee_id::text, ar.employee_code), ar.work_date, ar.updated_at DESC, ar.created_at DESC, ar.id DESC
               )
               SELECT id, employee_code as "employeeCode", employee_name as "employeeName", work_date as "workDate",
                      weekday_name as "weekdayName", department_name as "departmentName", position_title as "positionTitle",
                      shift_name as "shiftName", check_in_1 as "checkIn1", check_out_1 as "checkOut1",
                      check_in_2 as "checkIn2", check_out_2 as "checkOut2", workday_count as "workdayCount",
                      work_hours as "workHours", late_minutes as "lateMinutes", early_leave_minutes as "earlyLeaveMinutes",
                      overtime_normal_hours as "overtimeNormalHours", overtime_sunday_hours as "overtimeSundayHours",
                      overtime_holiday_hours as "overtimeHolidayHours", symbol, total_hours as "totalHours"
               FROM cycle_attendance
               WHERE true`;
    const params: any[] = [cycleId, factoryId];

    if (search) {
      sql += ` AND (employee_code ILIKE $3 OR employee_name ILIKE $3 OR department_name ILIKE $3)`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY employee_code ASC, work_date ASC`;

    return await query(sql, params);
  }
}
