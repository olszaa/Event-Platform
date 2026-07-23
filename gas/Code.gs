/**
 * Event Platform - Google Apps Script (GAS) Backend
 * Google Sheet Structure (4 Tabs):
 * 1. registered - รายชื่อผู้ลงทะเบียนใหม่ (รอการอนุมัติ)
 * 2. apploval - รายชื่อผู้ได้รับการอนุมัติ (เตรียม Import เข้า Event Platform)
 * 3. club - รายชื่อบริษัท/หน่วยงาน/องค์กร (Master Data สำหรับ Dropdown)
 * 4. winer - รายชื่อผู้ได้รับรางวัลจากการจับ Lucky Draw
 */

// Global Sheet Configuration
const SPREADSHEET_ID = "1JoU8E2DJIpGg494XtTeVNlfWlojUrGF2";

const SHEET_NAMES = {
  REGISTERED: "registered",
  APPROVAL: "apploval",
  CLUB: "club",
  WINNER: "winer",
  SETTINGS: "settings"
};

/**
 * Helper function to retrieve the active Spreadsheet.
 * Supports Container-Bound script and Standalone script via Script Properties / SPREADSHEET_ID.
 */
function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  const sheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || SPREADSHEET_ID;
  if (sheetId) {
    return SpreadsheetApp.openById(sheetId);
  }
  
  throw new Error("ไม่สามารถเปิด Google Sheet ได้ กรุณาตรวจสอบ SPREADSHEET_ID");
}

/**
 * Main Web App Handler (doGet)
 */
function doGet(e) {
  const htmlOutput = HtmlService.createTemplateFromFile("Index").evaluate();
  htmlOutput.setTitle("ระบบลงทะเบียนเข้าร่วมงาน (Event Registration System)");
  htmlOutput.addMetaTag("viewport", "width=device-width, initial-scale=1");
  htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return htmlOutput;
}

/**
 * Get Registration Open/Close Status
 */
function getRegistrationStatus() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.SETTINGS);
    sheet.appendRow(["SettingKey", "SettingValue"]);
    sheet.appendRow(["IS_REGISTRATION_OPEN", "TRUE"]);
    return { isOpen: true };
  }
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "IS_REGISTRATION_OPEN") {
      return { isOpen: String(data[i][1]).toUpperCase() === "TRUE" };
    }
  }
  return { isOpen: true };
}

/**
 * Toggle Registration Open/Close (Admin)
 */
function toggleRegistration(isOpen) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.SETTINGS);
    sheet.appendRow(["SettingKey", "SettingValue"]);
  }
  
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "IS_REGISTRATION_OPEN") {
      sheet.getRange(i + 1, 2).setValue(isOpen ? "TRUE" : "FALSE");
      found = true;
      break;
    }
  }
  if (!found) {
    sheet.appendRow(["IS_REGISTRATION_OPEN", isOpen ? "TRUE" : "FALSE"]);
  }
  return { success: true, isOpen: isOpen };
}

/**
 * Get Companies/Clubs dropdown list from 'club' tab
 */
function getClubList() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.CLUB);
  if (!sheet) {
    // Create default tab if missing
    sheet = ss.insertSheet(SHEET_NAMES.CLUB);
    sheet.appendRow(["ชื่อบริษัท/หน่วยงาน/องค์กร", "สถานะใช้งาน"]);
    sheet.appendRow(["บริษัท ตัวอย่าง จำกัด", "ใช้งาน"]);
    sheet.appendRow(["องค์กรภาครัฐ", "ใช้งาน"]);
    sheet.appendRow(["หน่วยงานอิสระ", "ใช้งาน"]);
  }
  
  const data = sheet.getDataRange().getValues();
  const clubs = [];
  for (let i = 1; i < data.length; i++) {
    const clubName = data[i][0];
    const status = data[i][1];
    if (clubName && (status === undefined || status === "" || String(status).trim() === "ใช้งาน" || String(status).trim() === "ACTIVE")) {
      clubs.push(String(clubName).trim());
    }
  }
  return clubs;
}

/**
 * Handle User Registration
 */
function registerUser(formData) {
  // Check if registration is open
  const statusCheck = getRegistrationStatus();
  if (!statusCheck.isOpen) {
    return { success: false, error: "ระบบปิดรับลงทะเบียนอยู่ในขณะนี้" };
  }

  const { fullName, email, phone, company, department, employeeType } = formData;
  if (!fullName || !phone || !company) {
    return { success: false, error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" };
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.REGISTERED);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.REGISTERED);
    sheet.appendRow(["Timestamp", "Registration ID / QR Code", "ชื่อ-นามสกุล", "อีเมล", "เบอร์โทร", "บริษัท/หน่วยงาน/องค์กร", "แผนก", "ประเภทพนักงาน", "Ticket Number", "Lucky Draw Number", "สถานะ"]);
  }

  // Generate unique Registration Code (QR Code ID)
  const timestamp = new Date();
  const qrCode = "EVT-" + Math.floor(100000 + Math.random() * 900000);
  const initialStatus = "รอการอนุมัติ";

  sheet.appendRow([
    timestamp,
    qrCode,
    fullName,
    email || "-",
    phone,
    company,
    department || "-",
    employeeType || "-",
    "-",
    "-",
    initialStatus
  ]);

  return {
    success: true,
    data: {
      qrCode: qrCode,
      fullName: fullName,
      email: email,
      phone: phone,
      company: company,
      department: department || "-",
      employeeType: employeeType || "-",
      status: initialStatus,
      timestamp: timestamp.toISOString()
    }
  };
}

