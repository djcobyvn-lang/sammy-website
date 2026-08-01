const { kv } = require('@vercel/kv');
const { findStudent, createStudent, activateStudentOTP } = require('./db');
const { sendStudentActivatedEmail, sendEbookDeliveryEmail } = require('./mailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ─────────────────────────────────────────────────────────────────────────────
   KÍCH HOẠT HỌC VIÊN KHÓA 3 GỐC — HÀM DÙNG CHUNG (2026-08-01)

   Vì sao phải là hàm chung: tiền về có thể đi vào MỘT TRONG HAI đường, và trước
   đây chỉ một đường có mã kích hoạt:
     (1) webhook.js  — SePay bắn khi tiền về (đường chính)
     (2) order.js    — khi webhook tới TRƯỚC lúc khách bấm "Tôi Đã Chuyển Khoản"
                       (nhánh payment-event-match) — đường này TRƯỚC GIỜ KHÔNG
                       hề kích hoạt học viên, chỉ gửi mail xác nhận chung chung.
   Nay cả hai đường + nút bật tay trong admin đều gọi đúng hàm này.

   Nguyên tắc:
   - KHÔNG sinh mật khẩu ngẫu nhiên. Cổng học viên đăng nhập bằng OTP
     (auth.js send-otp/verify-otp) nên tài khoản giữ password:null.
   - Chưa có bản ghi học viên thì TẠO MỚI từ dữ liệu đơn. Lệnh /api/auth/register
     ở trang khóa học có thể bị hủy giữa chừng, và khách trả tiền từ bảng giá /
     QR cũ / chuyển khoản tay thì chưa từng qua form đăng ký.
   - Quà 35 PDF là TÙY CHỌN (2026-08-02, Sơn chốt): mặc định sendEbook=false —
     KHÔNG phải học viên nào cũng nhận bộ này. Chỉ gửi khi bên gọi truyền
     sendEbook:true (admin tick ô "kèm bộ 35 PDF", hoặc bấm nút gửi riêng).
     Khi có gửi thì gửi ebook TRƯỚC, mail kích hoạt SAU, và chỉ bật khối
     "🎁 quà tặng" trong mail khi ebook đã đi thật — nếu không là mail nói sai.
   - Chống gửi trùng 2 lớp: khóa nx ngắn hạn + cờ activated đã bật thì không
     gửi lại mail (SePay bắn lại webhook, hoặc 2 đường trên cùng chạy).
   ───────────────────────────────────────────────────────────────────────────── */
async function activateAndNotify({ email, fullName, zalo, dob, goal, source = 'auto', force = false, sendEbook = false }) {
  const mail = String(email || '').toLowerCase().trim();
  if (!EMAIL_RE.test(mail)) {
    console.warn('[student/activate] Không có email hợp lệ — bỏ qua. source=', source);
    return { ok: false, reason: 'no-email' };
  }

  // Khóa chống chạy SONG SONG (webhook + order.js cùng bắn trong vài giây).
  // Chỉ giữ trong lúc chạy rồi NHẢ NGAY ở finally — nếu giữ tới hết hạn thì lượt bấm
  // "gửi lại mail" của admin ngay sau đó sẽ bị chặn im lặng. Việc chống gửi trùng ở
  // các lần sau do cờ activated đảm nhiệm, không phải khóa này.
  const lockKey = `student:activating:${mail}`;
  const lock = await kv.set(lockKey, source, { nx: true, ex: 300 }).catch(() => 'OK');
  if (!lock) {
    console.log('[student/activate]', mail, '— đang được kích hoạt bởi tiến trình khác, bỏ qua.');
    return { ok: true, skipped: 'locked' };
  }

  try {
    let student = await findStudent(mail);
    let created = false;
    if (!student) {
      student = await createStudent({
        fullName: fullName || 'Học viên',
        dob: dob || '',
        email: mail,
        zalo: zalo || '',
        goal: goal || ''
      });
      created = true;
      console.log('[student/activate] Tạo bản ghi học viên mới cho', mail, '(chưa từng qua form đăng ký)');
    }

    // Đã kích hoạt rồi → KHÔNG gửi lại mail (chống spam khi SePay bắn lại webhook).
    // force=true: admin chủ động bấm gửi lại (khách báo mất mail) — bỏ qua chốt này.
    if (student.activated && student.paid && !force) {
      console.log('[student/activate]', mail, '— đã kích hoạt trước đó, không gửi lại mail.');
      return { ok: true, already: true, created };
    }

    const updated = await activateStudentOTP(mail, { activatedBy: source });

    // Quà 35 PDF — TÙY CHỌN, mặc định KHÔNG gửi. Khi có gửi thì đi TRƯỚC, vì
    // thành công thì mail kích hoạt mới được nói "đã gửi ebook".
    let withEbook = false;
    if (sendEbook) {
      try {
        await sendEbookDeliveryEmail({ email: mail, customerName: updated.fullName || fullName || 'bạn' });
        withEbook = true;
      } catch (e) {
        console.error('[student/activate] Gửi bộ 35 PDF lỗi:', e.message);
      }
    }

    let mailed = false;
    try {
      await sendStudentActivatedEmail({
        email: mail,
        customerName: updated.fullName || fullName || 'bạn',
        withEbook
      });
      mailed = true;
    } catch (e) {
      console.error('[student/activate] Gửi mail kích hoạt lỗi:', e.message);
    }

    await kv.lpush('student:activated:log', JSON.stringify({
      email: mail, name: updated.fullName || fullName || '', source,
      created, sendEbook, withEbook, mailed, at: new Date().toISOString()
    })).then(() => kv.ltrim('student:activated:log', 0, 99)).catch(() => {});

    console.log('[student/activate] ĐÃ KÍCH HOẠT', mail, '| source=', source, '| ebook=', withEbook, '| mail=', mailed);
    return { ok: true, created, withEbook, mailed, student: updated };
  } catch (err) {
    console.error('[student/activate] Lỗi:', err.message);
    return { ok: false, reason: err.message };
  } finally {
    await kv.del(lockKey).catch(() => {});
  }
}

/* Tìm email của khách mua Khóa 3 Gốc theo thứ tự tin cậy giảm dần.
   Nguồn (2) là chỗ VÁ CHÍNH: trang thanh toán tự lưu orderinfo:HV#### ngay khi
   load (thanh-toan.html → /api/order?action=save-info, TTL 3 ngày), nên kể cả
   khách quét QR trả tiền rồi đóng tab — không bấm nút, không sinh đơn — ta vẫn
   biết email để kích hoạt. */
async function resolveStudentInfo({ order, payCode, content }) {
  if (order && EMAIL_RE.test(String(order.email || '').toLowerCase())) {
    return {
      email: order.email, fullName: order.customerName || '', zalo: order.zalo || '', from: 'order'
    };
  }
  if (payCode) {
    const info = await kv.get(`orderinfo:HV${payCode}`).catch(() => null);
    if (info && EMAIL_RE.test(String(info.email || '').toLowerCase())) {
      return { email: info.email, fullName: info.name || '', zalo: info.phone || '', from: 'orderinfo' };
    }
  }
  // Lưới cuối: khách tự gõ email vào nội dung chuyển khoản
  const m = String(content || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (m) return { email: m[0], fullName: '', zalo: '', from: 'content' };
  return null;
}

module.exports = { activateAndNotify, resolveStudentInfo };
