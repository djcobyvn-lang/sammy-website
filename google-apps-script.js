// ══════════════════════════════════════════════════════
// SAMMY TRUONG — Google Apps Script  v7
// ══════════════════════════════════════════════════════

var SPREADSHEET_ID = '1eqvoXI08L1d_Z5F6628pc1CZqB2xRavJugEL6N5CC6A';

// ── Tên các sheet ────────────────────────────────────
var S_MAIN      = 'DonHang';
var S_HOC_VIEN  = 'Học Viên';
var S_LUAN_GIAI = 'Luận Giải';

// ── Cột trong sheet DonHang ──────────────────────────
var C = { TG:0, LOAI:1, HO_TEN:2, NGAY_SINH:3, EMAIL:4, ZALO:5, GOI:6, GHI_CHU:7, TRANG_THAI:8 };

var H_MAIN      = ['Thời Gian','Loại','Họ Tên','Ngày Sinh','Email','Zalo','Gói Dịch Vụ','Ghi Chú','Trạng Thái'];
var H_HOC_VIEN  = ['Thời Gian','Họ Tên','Email','Zalo','Loại Khóa','Trạng Thái'];
var H_LUAN_GIAI = ['Thời Gian','Họ Tên','Ngày Sinh','Email','Zalo','Gói Dịch Vụ','Ghi Chú','Trạng Thái'];

// ── Xóa dấu tiếng Việt → ASCII ──────────────────────
function vi(str) {
  return String(str || '').toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g,'a').replace(/[èéẹẻẽêềếệểễ]/g,'e')
    .replace(/[ìíịỉĩ]/g,'i').replace(/[òóọỏõôồốộổỗơờớợởỡ]/g,'o')
    .replace(/[ùúụủũưừứựửữ]/g,'u').replace(/[ỳýỵỷỹ]/g,'y')
    .replace(/đ/g,'d').replace(/[^a-z0-9 ]/g,'').trim();
}

function clean(val) { return val ? String(val).trim() : ''; }

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
}

// ── pkgId → từ khóa tìm kiếm ────────────────────────
function pkgKey(id) {
  var m = {
    'co-ban':'co ban', 'nang-cao':'nang cao', 'dac-biet':'dac biet',
    'me-be-nang-cao':'me be nang cao', 'me-be-dac-biet':'me be dac biet',
    '2-ngay-sinh-nang-cao':'2 ngay sinh nang cao', '2-ngay-sinh-dac-biet':'2 ngay sinh dac biet',
    'truc-tiep-11':'truc tiep', 'khoa-hoc-3-goc':'khoa hoc 3 goc'
  };
  return m[id] || id.replace(/-/g,' ');
}

// ── pkgId → tên hiển thị ────────────────────────────
function pkgName(id) {
  var m = {
    'co-ban':'Gói Cơ Bản', 'nang-cao':'Gói Nâng Cao', 'dac-biet':'Gói Đặc Biệt',
    'me-be-nang-cao':'Gói Mẹ & Bé — Nâng Cao', 'me-be-dac-biet':'Gói Mẹ & Bé — Đặc Biệt',
    '2-ngay-sinh-nang-cao':'Gói 2 Ngày Sinh — Nâng Cao', '2-ngay-sinh-dac-biet':'Gói 2 Ngày Sinh — Đặc Biệt',
    'truc-tiep-11':'Gói Trực Tiếp 1:1', 'khoa-hoc-3-goc':'Khóa Học 3 Gốc'
  };
  return m[id] || id;
}

