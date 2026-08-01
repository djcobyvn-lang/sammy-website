const { kv } = require('@vercel/kv');
const { isAdmin, checkAdminSecret } = require('../_lib/admin');
const { sendEbookDeliveryEmail, sendEbookHanhTrinhEmail, sendBookingConfirmEmail, sendStudentActivatedEmail } = require('../_lib/mailer');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Vá 2026-07-14: bỏ secret mặc định hard-code; nhận x-admin-secret (env) HOẶC JWT admin
  if (!checkAdminSecret(req) && !isAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email, orderId, customerName, ebookType } = req.body;
  if (!email) return res.status(400).json({ error: 'Thiếu email' });

  try {
    let order = null;
    if (orderId) {
      order = await kv.get(`order:${orderId}`);
      if (order) {
        await kv.set(`order:${orderId}`, {
          ...order,
          status: 'completed',
          completedAt: new Date().toISOString(),
          completedBy: 'admin-manual'
        });
      }
    }

    const name = customerName || (order && order.customerName) || 'bạn';

    // 2026-08-01 — BẬT TAY: bật cờ trong KV + gửi mail hướng dẫn OTP.
    // Lưới an toàn cho các ca đường tự động không nổ: khách trả thiếu tiền (webhook chặn khi
    // amount < 3.868.000), gõ sai nội dung CK nên không có mã HV####, hoặc SePay không bắn.
    // 2026-08-02 — Bộ 35 PDF TÁCH RA thành tùy chọn: chỉ gửi khi body có sendEbook:true
    // (ô tick trong admin) hoặc khi bấm nút gửi riêng (nhánh mặc định ở cuối hàm).
    if (ebookType === 'kich-hoat-full') {
      const { activateAndNotify } = require('../_lib/student');
      const sendEbook = req.body.sendEbook === true || req.body.sendEbook === 'true';
      const r = await activateAndNotify({
        email, fullName: name === 'bạn' ? '' : name,
        zalo: req.body.zalo || (order && order.zalo) || '',
        source: 'admin', force: true, sendEbook
      });
      if (!r.ok) return res.status(400).json({ error: r.reason || 'Kích hoạt thất bại' });
      if (r.skipped === 'locked') {
        return res.json({ success: true, message: `${email} đang được kích hoạt bởi một tiến trình khác (webhook vừa chạy) — chờ ~10 giây rồi kiểm tra hộp thư khách.` });
      }
      const ebookPart = !sendEbook
        ? 'không kèm bộ 35 PDF, '
        : (r.withEbook ? 'đã gửi 35 PDF + ' : 'KHÔNG gửi được 35 PDF, ');
      return res.json({
        success: true,
        message: `Đã kích hoạt ${email}${r.created ? ' (tạo mới bản ghi học viên)' : ''} — ` + ebookPart +
                 `${r.mailed ? 'đã gửi mail hướng dẫn đăng nhập OTP' : 'CHƯA gửi được mail hướng dẫn'}`
      });
    } else if (ebookType === 'kich-hoat-hoc-vien') {
      // Chỉ gửi mail, KHÔNG đụng cờ trong KV (giữ cho các script cũ của Sơn)
      await sendStudentActivatedEmail({ email, customerName: name, withEbook: !!req.body.withEbook });
      return res.json({ success: true, message: `Email kích hoạt học viên đã gửi tới ${email}` });
    } else if (ebookType === 'hanh-trinh') {
      await sendEbookHanhTrinhEmail({ email, customerName: name });
      return res.json({ success: true, message: `Ebook Hành Trình đã gửi tới ${email}` });
    } else if (ebookType === 'booking') {
      const pkgName = (order && order.packageName) || req.body.packageName || 'Gói Đặc Biệt';
      const price   = (order && order.price)       || req.body.price       || 0;
      const zalo    = (order && order.zalo)         || req.body.zalo        || '';
      await sendBookingConfirmEmail({ email, customerName: name, packageName: pkgName, price, zalo });
      return res.json({ success: true, message: `Email xác nhận đặt bài đã gửi tới ${email}` });
    } else {
      // Nút "Chỉ gửi bộ 35 PDF" trong admin cũng đi vào đây (ebookType='tsh'):
      // chỉ gửi tài liệu, KHÔNG đụng cờ paid/activated của học viên.
      await sendEbookDeliveryEmail({ email, customerName: name });
      return res.json({ success: true, message: `Bộ 35 PDF Thần Số Học đã gửi tới ${email}` });
    }
  } catch (err) {
    console.error('[deliver-ebook]', err);
    return res.status(500).json({ error: err.message });
  }
};
