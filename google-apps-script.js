// ══════════════════════════════════════════════════════
// SAMMY TRUONG — Google Apps Script  v5
// ══════════════════════════════════════════════════════

const SPREADSHEET_ID = '1eqvoXI08L1d_Z5F6628pc1CZqB2xRavJugEL6N5CC6A';
const SHEET_MAIN = 'DonHang';

const COL = { THOIGIAN:0, LOAI:1, HOTEN:2, NGAYSINH:3, EMAIL:4, ZALO:5, GOI:6, GHICHU:7, TRANGTHAI:8 };
const HEADERS = ['Thời Gian','Loại','Họ Tên','Ngày Sinh','Email','Zalo','Gói Dịch Vụ','Ghi Chú','Trạng Thái'];

// Xóa dấu tiếng Việt → ASCII để so sánh an toàn
function vi(str) {
  return String(str || '').toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g,'a').replace(/[èéẹẻẽêềếệểễ]/g,'e')
    .replace(/[ìíịỉĩ]/g,'i').replace(/[òóọỏõôồốộổỗơờớợởỡ]/g,'o')
    .replace(/[ùúụủũưừứựửữ]/g,'u').replace(/[ỳýỵỷỹ]/g,'y')
    .replace(/đ/g,'d').replace(/[^a-z0-9 ]/g,'').trim();
}

// pkgId → từ khóa ASCII để tìm trong cột Gói
function pkgKey(pkgId) {
  const m = {
    'co-ban':'co ban','nang-cao':'nang cao','dac-biet':'dac biet',
    'me-be-nang-cao':'me','me-be-dac-biet':'me',
    '2-ngay-sinh-nang-cao':'ngay sinh','2-ngay-sinh-dac-biet':'ngay sinh',
    'truc-tiep-11':'truc tiep','khoa-hoc-3-goc':'khoa hoc'
  };
  return m[pkgId] || pkgId.replace(/-/g,' ');
}

// pkgId → tên hiển thị đầy đủ (dùng khi tạo row fallback)
function pkgName(pkgId) {
  const m = {
    'co-ban':'Gói Cơ Bản','nang-cao':'Gói Nâng Cao','dac-biet':'Gói Đặc Biệt',
    'me-be-nang-cao':'Gói Mẹ & Bé — Nâng Cao','me-be-dac-biet':'Gói Mẹ & Bé — Đặc Biệt',
    '2-ngay-sinh-nang-cao':'Gói 2 Ngày Sinh — Nâng Cao','2-ngay-sinh-dac-biet':'Gói 2 Ngày Sinh — Đặc Biệt',
    'truc-tiep-11':'Gói Trực Tiếp 1:1','khoa-hoc-3-goc':'Khóa Học 3 Gốc'
  };
  return m[pkgId] || pkgId;
}

function doGet(e) {
  try {
    const raw = e.parameter && e.parameter.payload ? decodeURIComponent(e.parameter.payload) : null;
    if (!raw) return buildResponse({ status:'ok', message:'Sammy API v5' });
    const data = JSON.parse(raw);
    const type = data.formType || 'dang-ky';
    let result;
    if      (type === 'update-status')   result = updateStatus(data);
    else if (type === 'check-payment') { return buildResponse(checkPayment(data)); }
    else if (type === 'check-access')  { return buildResponse(checkCourseAccess(data)); }
    else if (type === 'activate-course') result = activateCourse(data);
    else if (type === 'xac-nhan-ck')     result = saveXacNhanCK(data);
    else if (type === 'khoa-hoc')        result = saveKhoaHoc(data);
    else                                 result = saveDangKy(data);
    return buildResponse({ success:true, message:'Đã lưu', row:result });
  } catch(err) {
    Logger.log('doGet error: ' + err.message);
    return buildResponse({ success:false, error:err.message });
  }
}

function doPost(e) {
  try {
    const raw  = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const type = data.formType || 'dang-ky';
    let result;
    if      (type === 'xac-nhan-ck') result = saveXacNhanCK(data);
    else if (type === 'khoa-hoc')    result = saveKhoaHoc(data);
    else                             result = saveDangKy(data);
    return buildResponse({ success:true, message:'Đã lưu', row:result });
  } catch(err) {
    Logger.log('doPost error: ' + err.message);
    return buildResponse({ success:false, error:err.message });
  }
}

function saveDangKy(data) {
  const sheet = getOrCreateSheet(SHEET_MAIN, HEADERS);
  sheet.appendRow([formatTime(),'Bài Luận',
    clean(data.fullName||data.hoTen), clean(data.dob||data.ngaySinh),
    clean(data.email), clean(data.zalo||data.soDienThoai),
    clean(data.package||data.tenGoi||data.goal), clean(data.note||data.ghiChu),
    'Chờ Thanh Toán']);
  return sheet.getLastRow();
}

function saveKhoaHoc(data) {
  const sheet = getOrCreateSheet(SHEET_MAIN, HEADERS);
  sheet.appendRow([formatTime(),'Học Viên',
    clean(data.fullName||data.hoTen), clean(data.dob||data.ngaySinh),
    clean(data.email), clean(data.zalo||data.soDienThoai),
    'Khóa Học 3 Gốc', clean(data.goal||data.ghiChu), 'Chờ Thanh Toán']);
  return sheet.getLastRow();
}