// ════════════════════════════════════════════════════
// ROUTING
// ════════════════════════════════════════════════════
function doGet(e) {
  try {
    var raw = e.parameter && e.parameter.payload ? decodeURIComponent(e.parameter.payload) : null;
    if (!raw) return ok({ message: 'Sammy API v7' });
    var d = JSON.parse(raw);
    var t = d.formType || 'dang-ky';
    var r;
    if      (t === 'update-status')   r = updateStatus(d);
    else if (t === 'check-payment')   return ok(checkPayment(d));
    else if (t === 'check-access')    return ok(checkCourseAccess(d));
    else if (t === 'activate-course') r = activateCourse(d);
    else if (t === 'ebook-order')     r = saveEbookOrder(d);
    else if (t === 'advanced-course') r = saveAdvancedCourse(d);
    else if (t === 'tarot-order')     r = saveTarotOrder(d);
    else if (t === 'xac-nhan-ck')     r = saveXacNhanCK(d);
    else if (t === 'khoa-hoc')        r = saveKhoaHoc(d);
    else if (t === 'save-article')    r = saveArticle(d);
    else if (t === 'delete-article')  r = deleteArticle(d);
    else                              r = saveDangKy(d);
    return ok({ success: true, row: r });
  } catch(err) {
    Logger.log('doGet error: ' + err.message);
    return ok({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData ? e.postData.contents : '{}');
    var t = d.formType || 'dang-ky';
    var r;
    if      (t === 'xac-nhan-ck') r = saveXacNhanCK(d);
    else if (t === 'khoa-hoc')    r = saveKhoaHoc(d);
    else                          r = saveDangKy(d);
    return ok({ success: true, row: r });
  } catch(err) {
    Logger.log('doPost error: ' + err.message);
    return ok({ success: false, error: err.message });
  }
}

// ════════════════════════════════════════════════════
// GHI DỮ LIỆU MỚI (từ form đăng ký)
// ════════════════════════════════════════════════════

// Luận giải: khách submit form
function saveDangKy(d) {
  var tg = now(), ht = clean(d.fullName||d.hoTen), ns = clean(d.dob||d.ngaySinh),
      em = clean(d.email), zl = clean(d.zalo||d.soDienThoai),
      goi = clean(d.package||d.tenGoi||d.goal), gc = clean(d.note||d.ghiChu);
  mainSheet().appendRow([tg,'Bài Luận',ht,ns,em,zl,goi,gc,'Chờ Thanh Toán']);
  luanGiaiSheet().appendRow([tg,ht,ns,em,zl,goi,gc,'Chờ Thanh Toán']);
  return mainSheet().getLastRow();
}

// Khóa học nền tảng: khách submit form
function saveKhoaHoc(d) {
  var tg = now(), ht = clean(d.fullName||d.hoTen), ns = clean(d.dob||d.ngaySinh),
      em = clean(d.email), zl = clean(d.zalo||d.soDienThoai), gc = clean(d.goal||d.ghiChu);
  mainSheet().appendRow([tg,'Học Viên',ht,ns,em,zl,'Khóa Học 3 Gốc',gc,'Chờ Thanh Toán']);
  hocVienSheet().appendRow([tg,ht,em,zl,'Khóa Học 3 Gốc','Chờ Thanh Toán']);
  return mainSheet().getLastRow();
}

// ════════════════════════════════════════════════════
// XÁC NHẬN THANH TOÁN (từ webhook SePay)
// ════════════════════════════════════════════════════

// Khóa học nền tảng: webhook xác nhận HV
function activateCourse(d) {
  var em = clean(d.email||'').toLowerCase(), nm = clean(d.name||''),
      ph = clean(d.phone||''), st = clean(d.status||'Đã Thanh Toán ✓');
  if (!em) return null;
  var s = mainSheet(), rows = s.getDataRange().getValues();
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][C.LOAI]||'') === 'Học Viên' &&
        String(rows[i][C.EMAIL]||'').toLowerCase() === em) {
      s.getRange(i+1, C.TRANG_THAI+1).setValue(st);
      _updateHocVien(em, 'Khóa Học 3 Gốc', st);
      return i+1;
    }
  }
  // Tạo mới nếu chưa có
  var tg = now();
  s.appendRow([tg,'Học Viên',nm,'',em,ph,'Khóa Học 3 Gốc','',st]);
  hocVienSheet().appendRow([tg,nm,em,ph,'Khóa Học 3 Gốc',st]);
  return s.getLastRow();
}

