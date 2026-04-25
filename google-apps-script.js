// ══════════════════════════════════════════════════════
// SAMMY TRUONG — Google Apps Script  v2
// Paste toàn bộ file này vào script.google.com
// Sau đó: Deploy → Manage deployments → chọn version mới → Deploy
// ══════════════════════════════════════════════════════

const SPREADSHEET_ID = '1eqvoXI08L1d_Z5F6628pc1CZqB2xRavJugEL6N5CC6A';

const SHEET_DANG_KY  = 'DangKy';
const SHEET_XAC_NHAN = 'XacNhanCK';
const SHEET_KHOA_HOC = 'KhoaHoc';

// ────────────────────────────────────────────────────
// doGet — nhận GET request từ website (cách chính)
// ────────────────────────────────────────────────────
function doGet(e) {
  try {
    const raw  = e.parameter && e.parameter.payload
                   ? decodeURIComponent(e.parameter.payload)
                   : null;

    if (!raw) {
      return buildResponse({ status: 'ok', message: 'Sammy API v2 running' });
    }

    const data = JSON.parse(raw);
    const type = data.formType || 'dang-ky';

    let result;
    if (type === 'update-status') {
      result = updateStatus(data);
    } else if (type === 'check-access') {
      result = checkCourseAccess(data);
      return buildResponse(result);
    } else if (type === 'activate-course') {
      result = activateCourse(data);
    } else if (type === 'xac-nhan-ck') {
      result = saveXacNhanCK(data);
    } else if (type === 'khoa-hoc') {
      result = saveKhoaHoc(data);
    } else {
      result = saveDangKy(data);
    }

    return buildResponse({ success: true, message: 'Đã lưu', row: result });
  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return buildResponse({ success: false, error: err.message });
  }
}

// ────────────────────────────────────────────────────
// doPost — nhận POST request (giữ lại làm fallback)
// ────────────────────────────────────────────────────
function doPost(e) {
  try {
    const raw  = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const type = data.formType || 'dang-ky';

    let result;
    if (type === 'xac-nhan-ck') {
      result = saveXacNhanCK(data);
    } else if (type === 'khoa-hoc') {
      result = saveKhoaHoc(data);
    } else {
      result = saveDangKy(data);
    }

    return buildResponse({ success: true, message: 'Đã lưu', row: result });
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return buildResponse({ success: false, error: err.message });
  }
}

// ────────────────────────────────────────────────────
// Lưu đăng ký dịch vụ luận giải
// ────────────────────────────────────────────────────
function saveDangKy(data) {
  const sheet = getOrCreateSheet(SHEET_DANG_KY, [
    'Thời Gian', 'Họ Tên', 'Ngày Sinh', 'Email', 'Zalo',
    'Gói Dịch Vụ', 'Ghi Chú', 'Trạng Thái'
  ]);
  sheet.appendRow([
    formatTime(),
    clean(data.fullName  || data.hoTen),
    clean(data.dob       || data.ngaySinh),
    clean(data.email),
    clean(data.zalo      || data.soDienThoai),
    clean(data.package   || data.tenGoi || data.goal),
    clean(data.note      || data.ghiChu),
    'Chờ Thanh Toán'
  ]);
  return sheet.getLastRow();
}

// ────────────────────────────────────────────────────
// Lưu xác nhận chuyển khoản
// ────────────────────────────────────────────────────
function saveXacNhanCK(data) {
  const sheet = getOrCreateSheet(SHEET_XAC_NHAN, [
    'Thời Gian', 'Họ Tên', 'Email', 'Zalo',
    'Gói Đã Chọn', 'Mã Gói', 'Số Tiền', 'Trạng Thái'
  ]);
  const pkgMap = {
    'co-ban': 500000, 'nang-cao': 1000000, 'dac-biet': 2000000,
    'me-be-nang-cao': 1500000, 'me-be-dac-biet': 3000000,
    '2-ngay-sinh-nang-cao': 1500000, '2-ngay-sinh-dac-biet': 3000000,
    'truc-tiep-11': 3000000
  };
  const price = pkgMap[data.packageId] || data.price || 0;
  sheet.appendRow([
    formatTime(),
    clean(data.customerName || data.fullName),
    clean(data.email),
    clean(data.zalo || data.soDienThoai),
    clean(data.packageName),
    clean(data.packageId),
    price ? price.toLocaleString('vi-VN') + ' VNĐ' : '',
    'Đã Chuyển Khoản'
  ]);
  return sheet.getLastRow();
}

