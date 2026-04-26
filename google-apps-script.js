// ══════════════════════════════════════════════════════
// SAMMY TRUONG — Google Apps Script  v4
// 1 sheet duy nhất "DonHang" cho cả Bài Luận & Học Viên
// ══════════════════════════════════════════════════════

const SPREADSHEET_ID = '1eqvoXI08L1d_Z5F6628pc1CZqB2xRavJugEL6N5CC6A';
const SHEET_MAIN     = 'DonHang';

// Cột (0-based index)
const COL = {
  THOIGIAN : 0,
  LOAI     : 1,
  HOTEN    : 2,
  NGAYSINH : 3,
  EMAIL    : 4,
  ZALO     : 5,
  GOI      : 6,
  GHICHU   : 7,
  TRANGTHAI: 8
};

const HEADERS = [
  'Thời Gian','Loại','Họ Tên','Ngày Sinh',
  'Email','Zalo','Gói Dịch Vụ','Ghi Chú','Trạng Thái'
];

// Chuyển pkgId → từ khóa tiếng Việt để tìm trong sheet
function pkgKeyword(pkgId) {
  const map = {
    'co-ban'                : 'cơ bản',
    'nang-cao'              : 'nâng cao',
    'dac-biet'              : 'đặc biệt',
    'me-be-nang-cao'        : 'mẹ',
    'me-be-dac-biet'        : 'mẹ',
    '2-ngay-sinh-nang-cao'  : 'ngày sinh',
    '2-ngay-sinh-dac-biet'  : 'ngày sinh',
    'truc-tiep-11'          : 'trực tiếp',
    'khoa-hoc-3-goc'        : 'khóa học'
  };
  return map[pkgId] || pkgId;
}

// ────────────────────────────────────────────────────
// doGet
// ────────────────────────────────────────────────────
function doGet(e) {
  try {
    const raw = e.parameter && e.parameter.payload
                  ? decodeURIComponent(e.parameter.payload) : null;
    if (!raw) return buildResponse({ status: 'ok', message: 'Sammy API v4' });

    const data = JSON.parse(raw);
    const type = data.formType || 'dang-ky';
    let result;

    if      (type === 'update-status')  result = updateStatus(data);
    else if (type === 'check-payment')  { return buildResponse(checkPayment(data)); }
    else if (type === 'check-access')   { return buildResponse(checkCourseAccess(data)); }
    else if (type === 'activate-course') result = activateCourse(data);
    else if (type === 'xac-nhan-ck')    result = saveXacNhanCK(data);
    else if (type === 'khoa-hoc')       result = saveKhoaHoc(data);
    else                                result = saveDangKy(data);

    return buildResponse({ success: true, message: 'Đã lưu', row: result });
  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return buildResponse({ success: false, error: err.message });
  }
}

// ────────────────────────────────────────────────────
// doPost
// ────────────────────────────────────────────────────
function doPost(e) {
  try {
    const raw  = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const type = data.formType || 'dang-ky';
    let result;
    if      (type === 'xac-nhan-ck') result = saveXacNhanCK(data);
    else if (type === 'khoa-hoc')    result = saveKhoaHoc(data);
    else                             result = saveDangKy(data);
    return buildResponse({ success: true, message: 'Đã lưu', row: result });
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return buildResponse({ success: false, error: err.message });
  }
}

// ────────────────────────────────────────────────────
// Lưu đăng ký luận giải → Loại = Bài Luận
// ────────────────────────────────────────────────────
function saveDangKy(data) {
  const sheet = getOrCreateSheet(SHEET_MAIN, HEADERS);
  sheet.appendRow([
    formatTime(),
    'Bài Luận',
    clean(data.fullName || data.hoTen),
    clean(data.dob      || data.ngaySinh),
    clean(data.email),
    clean(data.zalo     || data.soDienThoai),
    clean(data.package  || data.tenGoi || data.goal),
    clean(data.note     || data.ghiChu),
    'Chờ Thanh Toán'
  ]);
  return sheet.getLastRow();
}

// ────────────────────────────────────────────────────
// Lưu đăng ký khóa học → Loại = Học Viên
// ────────────────────────────────────────────────────
function saveKhoaHoc(data) {
  const sheet = getOrCreateSheet(SHEET_MAIN, HEADERS);
  sheet.appendRow([
    formatTime(),
    'Học Viên',
    clean(data.fullName || data.hoTen),
    clean(data.dob      || data.ngaySinh),
    clean(data.email),
    clean(data.zalo     || data.soDienThoai),
    'Khóa Học 3 Gốc',
    clean(data.goal     || data.ghiChu),
    'Chờ Thanh Toán'
  ]);
  return sheet.getLastRow();
}