// Luận giải: webhook xác nhận
function updateStatus(d) {
  var em = clean(d.email||'').toLowerCase(), pid = clean(d.pkgId||''),
      key = pkgKey(pid), st = clean(d.status||'Đã Thanh Toán ✓'),
      nm = clean(d.name||''), ph = clean(d.phone||'');
  var s = mainSheet(), rows = s.getDataRange().getValues();
  Logger.log('updateStatus email='+em+' pkgId='+pid+' key='+key);

  // Pass 1: khớp email + gói + chỉ Bài Luận
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][C.LOAI]||'') === 'Học Viên') continue;
    if (String(rows[i][C.TRANG_THAI]||'') === 'Đã Thanh Toán ✓') continue;
    var rEm = String(rows[i][C.EMAIL]||'').toLowerCase();
    var rPkg = vi(rows[i][C.GOI]);
    if (em && rEm === em && key && rPkg.includes(vi(key))) {
      s.getRange(i+1, C.TRANG_THAI+1).setValue(st);
      _updateLuanGiai(em, vi(key), st);
      Logger.log('updated row '+(i+1)+' exact');
      return i+1;
    }
  }
  // Pass 2: chỉ khớp gói
  for (var j = rows.length-1; j >= 1; j--) {
    if (String(rows[j][C.LOAI]||'') === 'Học Viên') continue;
    if (String(rows[j][C.TRANG_THAI]||'') === 'Đã Thanh Toán ✓') continue;
    var rEm2 = String(rows[j][C.EMAIL]||'').toLowerCase();
    var rPkg2 = vi(rows[j][C.GOI]);
    if (key && rPkg2.includes(vi(key))) {
      if (!rEm2 || !em || rEm2 === em) {
        s.getRange(j+1, C.TRANG_THAI+1).setValue(st);
        if (em && !rEm2) s.getRange(j+1, C.EMAIL+1).setValue(em);
        if (nm && !rows[j][C.HO_TEN]) s.getRange(j+1, C.HO_TEN+1).setValue(nm);
        if (ph && !rows[j][C.ZALO])   s.getRange(j+1, C.ZALO+1).setValue(ph);
        _updateLuanGiai(em, vi(key), st);
        Logger.log('updated row '+(j+1)+' pkgKey');
        return j+1;
      }
    }
  }
  // Fallback: tạo row mới
  var tgF = now(), goiF = pkgName(pid);
  s.appendRow([tgF,'Bài Luận',nm,'',em,ph,goiF,'',st]);
  luanGiaiSheet().appendRow([tgF,nm,'',em,ph,goiF,'',st]);
  Logger.log('created new row');
  return s.getLastRow();
}

// Khóa học chuyên sâu
function saveAdvancedCourse(d) {
  var em = clean(d.email||'').toLowerCase(), nm = clean(d.name||''),
      ph = clean(d.phone||''), st = clean(d.status||'Đã Thanh Toán ✓');
  var s = mainSheet(), rows = s.getDataRange().getValues();
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][C.EMAIL]||'').toLowerCase() === em &&
        vi(rows[i][C.GOI]).includes('chuyen sau')) {
      s.getRange(i+1, C.TRANG_THAI+1).setValue(st);
      _updateHocVien(em, 'Khóa Học Chuyên Sâu', st);
      return i+1;
    }
  }
  var tg = now();
  s.appendRow([tg,'Học Viên',nm,'',em,ph,'Khóa Học Chuyên Sâu','',st]);
  hocVienSheet().appendRow([tg,nm,em,ph,'Khóa Học Chuyên Sâu',st]);
  return s.getLastRow();
}