function saveXacNhanCK(data) {
  // Chỉ cập nhật trạng thái dòng hiện có — KHÔNG tạo dòng mới
  const sheet  = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values = sheet.getDataRange().getValues();
  const email  = clean(data.email||'').toLowerCase();
  const key    = pkgKey(clean(data.packageId||''));
  for (let i = values.length-1; i >= 1; i--) {
    const rowEmail = String(values[i][COL.EMAIL]||'').toLowerCase();
    const rowPkg   = vi(values[i][COL.GOI]);
    const rowStt   = String(values[i][COL.TRANGTHAI]||'');
    if (rowStt === 'Đã Thanh Toán ✓') continue;
    if ((email && rowEmail === email) || (key && rowPkg.includes(key))) {
      sheet.getRange(i+1, COL.TRANGTHAI+1).setValue('Đã Chuyển Khoản');
      return i+1;
    }
  }
  return null;
}

function updateStatus(data) {
  const sheet   = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values  = sheet.getDataRange().getValues();
  const email   = clean(data.email||'').toLowerCase();
  const pId     = clean(data.pkgId||'');
  const key     = pkgKey(pId);
  const status  = clean(data.status||'Đã Thanh Toán ✓');

  Logger.log('updateStatus: email='+email+' pkgId='+pId+' key='+key+' rows='+(values.length-1));

  for (let i = values.length-1; i >= 1; i--) {
    const rowEmail = String(values[i][COL.EMAIL]||'').toLowerCase();
    const rowPkg   = vi(values[i][COL.GOI]);
    const rowStt   = String(values[i][COL.TRANGTHAI]||'');
    Logger.log('  row '+i+': email='+rowEmail+' pkg='+rowPkg+' stt='+rowStt);
    if (rowStt === 'Đã Thanh Toán ✓') continue;
    if ((email && rowEmail === email) || (key && rowPkg.includes(key))) {
      sheet.getRange(i+1, COL.TRANGTHAI+1).setValue(status);
      Logger.log('  → UPDATED row '+(i+1));
      return i+1;
    }
  }

  // Fallback: tạo row mới nếu không tìm thấy (đề phòng form chưa submit)
  Logger.log('updateStatus: không tìm thấy row, tạo mới');
  sheet.appendRow([formatTime(),'Bài Luận','','',email,'',pkgName(pId),'',status]);
  return sheet.getLastRow();
}

function checkPayment(data) {
  const sheet  = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values = sheet.getDataRange().getValues();
  const email  = clean(data.email||'').toLowerCase();
  const key    = pkgKey(clean(data.pkgId||''));

  Logger.log('checkPayment: email='+email+' key='+key);

  for (let i = values.length-1; i >= 1; i--) {
    const rowEmail = String(values[i][COL.EMAIL]||'').toLowerCase();
    const rowPkg   = vi(values[i][COL.GOI]);
    const rowStt   = String(values[i][COL.TRANGTHAI]||'');
    if (rowStt !== 'Đã Thanh Toán ✓') continue;
    if ((email && rowEmail === email) || (key && rowPkg.includes(key))) {
      Logger.log('  → PAID found row '+(i+1));
      return { paid:true };
    }
  }
  return { paid:false };
}

function checkCourseAccess(data) {
  const email = clean(data.email||'').toLowerCase();
  if (!email) return { activated:false };
  const sheet  = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][COL.LOAI]||'') === 'Học Viên' &&
        String(values[i][COL.EMAIL]||'').toLowerCase() === email &&
        String(values[i][COL.TRANGTHAI]||'') === 'Đã Thanh Toán ✓')
      return { activated:true };
  }
  return { activated:false };
}

function activateCourse(data) {
  const email  = clean(data.email||'').toLowerCase();
  const status = clean(data.status||'Đã Thanh Toán ✓');
  if (!email) return null;
  const sheet  = getOrCreateSheet(SHEET_MAIN, HEADERS);
  const values = sheet.getDataRange().getValues();
  for (let i = values.length-1; i >= 1; i--) {
    if (String(values[i][COL.LOAI]||'') === 'Học Viên' &&
        String(values[i][COL.EMAIL]||'').toLowerCase() === email) {
      sheet.getRange(i+1, COL.TRANGTHAI+1).setValue(status);
      return i+1;
    }
  }
  return null;
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const r = sheet.getRange(1,1,1,headers.length);
    r.setBackground('#4F6BFF'); r.setFontColor('#FFFFFF'); r.setFontWeight('bold');
    sheet.getRange(1,2).setBackground('#7B5EA7');
    sheet.getRange(1,9).setBackground('#2DD4BF').setFontColor('#04051A');
    sheet.setFrozenRows(1);
    for (let i = 1; i <= headers.length; i++) sheet.autoResizeColumn(i);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Bài Luận','Học Viên'],true).build();
    sheet.getRange(2,2,1000,1).setDataValidation(rule);
  }
  return sheet;
}

function buildResponse(obj) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function formatTime() {
  return Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','dd/MM/yyyy HH:mm:ss');
}

function clean(val) { return val ? String(val).trim() : ''; }
