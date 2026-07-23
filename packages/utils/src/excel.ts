import * as XLSX from "xlsx";

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
}

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: ImportError[];
  totalRows: number;
  validRows: number;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Parse an Excel file buffer and return rows as objects
 */
export function parseExcel<T extends Record<string, unknown>>(
  buffer: Buffer,
  columnMapping?: Record<string, string>
): ImportResult<T> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, field: "", message: "No sheet found in file" }],
      totalRows: 0,
      validRows: 0,
    };
  }

  const sheet = workbook.Sheets[sheetName]!;
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const data: T[] = [];
  const errors: ImportError[] = [];

  rawData.forEach((row, index) => {
    try {
      let mappedRow: Record<string, unknown>;

      if (columnMapping) {
        mappedRow = {};
        const rowNormalized: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          rowNormalized[String(k).trim().toLowerCase()] = v;
        }

        for (const [excelHeader, fieldKey] of Object.entries(columnMapping)) {
          if (mappedRow[fieldKey] !== undefined && mappedRow[fieldKey] !== null && mappedRow[fieldKey] !== "") {
            continue; // Keep existing value from earlier matching header alias
          }
          const normKey = String(excelHeader).trim().toLowerCase();
          const cellVal = row[excelHeader] ?? rowNormalized[normKey];
          if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== "") {
            mappedRow[fieldKey] = typeof cellVal === "string" ? cellVal.trim() : cellVal;
          }
        }
      } else {
        mappedRow = row;
      }

      data.push(mappedRow as T);
    } catch {
      errors.push({
        row: index + 2,
        field: "",
        message: "Failed to parse row",
      });
    }
  });

  return {
    success: errors.length === 0,
    data,
    errors,
    totalRows: rawData.length,
    validRows: data.length,
  };
}

/**
 * Generate an Excel file buffer from data
 */
export function generateExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExcelColumn[],
  sheetName: string = "Sheet1"
): Buffer {
  const headers = columns.map((c) => c.header);
  const rows = data.map((item) =>
    columns.map((col) => {
      const value = item[col.key];
      return value !== null && value !== undefined ? String(value) : "";
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  worksheet["!cols"] = columns.map((col) => ({
    wch: col.width ?? 15,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return Buffer.from(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  );
}

/**
 * Get default registration column mapping (Thai → English)
 */
export function getDefaultRegistrationMapping(): Record<string, string> {
  return {
    "Timestamp": "timestamp",
    "Registration ID / QR Code": "qrCode",
    "QR Code": "qrCode",
    "รหัสลงทะเบียน": "qrCode",
    "ชื่อ-นามสกุล": "fullName",
    "ชื่อ": "fullName",
    "Full Name": "fullName",
    "Name": "fullName",
    "อีเมล": "email",
    "Email": "email",
    "เบอร์โทร": "phone",
    "Phone": "phone",
    "บริษัท/หน่วยงาน/องค์กร": "company",
    "บริษัท": "company",
    "หน่วยงาน": "company",
    "องค์กร": "company",
    "Company": "company",
    "แผนก": "department",
    "Department": "department",
    "ประเภทพนักงาน": "employeeType",
    "Employee Type": "employeeType",
    "Ticket Number": "ticketNumber",
    "Lucky Draw Number": "luckyDrawNumber",
    "สถานะ": "status",
    "Status": "status",
  };
}