// Ebook
function saveEbookOrder(d) {
  var em = clean(d.email||'').toLowerCase(), nm = clean(d.name||''),
      ph = clean(d.phone||''), st = clean(d.status||'Đã Thanh Toán ✓');
  var s = mainSheet(), rows = s.getDataRange().getValues();
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][C.EMAIL]||'').toLowerCase() === em &&
        vi(rows[i][C.GOI]).includes('ebook')) {
      s.getRange(i+1, C.TRANG_THAI+1).setValue(st);
      return i+1;
    }
  }
  s.appendRow([now(),'Ebook',nm,'',em,ph,'Ebook Hành Trình Tiến Hóa Tối Thượng','',st]);
  return s.getLastRow();
}

// Tarot
function saveTarotOrder(d) {
  var em = clean(d.email||'').toLowerCase(), nm = clean(d.name||''),
      ph = clean(d.phone||''), q = clean(d.question||''),
      st = clean(d.status||'Đã Thanh Toán ✓');
  var s = mainSheet(), rows = s.getDataRange().getValues();
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][C.EMAIL]||'').toLowerCase() === em &&
        vi(rows[i][C.GOI]).includes('tarot')) {
      s.getRange(i+1, C.TRANG_THAI+1).setValue(st);
      _updateLuanGiai(em, 'trai bai tarot', st);
      return i+1;
    }
  }
  var tg = now();
  s.appendRow([tg,'Bài Luận',nm,'',em,ph,'Trải Bài Tarot',q,st]);
  luanGiaiSheet().appendRow([tg,nm,'',em,ph,'Trải Bài Tarot',q,st]);
  return s.getLastRow();
}

// Xác nhận chuyển khoản thủ công
function saveXacNhanCK(d) {
  var em = clean(d.email||'').toLowerCase(), key = pkgKey(clean(d.packageId||''));
  var s = mainSheet(), rows = s.getDataRange().getValues();
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][C.TRANG_THAI]||'') === 'Đã Thanh Toán ✓') continue;
    var rEm = String(rows[i][C.EMAIL]||'').toLowerCase();
    var rPkg = vi(rows[i][C.GOI]);
    if ((em && rEm === em) || (key && rPkg.includes(vi(key)))) {
      s.getRange(i+1, C.TRANG_THAI+1).setValue('Đã Chuyển Khoản');
      return i+1;
    }
  }
  return null;
}

// ════════════════════════════════════════════════════
// KIỂM TRA
// ════════════════════════════════════════════════════
function checkPayment(d) {
  var em = clean(d.email||'').toLowerCase(), key = pkgKey(clean(d.pkgId||''));
  var rows = mainSheet().getDataRange().getValues();
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][C.TRANG_THAI]||'') !== 'Đã Thanh Toán ✓') continue;
    var rEm = String(rows[i][C.EMAIL]||'').toLowerCase();
    var rPkg = vi(rows[i][C.GOI]);
    if ((em && rEm === em) || (key && rPkg.includes(vi(key))))
      return { paid: true };
  }
  return { paid: false };
}

function checkCourseAccess(d) {
  var em = clean(d.email||'').toLowerCase();
  if (!em) return { activated: false };
  var rows = mainSheet().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][C.LOAI]||'') === 'Học Viên' &&
        String(rows[i][C.EMAIL]||'').toLowerCase() === em &&
        String(rows[i][C.TRANG_THAI]||'') === 'Đã Thanh Toán ✓')
      return { activated: true };
  }
  return { activated: false };
}

// ════════════════════════════════════════════════════
// CẬP NHẬT SUB-SHEETS
// ════════════════════════════════════════════════════
function _updateHocVien(email, loaiKhoa, trangThai) {
  var s = hocVienSheet(), rows = s.getDataRange().getValues();
  var em = (email||'').toLowerCase();
  for (var i = rows.length-1; i >= 1; i--) {
    if (String(rows[i][2]||'').toLowerCase() === em &&
        String(rows[i][4]||'') === loaiKhoa) {
      s.getRange(i+1, 6).setValue(trangThai);
      return;
    }
  }
}

