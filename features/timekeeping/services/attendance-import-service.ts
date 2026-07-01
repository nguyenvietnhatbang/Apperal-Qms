import { query, queryOne, transaction } from "@/lib/db";
import * as xlsx from "xlsx";

export class AttendanceImportService {
  /**
   * Create an import task and save raw rows to DB
   */
  static async importRawData(
    cycleId: string,
    fileName: string,
    fileBuffer: Buffer,
    userId: string
  ) {
    return await transaction(async (client) => {
      // Create import record
      const importRes = await client.query(
        `INSERT INTO attendance_imports (payroll_cycle_id, file_name, source_kind, status, imported_by)
         VALUES ($1, $2, $3, 'uploaded', $4)
         RETURNING id`,
        [cycleId, fileName, fileName.endsWith(".xlsx") ? "xlsx" : "csv", userId]
      );
      const importId = importRes.rows[0].id;

      // Update cycle status to 'imported'
      await client.query(
        `UPDATE payroll_cycles SET status = 'imported', updated_at = now() WHERE id = $1`,
        [cycleId]
      );

      // Parse file buffer
      let rawRows: any[] = [];
      const isXlsx = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

      if (isXlsx) {
        const workbook = xlsx.read(fileBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Read raw sheet as array of arrays
        rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      } else {
        // Parse CSV/TSV
        const fileContent = fileBuffer.toString("utf8");
        // Split into lines
        const lines = fileContent.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          // Detect separator: Tab or Comma
          const separator = line.includes("\t") ? "\t" : ",";
          // Simple split, handle quotes if needed
          const cols = line.split(separator).map(col => {
            let val = col.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).trim();
            }
            return val;
          });
          rawRows.push(cols);
        }
      }

      // Find the header row
      // We look for a row containing "Mã N.Viên" or "Mã nhân viên"
      let headerRowIndex = -1;
      let headers: string[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (Array.isArray(row)) {
          const normalizedJoined = row.join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\./g, "");
          if (
            normalizedJoined.includes("ma nvien") || 
            normalizedJoined.includes("ma nhan vien") || 
            normalizedJoined.includes("ma so") || 
            normalizedJoined.includes("ma nv") || 
            normalizedJoined.includes("manv")
          ) {
            headerRowIndex = i;
            headers = row.map(h => String(h || "").trim());
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        throw new Error("Không tìm thấy dòng tiêu đề (Header row) chứa mã nhân viên trong file.");
      }

      // Process rows after the header row
      let totalRows = 0;
      for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

        // Map row array to JSON object using headers
        const rowData: Record<string, any> = {};
        let hasData = false;
        
        headers.forEach((header, index) => {
          if (header) {
            const val = row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : "";
            rowData[header] = val;
            if (val) hasData = true;
          }
        });

        // Skip completely empty rows
        if (!hasData) continue;

        totalRows++;
        
        // Insert into raw rows
        await client.query(
          `INSERT INTO attendance_raw_rows (import_id, row_number, raw_data)
           VALUES ($1, $2, $3)`,
          [importId, totalRows, JSON.stringify(rowData)]
        );
      }

      // Update import details
      await client.query(
        `UPDATE attendance_imports 
         SET total_rows = $1, status = 'validated' 
         WHERE id = $2`,
        [totalRows, importId]
      );

      return {
        importId,
        totalRows,
      };
    });
  }

  /**
   * Get all imports for a cycle
   */
  static async getImportsByCycleId(cycleId: string) {
    return await query(
      `SELECT i.id, i.file_name as "fileName", i.source_kind as "sourceKind", i.status, 
              i.total_rows as "totalRows", i.valid_rows as "validRows", i.invalid_rows as "invalidRows",
              i.imported_at as "importedAt", u.display_name as "importedBy"
       FROM attendance_imports i
       LEFT JOIN app_users u ON i.imported_by = u.id
       WHERE i.payroll_cycle_id = $1
       ORDER BY i.imported_at DESC`,
      [cycleId]
    );
  }
}
