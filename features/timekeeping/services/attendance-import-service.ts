import { withTransaction, query } from "@/lib/db";
import type { SessionUser } from "@/lib/auth-session";
import { validationError } from "@/lib/errors";
import {
  normalizeAttendanceRow,
  parseAttendanceBuffer,
} from "@/features/timekeeping/services/attendance-cleaning-service";
import type { AttendanceValidationError } from "@/features/timekeeping/types/timekeeping-types";

export async function importAttendance(
  payrollCycleId: string,
  fileName: string,
  buffer: Buffer,
  user: SessionUser,
) {
  const parsedRows = parseAttendanceBuffer(fileName, buffer);
  if (!parsedRows.length) {
    throw validationError("Không tìm thấy dòng header 'Mã N.Viên' trong file");
  }

  return withTransaction(async (client) => {
    const cycle = await client.query<{ status: string }>(
      "SELECT status FROM payroll_cycles WHERE id = $1 FOR UPDATE",
      [payrollCycleId],
    );
    const status = cycle.rows[0]?.status;
    if (!status) throw validationError("Không tìm thấy chu kỳ lương");
    if (!["draft", "imported", "cleaned"].includes(status)) {
      throw validationError("Trạng thái chu kỳ không cho phép import chấm công");
    }

    const importResult = await client.query<{ id: string }>(
      `INSERT INTO attendance_imports (payroll_cycle_id, file_name, source_kind, imported_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        payrollCycleId,
        fileName,
        fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls") ? "excel" : "csv",
        user.userId,
      ],
    );
    const importId = importResult.rows[0].id;
    const errors: AttendanceValidationError[] = [];
    let validRows = 0;

    for (const parsedRow of parsedRows) {
      const normalized = normalizeAttendanceRow(parsedRow.raw);
      const rowErrors: string[] = [];
      if (!normalized.employeeCode) rowErrors.push("Thiếu mã nhân viên");
      if (!normalized.employeeName) rowErrors.push("Thiếu tên nhân viên");
      if (!normalized.workDate) rowErrors.push("Ngày không hợp lệ");

      const employee = normalized.employeeCode
        ? await client.query<{ id: string }>(
            "SELECT id FROM employees WHERE employee_code = $1 AND deleted_at IS NULL",
            [normalized.employeeCode],
          )
        : null;
      const employeeId = employee?.rows[0]?.id ?? null;
      if (normalized.employeeCode && !employeeId) rowErrors.push("Không tìm thấy nhân viên");

      await client.query(
        `INSERT INTO attendance_raw_rows (import_id, row_number, raw_data, validation_errors)
         VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
        [importId, parsedRow.rowNumber, JSON.stringify(parsedRow.raw), JSON.stringify(rowErrors)],
      );

      if (rowErrors.length) {
        errors.push({ rowNumber: parsedRow.rowNumber, employeeCode: normalized.employeeCode, errors: rowErrors });
        continue;
      }

      validRows += 1;
      await client.query(
        `INSERT INTO attendance_records (
          payroll_cycle_id, import_id, employee_id, employee_code, employee_name, work_date,
          weekday_name, department_name, position_title, shift_name,
          check_in_1, check_out_1, check_in_2, check_out_2, check_in_3, check_out_3,
          workday_count, work_hours, extra_workday_count, extra_hours,
          late_minutes, early_leave_minutes, overtime_normal_hours, overtime_sunday_hours,
          overtime_holiday_hours, symbol, extra_symbol, total_hours
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10,
          NULLIF($11, '')::time, NULLIF($12, '')::time, NULLIF($13, '')::time, NULLIF($14, '')::time,
          NULLIF($15, '')::time, NULLIF($16, '')::time, $17, $18, $19, $20, $21, $22, $23, $24,
          $25, $26, $27, $28
        )
        ON CONFLICT (payroll_cycle_id, employee_code, work_date) DO UPDATE
        SET import_id = EXCLUDED.import_id,
          employee_id = EXCLUDED.employee_id,
          employee_name = EXCLUDED.employee_name,
          weekday_name = EXCLUDED.weekday_name,
          department_name = EXCLUDED.department_name,
          position_title = EXCLUDED.position_title,
          shift_name = EXCLUDED.shift_name,
          check_in_1 = EXCLUDED.check_in_1,
          check_out_1 = EXCLUDED.check_out_1,
          check_in_2 = EXCLUDED.check_in_2,
          check_out_2 = EXCLUDED.check_out_2,
          check_in_3 = EXCLUDED.check_in_3,
          check_out_3 = EXCLUDED.check_out_3,
          workday_count = EXCLUDED.workday_count,
          work_hours = EXCLUDED.work_hours,
          extra_workday_count = EXCLUDED.extra_workday_count,
          extra_hours = EXCLUDED.extra_hours,
          late_minutes = EXCLUDED.late_minutes,
          early_leave_minutes = EXCLUDED.early_leave_minutes,
          overtime_normal_hours = EXCLUDED.overtime_normal_hours,
          overtime_sunday_hours = EXCLUDED.overtime_sunday_hours,
          overtime_holiday_hours = EXCLUDED.overtime_holiday_hours,
          symbol = EXCLUDED.symbol,
          extra_symbol = EXCLUDED.extra_symbol,
          total_hours = EXCLUDED.total_hours,
          updated_at = now()`,
        [
          payrollCycleId,
          importId,
          employeeId,
          normalized.employeeCode,
          normalized.employeeName,
          normalized.workDate,
          normalized.weekdayName,
          normalized.departmentName,
          normalized.positionTitle,
          normalized.shiftName,
          normalized.checkIn1 ?? "",
          normalized.checkOut1 ?? "",
          normalized.checkIn2 ?? "",
          normalized.checkOut2 ?? "",
          normalized.checkIn3 ?? "",
          normalized.checkOut3 ?? "",
          normalized.workdayCount,
          normalized.workHours,
          normalized.extraWorkdayCount,
          normalized.extraHours,
          normalized.lateMinutes,
          normalized.earlyLeaveMinutes,
          normalized.overtimeNormalHours,
          normalized.overtimeSundayHours,
          normalized.overtimeHolidayHours,
          normalized.symbol,
          normalized.extraSymbol,
          normalized.totalHours,
        ],
      );
    }

    await client.query(
      `UPDATE attendance_imports
       SET status = $2, total_rows = $3, valid_rows = $4, invalid_rows = $5,
        error_summary = $6::jsonb, processed_at = now()
       WHERE id = $1`,
      [
        importId,
        errors.length ? "validated" : "processed",
        parsedRows.length,
        validRows,
        errors.length,
        JSON.stringify(errors),
      ],
    );
    await client.query(
      `UPDATE payroll_cycles SET status = $2, updated_at = now() WHERE id = $1`,
      [payrollCycleId, errors.length ? "imported" : "cleaned"],
    );

    return {
      importId,
      totalRows: parsedRows.length,
      validRows,
      invalidRows: errors.length,
      errors,
    };
  });
}

