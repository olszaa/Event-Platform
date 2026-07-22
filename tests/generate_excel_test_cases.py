import sys
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

FILE_PATH = r"d:\Project\event-platform\tests\test_cases.xlsx"

def create_excel_test_cases():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Automation Test Cases"

    # Header Styling
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Deep Navy
    header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)

    headers = [
        "TestCaseID",
        "Suite",
        "TestCaseName",
        "Method",
        "Endpoint",
        "PayloadJSON",
        "RequireAuth",
        "ExpectedStatus",
        "ExpectedField"
    ]

    ws.append(headers)

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center

    test_cases = [
        # Suite 1: Auth
        ["TC-001", "Auth", "Admin Valid Login", "POST", "/api/auth/login", '{"username": "admin", "password": "password123"}', "FALSE", 200, "data.token"],
        ["TC-002", "Auth", "Reject Invalid Password Login", "POST", "/api/auth/login", '{"username": "admin", "password": "wrongpassword"}', "FALSE", 401, "message"],
        
        # Suite 2: Events
        ["TC-003", "Events", "List Active Events", "GET", "/api/events?status=ACTIVE,PUBLISHED", "", "FALSE", 200, "data"],
        ["TC-004", "Events", "Get Event Details by ID", "GET", "/api/events/${eventId}", "", "FALSE", 200, "data.name"],
        
        # Suite 3: CheckinPoints
        ["TC-005", "CheckinPoints", "Get Entrance Points List", "GET", "/api/checkin/points?eventId=${eventId}", "", "FALSE", 200, "data"],
        ["TC-006", "CheckinPoints", "Create New Entrance Gate", "POST", "/api/checkin/points", '{"eventId": "${eventId}", "name": "Excel Gate Door 1", "location": "Hall 1", "isActive": true, "sortOrder": 10}', "TRUE", 201, "data.id"],
        
        # Suite 4: Registration & Checkin
        ["TC-007", "Registration", "Register New Attendee", "POST", "/api/registrations", '{"eventId": "${eventId}", "fullName": "Excel Tester Guest", "email": "excel.test.${timestamp}@example.com", "phone": "0899999999", "company": "Excel QA Corp"}', "FALSE", 201, "data.id"],
        ["TC-008", "Checkin", "Perform Gate Check-in", "POST", "/api/checkin", '{"registrationId": "${registrationId}", "checkinPointId": "${pointId}", "method": "MANUAL"}', "FALSE", 201, "data.checkin.id"],
        
        # Suite 5: Lucky Draw Engine
        ["TC-009", "LuckyDraw", "Fetch Prizes & Eligible Count", "GET", "/api/prizes?eventId=${eventId}", "", "FALSE", 200, "data"],
        ["TC-010", "LuckyDraw", "Start Draw Session", "POST", "/api/draws/start", '{"eventId": "${eventId}", "prizeId": "${prizeId}", "drawCount": 1}', "TRUE", 201, "data.id"],
        ["TC-011", "LuckyDraw", "Execute Spin Fisher-Yates Draw", "POST", "/api/draws/${drawSessionId}/spin", '{"count": 1}', "FALSE", 200, "data.winners"],
        
        # Suite 6: Winner Management
        ["TC-012", "WinnerMgmt", "Update Winner Status to ACCEPTED", "PUT", "/api/draws/winners/${winnerId}", '{"status": "ACCEPTED"}', "TRUE", 200, "data.status"],
        ["TC-013", "WinnerMgmt", "Delete Winner & Recalculate Quota", "DELETE", "/api/draws/winners/${winnerId}", "", "TRUE", 200, "message"]
    ]

    for tc in test_cases:
        ws.append(tc)

    # Column Width Auto-fit & Formatting
    for row in ws.iter_rows(min_row=2, max_row=len(test_cases) + 1, min_col=1, max_col=len(headers)):
        for cell in row:
            cell.alignment = align_left
            cell.font = Font(name="Calibri", size=10)

    col_widths = {
        "A": 12, # TestCaseID
        "B": 15, # Suite
        "C": 35, # TestCaseName
        "D": 10, # Method
        "E": 40, # Endpoint
        "F": 50, # PayloadJSON
        "G": 14, # RequireAuth
        "H": 15, # ExpectedStatus
        "I": 15  # ExpectedField
    }

    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    wb.save(FILE_PATH)
    print(f"Excel Test Cases Template generated successfully at: {FILE_PATH}")

if __name__ == "__main__":
    create_excel_test_cases()