// ────────────────────────────────────────────────────
// Xác nhận chuyển khoản → cập nhật dòng hiện có
// ────────────────────────────────────────────────────
function saveXacNhanCK(data) {
  const sheet     = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values    = sheet.getDataRange().getValues();
  const email     = clean(data.email || '').toLowerCase();
  const pkgId     = clean(data.packageId || '');
  const pkgSearch = pkgKeyword(pkgId);

  for (let i = values.length - 1; i >= 1; i--) {
    const rowEmail = String(values[i][COL.EMAIL] || '').toLowerCase();
    const rowPkg   = String(values[i][COL.GOI]   || '').toLowerCase();
    const rowStt   = String(values[i][COL.TRANGTHAI] || '');
    if (rowStt === 'Đã Thanh Toán ✓') continue;
    const emailMatch = email && rowEmail === email;
    const pkgMatch   = pkgSearch && rowPkg.includes(pkgSearch);
    if (emailMatch || pkgMatch) {
      sheet.getRange(i + 1, COL.TRANGTHAI + 1).setValue('Đã Chuyển Khoản');
      return i + 1;
    }
  }

  // Không tìm thấy dòng → tạo mới
  sheet.appendRow([
    formatTime(), 'Bài Luận',
    clean(data.customerName || data.fullName), '',
    clean(data.email), clean(data.zalo || ''),
    clean(data.packageName), '', 'Đã Chuyển Khoản'
  ]);
  return sheet.getLastRow();
}

// ────────────────────────────────────────────────────
// Cập nhật trạng thái khi SePay xác nhận
// ────────────────────────────────────────────────────
function updateStatus(data) {
  const sheet     = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values    = sheet.getDataRange().getValues();
  const email     = clean(data.email  || '').toLowerCase();
  const pkgId     = clean(data.pkgId  || '');
  const pkgSearch = pkgKeyword(pkgId);
  const status    = clean(data.status || 'Đã Thanh Toán ✓');

  for (let i = values.length - 1; i >= 1; i--) {
    const rowEmail = String(values[i][COL.EMAIL]     || '').toLowerCase();
    const rowPkg   = String(values[i][COL.GOI]       || '').toLowerCase();
    const rowStt   = String(values[i][COL.TRANGTHAI] || '');
    if (rowStt === 'Đã Thanh Toán ✓') continue;
    const emailMatch = email && rowEmail === email;
    const pkgMatch   = pkgSearch && rowPkg.includes(pkgSearch);
    if (emailMatch || pkgMatch) {
      sheet.getRange(i + 1, COL.TRANGTHAI + 1).setValue(status);
      Logger.log('updateStatus dòng ' + (i+1) + ' → ' + status);
      return i + 1;
    }
  }
  Logger.log('updateStatus: không tìm thấy | email=' + email + ' pkgSearch=' + pkgSearch);
  return null;
}

// ────────────────────────────────────────────────────
// Kiểm tra đã thanh toán (polling)
// ────────────────────────────────────────────────────
function checkPayment(data) {
  const sheet     = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values    = sheet.getDataRange().getValues();
  const email     = clean(data.email  || '').toLowerCase();
  const pkgId     = clean(data.pkgId  || '');
  const pkgSearch = pkgKeyword(pkgId);

  for (let i = values.length - 1; i >= 1; i--) {
    const rowEmail = String(values[i][COL.EMAIL]     || '').toLowerCase();
    const rowPkg   = String(values[i][COL.GOI]       || '').toLowerCase();
    const rowStt   = String(values[i][COL.TRANGTHAI] || '');
    const emailMatch = email && rowEmail === email;
    const pkgMatch   = pkgSearch && rowPkg.includes(pkgSearch);
    if ((emailMatch || pkgMatch) && rowStt === 'Đã Thanh Toán ✓') return { paid: true };
  }
  return { paid: false };
}

// ────────────────────────────────────────────────────
// Kiểm tra quyền truy cập khóa học
// ────────────────────────────────────────────────────
function checkCourseAccess(data) {
  const email = clean(data.email || '').toLowerCase();
  if (!email) return { activated: false };
  const sheet  = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const rowLoai  = String(values[i][COL.LOAI]      || '');
    const rowEmail = String(values[i][COL.EMAIL]     || '').toLowerCase();
    const rowStt   = String(values[i][COL.TRANGTHAI] || '');
    if (rowLoai === 'Học Viên' && rowEmail === email && rowStt === 'Đã Thanh Toán ✓')
      return { activated: true };
  }
  return { activated: false };
}

// ────────────────────────────────────────────────────
// Kích hoạt học viên (webhook SePay 3GOC)
// ────────────────────────────────────────────────────
function activateCourse(data) {
  const email  = clean(data.email  || '').toLowerCase();
  const status = clean(data.status || 'Đã Thanh Toán ✓');
  if (!email) return null;
  const sheet  = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    const rowLoai  = String(values[i][COL.LOAI]  || '');
    const rowEmail = String(values[i][COL.EMAIL] || '').toLowerCase();
    if (rowLoai === 'Học Viên' && rowEmail === email) {
      sheet.getRange(i + 1, COL.TRANGTHAI + 1).setValue(status);
      Logger.log('activateCourse: ' + email);
      return i + 1;
    }
  }
  return null;
}

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const r = sheet.getRange(1, 1, 1, headers.length);
    r.setBackground('#4F6BFF'); r.setFontColor('#FFFFFF'); r.setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Màu cột Loại
    sheet.getRange(1, 2).setBackground('#7B5EA7');
    // Màu cột Trạng Thái
    sheet.getRange(1, 9).setBackground('#2DD4BF').setFontColor('#04051A');
    for (let i = 1; i <= headers.length; i++) sheet.autoResizeColumn(i);
    // Cột Loại có dropdown
    const loaiRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Bài Luận', 'Học Viên'], true).build();
    sheet.getRange(2, 2, 1000, 1).setDataValidation(loaiRule);
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

function clean(val) { return val ? String(val).trim() : ''; }