function _updateLuanGiai(email, goiNorm, trangThai) {
  var s = luanGiaiSheet(), rows = s.getDataRange().getValues();
  var em = (email||'').toLowerCase();
  for (var i = rows.length-1; i >= 1; i--) {
    var rEm = String(rows[i][3]||'').toLowerCase();
    var rGoi = vi(String(rows[i][5]||''));
    if (rEm === em && goiNorm && rGoi.includes(goiNorm)) {
      s.getRange(i+1, 8).setValue(trangThai);
      return;
    }
  }
}

// ════════════════════════════════════════════════════
// SYNC — chạy 1 lần để backfill dữ liệu cũ
// ════════════════════════════════════════════════════
function syncAllSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  // Reset sub-sheets
  ['Học Viên','Luận Giải'].forEach(function(n) {
    var s = ss.getSheetByName(n); if (s) ss.deleteSheet(s);
  });
  var rows = mainSheet().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var loai = String(r[C.LOAI]||'');
    var tg   = r[C.TG], ht = String(r[C.HO_TEN]||''), ns = String(r[C.NGAY_SINH]||''),
        em   = String(r[C.EMAIL]||''), zl = String(r[C.ZALO]||''),
        goi  = String(r[C.GOI]||''), gc = String(r[C.GHI_CHU]||''),
        stt  = String(r[C.TRANG_THAI]||'');
    if (loai === 'Học Viên') {
      hocVienSheet().appendRow([tg,ht,em,zl,goi,stt]);
    } else if (loai === 'Bài Luận') {
      luanGiaiSheet().appendRow([tg,ht,ns,em,zl,goi,gc,stt]);
    }
  }
  Logger.log('syncAllSheets done — ' + (rows.length-1) + ' rows processed');
}

// ════════════════════════════════════════════════════
// HELPERS — lấy sheet, tạo nếu chưa có
// ════════════════════════════════════════════════════
function mainSheet()     { return _getSheet(S_MAIN,      H_MAIN,      true);  }
function hocVienSheet()  { return _getSheet(S_HOC_VIEN,  H_HOC_VIEN,  false); }
function luanGiaiSheet() { return _getSheet(S_LUAN_GIAI, H_LUAN_GIAI, false); }
function baiVietSheet()  { return _getSheet('Bài Viết',  ['ID','Tiêu Đề','Slug','Danh Mục','Ngày Đăng','Tóm Tắt','Hình','Màu Nền','Trạng Thái','Cập Nhật'], false); }

// ════════════════════════════════════════════════════
// BÀI VIẾT — save / delete
// ════════════════════════════════════════════════════
function saveArticle(d) {
  var sheet = baiVietSheet();
  var data  = sheet.getDataRange().getValues();
  var now   = new Date().toLocaleString('vi-VN');
  var row   = [
    String(d.id || ''),
    String(d.title || ''),
    String(d.slug  || ''),
    String(d.category || ''),
    String(d.date || ''),
    String(d.excerpt || ''),
    String(d.thumb || ''),
    String(d.color || ''),
    String(d.status || 'published'),
    now
  ];
  // Tìm hàng có cùng id để cập nhật
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(d.id)) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return i + 1;
    }
  }
  // Chưa có → thêm mới
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function deleteArticle(d) {
  var sheet = baiVietSheet();
  var data  = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(d.id)) {
      sheet.deleteRow(i + 1);
      return i + 1;
    }
  }
  return 0;
}

function _getSheet(name, headers, isMain) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var s  = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(headers);
    var r = s.getRange(1, 1, 1, headers.length);
    r.setBackground('#4F6BFF').setFontColor('#FFFFFF').setFontWeight('bold');
    s.setFrozenRows(1);
    for (var i = 1; i <= headers.length; i++) s.autoResizeColumn(i);
    if (isMain) {
      s.getRange(1,2).setBackground('#7B5EA7');
      s.getRange(1,9).setBackground('#2DD4BF').setFontColor('#04051A');
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Bài Luận','Học Viên','Ebook'],true).build();
      s.getRange(2, 2, 1000, 1).setDataValidation(rule);
    }
  }
  return s;
}

function ok(obj) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