// ────────────────────────────────────────────────────
// Lưu đăng ký khóa học 3 Gốc
// ────────────────────────────────────────────────────
function saveKhoaHoc(data) {
  const sheet = getOrCreateSheet(SHEET_KHOA_HOC, [
    'Thời Gian', 'Họ Tên', 'Ngày Sinh', 'Email', 'Zalo', 'Mục Tiêu', 'Trạng Thái'
  ]);
  sheet.appendRow([
    formatTime(),
    clean(data.fullName || data.hoTen),
    clean(data.dob      || data.ngaySinh),
    clean(data.email),
    clean(data.zalo     || data.soDienThoai),
    clean(data.goal     || data.ghiChu),
    'Chờ Thanh Toán'
  ]);
  return sheet.getLastRow();
}

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setBackground('#4F6BFF');
    hRange.setFontColor('#FFFFFF');
    hRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    for (let i = 1; i <= headers.length; i++) sheet.autoResizeColumn(i);
  }
  return sheet;
}

function buildResponse(obj) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function formatTime() {
  return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
}

function clean(val) {
  return val ? String(val).trim() : '';
}

// ────────────────────────────────────────────────────
// Kiểm tra học viên đã thanh toán khoá học chưa
// ────────────────────────────────────────────────────
function checkCourseAccess(data) {
  const email = clean(data.email || '').toLowerCase();
  if (!email) return { activated: false };

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_KHOA_HOC);
  if (!sheet) return { activated: false };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const rowEmail  = String(values[i][3] || '').toLowerCase(); // cột D = Email
    const rowStatus = String(values[i][6] || '');               // cột G = Trạng Thái
    if (rowEmail === email && rowStatus === 'Đã Thanh Toán ✓') {
      return { activated: true };
    }
  }
  return { activated: false };
}

// ────────────────────────────────────────────────────
// Kích hoạt học viên khi SePay xác nhận thanh toán
// ────────────────────────────────────────────────────
function activateCourse(data) {
  const email  = clean(data.email || '').toLowerCase();
  const status = clean(data.status || 'Đã Thanh Toán ✓');
  if (!email) return null;

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_KHOA_HOC);
  if (!sheet) return null;

  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    const rowEmail = String(values[i][3] || '').toLowerCase();
    if (rowEmail === email) {
      sheet.getRange(i + 1, 7).setValue(status); // cột G = Trạng Thái
      Logger.log('Kích hoạt học viên: ' + email);
      return i + 1;
    }
  }
  return null;
}

// ────────────────────────────────────────────────────
// Cập nhật trạng thái đơn hàng khi SePay xác nhận
// ────────────────────────────────────────────────────
function updateStatus(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_DANG_KY);
  if (!sheet) return null;

  const values  = sheet.getDataRange().getValues();
  const email   = clean(data.email  || '').toLowerCase();
  const pkgId   = clean(data.pkgId  || '');
  const status  = clean(data.status || 'Đã Thanh Toán ✓');
  const COL_EMAIL  = 4; // cột E (index 3 = Email)
  const COL_PKG    = 6; // cột F (index 5 = Gói Dịch Vụ)
  const COL_STATUS = 8; // cột H (index 7 = Trạng Thái)

  for (let i = values.length - 1; i >= 1; i--) {
    const rowEmail = String(values[i][COL_EMAIL - 1] || '').toLowerCase();
    const rowPkg   = String(values[i][COL_PKG   - 1] || '').toLowerCase();
    const rowStt   = String(values[i][COL_STATUS - 1] || '');

    // Đã hoàn thành rồi thì bỏ qua
    if (rowStt === 'Đã Thanh Toán ✓') continue;

    const emailMatch = email && rowEmail === email;
    const pkgMatch   = pkgId && rowPkg.includes(pkgId.toLowerCase());

    if (emailMatch || pkgMatch) {
      sheet.getRange(i + 1, COL_STATUS).setValue(status);
      Logger.log('Cập nhật trạng thái dòng ' + (i + 1) + ': ' + status);
      return i + 1;
    }
  }

  Logger.log('Không tìm thấy dòng để cập nhật: email=' + email + ' pkgId=' + pkgId);
  return null;
}