/**
 * Track Registration Status by Phone, Email, or QR Code
 */
function checkRegistrationStatus(query) {
  if (!query) return { success: false, error: "กรุณาระบุคำค้นหา" };
  const searchStr = String(query).trim().toLowerCase();
  const ss = getSpreadsheet();
  
  // Search in 'apploval' tab first
  const approvalSheet = ss.getSheetByName(SHEET_NAMES.APPROVAL);
  if (approvalSheet) {
    const data = approvalSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const qrCode = String(data[i][1] || "").toLowerCase();
      const name = String(data[i][2] || "").toLowerCase();
      const email = String(data[i][3] || "").toLowerCase();
      const phone = String(data[i][4] || "").toLowerCase();

      if (qrCode === searchStr || phone === searchStr || email === searchStr || name.includes(searchStr)) {
        let dept = "-";
        let empType = "-";
        let ticketNum = "-";
        let luckyNum = "-";
        let statusVal = "อนุมัติ";

        if (data[i].length >= 11) {
          dept = data[i][6] || "-";
          empType = data[i][7] || "-";
          ticketNum = data[i][8] || "-";
          luckyNum = data[i][9] || "-";
          statusVal = data[i][10] || "อนุมัติ";
        } else if (data[i].length >= 9) {
          ticketNum = data[i][6] || "-";
          luckyNum = data[i][7] || "-";
          statusVal = data[i][8] || "อนุมัติ";
        } else {
          statusVal = data[i][6] || "อนุมัติ";
        }

        return {
          success: true,
          data: {
            qrCode: data[i][1],
            fullName: data[i][2],
            email: data[i][3],
            phone: data[i][4],
            company: data[i][5],
            department: dept,
            employeeType: empType,
            ticketNumber: ticketNum,
            luckyDrawNumber: luckyNum,
            status: statusVal
          }
        };
      }
    }
  }

  // Search in 'registered' tab
  const regSheet = ss.getSheetByName(SHEET_NAMES.REGISTERED);
  if (regSheet) {
    const data = regSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const qrCode = String(data[i][1] || "").toLowerCase();
      const name = String(data[i][2] || "").toLowerCase();
      const email = String(data[i][3] || "").toLowerCase();
      const phone = String(data[i][4] || "").toLowerCase();

      if (qrCode === searchStr || phone === searchStr || email === searchStr || name.includes(searchStr)) {
        let dept = "-";
        let empType = "-";
        let ticketNum = "-";
        let luckyNum = "-";
        let statusVal = "รอการอนุมัติ";

        if (data[i].length >= 11) {
          dept = data[i][6] || "-";
          empType = data[i][7] || "-";
          ticketNum = data[i][8] || "-";
          luckyNum = data[i][9] || "-";
          statusVal = data[i][10] || "รอการอนุมัติ";
        } else if (data[i].length >= 9) {
          ticketNum = data[i][6] || "-";
          luckyNum = data[i][7] || "-";
          statusVal = data[i][8] || "รอการอนุมัติ";
        } else {
          statusVal = data[i][6] || "รอการอนุมัติ";
        }

        return {
          success: true,
          data: {
            qrCode: data[i][1],
            fullName: data[i][2],
            email: data[i][3],
            phone: data[i][4],
            company: data[i][5],
            department: dept,
            employeeType: empType,
            ticketNumber: ticketNum,
            luckyDrawNumber: luckyNum,
            status: statusVal
          }
        };
      }
    }
  }

  return { success: false, error: "ไม่พบข้อมูลการลงทะเบียนที่ตรงกับคำค้นหา" };
}

/**
 * Get Winner List from 'winer' tab
 */
function getWinners() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.WINNER);
  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const winners = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] || data[i][2]) {
      winners.push({
        luckyDrawNumber: data[i][0] || "-",
        ticketNumber: data[i][1] || "-",
        fullName: data[i][2] || "-",
        company: data[i][3] || "-",
        prizeName: data[i][4] || "รางวัลโชคดี",
        wonAt: data[i][5] ? new Date(data[i][5]).toLocaleString("th-TH") : "-"
      });
    }
  }
  return winners;
}