export async function listAttendanceImports(searchParams: URLSearchParams) {
  const cycleId = searchParams.get("cycleId");
  const result = await query(
    `SELECT ai.*, pc.code AS cycle_code
     FROM attendance_imports ai
     JOIN payroll_cycles pc ON pc.id = ai.payroll_cycle_id
     WHERE ($1::uuid IS NULL OR ai.payroll_cycle_id = $1::uuid)
     ORDER BY imported_at DESC
     LIMIT 100`,
    [cycleId || null],
  );
  return result.rows.map((row) => ({
    id: row.id,
    payrollCycleId: row.payroll_cycle_id,
    cycleCode: row.cycle_code,
    fileName: row.file_name,
    sourceKind: row.source_kind,
    status: row.status,
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    invalidRows: row.invalid_rows,
    errorSummary: row.error_summary,
    importedAt: row.imported_at,
    processedAt: row.processed_at,
  }));
}

export async function listAttendanceRecords(searchParams: URLSearchParams) {
  const cycleId = searchParams.get("cycleId");
  const employeeCode = searchParams.get("employeeCode");
  const result = await query(
    `SELECT ar.*
     FROM attendance_records ar
     WHERE ($1::uuid IS NULL OR ar.payroll_cycle_id = $1::uuid)
       AND ($2 = '' OR ar.employee_code = $2)
     ORDER BY ar.work_date DESC, ar.employee_code ASC
     LIMIT 500`,
    [cycleId || null, employeeCode || ""],
  );
  return result.rows.map((row) => ({
    id: row.id,
    payrollCycleId: row.payroll_cycle_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    workDate: row.work_date,
    workdayCount: row.workday_count,
    workHours: row.work_hours,
    overtimeNormalHours: row.overtime_normal_hours,
    overtimeSundayHours: row.overtime_sunday_hours,
    overtimeHolidayHours: row.overtime_holiday_hours,
    totalHours: row.total_hours,
  }));
}
