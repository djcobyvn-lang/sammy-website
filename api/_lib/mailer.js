const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const FROM = `"Sammy Trương" <${process.env.EMAIL_USER}>`;
const ZALO = '0362676159';

async function sendOTPEmail(email, otp) {
  await transporter.sendMail({
    from: FROM, to: email,
    subject: `${otp} — Mã đăng nhập Cổng Học Viên`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#04051A;color:#E8E8F0;padding:40px;border-radius:16px;">
        <h2 style="color:#A78BFA;font-size:1.3rem;margin-bottom:8px;">Mã Đăng Nhập Của Bạn</h2>
        <p style="color:#9898B8;margin-bottom:28px;">Nhập mã bên dưới để truy cập Cổng Học Viên.</p>
        <div style="background:#0D1240;border:2px solid rgba(167,139,250,0.35);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
          <p style="font-size:.75rem;color:#9898B8;text-transform:uppercase;letter-spacing:.15em;margin-bottom:12px;">Mã OTP</p>
          <div style="font-size:3rem;font-weight:700;letter-spacing:.35em;color:#A78BFA;font-family:monospace;">${otp}</div>
          <p style="font-size:.78rem;color:#9898B8;margin-top:12px;margin-bottom:0;">Có hiệu lực trong <strong style="color:#E8E8F0;">10 phút</strong></p>
        </div>
        <p style="font-size:.8rem;color:#9898B8;">Hỗ trợ: Zalo <strong>${ZALO}</strong></p>
      </div>`
  });
}

async function sendPaymentConfirmEmail({ customerName, email, packageName, price }) {
  await transporter.sendMail({
    from: FROM, to: email,
    subject: `✓ Xác nhận thanh toán — ${packageName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#04051A;color:#E8E8F0;padding:40px;border-radius:16px;">
        <h2 style="color:#2DD4BF;font-size:1.5rem;margin-bottom:8px;">✓ Thanh toán thành công!</h2>
        <p style="color:#9898B8;margin-bottom:24px;">Xin chào <strong style="color:#E8E8F0;">${customerName}</strong>, hệ thống đã xác nhận thanh toán của bạn.</p>
        <div style="background:#0D1240;border:1px solid rgba(45,212,191,0.3);border-radius:12px;padding:24px;margin-bottom:24px;">
          <p style="margin:0 0 6px;"><strong>Gói:</strong> ${packageName}</p>
          <p style="margin:0 0 6px;"><strong>Số tiền:</strong> ${Number(price).toLocaleString('vi-VN')} VNĐ</p>
          <p style="margin:0;color:#2DD4BF;font-weight:600;">Trạng thái: Đã thanh toán ✓</p>
        </div>
        <p style="color:#9898B8;font-size:.9rem;">Sammy sẽ liên hệ trong vòng <strong style="color:#E8E8F0;">24 giờ</strong>.</p>
        <p style="margin-top:24px;font-size:.8rem;color:#9898B8;">Zalo: <strong>${ZALO}</strong></p>
      </div>`
  });
}

async function sendActivationEmail({ fullName, email }) {
  const loginUrl = `${process.env.SITE_URL || ''}/hoc-vien-dang-nhap.html`;
  await transporter.sendMail({
    from: FROM, to: email,
    subject: '🎓 Khóa Học 3 Gốc — Tài Khoản Đã Được Kích Hoạt',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#04051A;color:#E8E8F0;padding:40px;border-radius:16px;">
        <h2 style="color:#E8C56A;font-size:1.6rem;margin-bottom:8px;">Chào mừng ${fullName}!</h2>
        <p style="color:#9898B8;margin-bottom:24px;">Khóa học <strong style="color:#E8E8F0;">Thần Số Học 3 Gốc</strong> đã được kích hoạt.</p>
        <p style="color:#9898B8;margin-bottom:20px;">Đăng nhập bằng email và mã OTP tại trang học viên.</p>
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#92680a,#E8C56A);color:#0D0A00;font-weight:700;padding:14px 32px;border-radius:100px;text-decoration:none;">Vào Học Ngay →</a>
        <p style="margin-top:32px;font-size:.8rem;color:#9898B8;">Hỗ trợ: Zalo <strong>${ZALO}</strong></p>
      </div>`
  });
}

// ─── EBOOK ───────────────────────────────────────────────
// Thay EBOOK_DOWNLOAD_LINK bằng link Bunny CDN thực tế khi có
const EBOOK_LINK = process.env.EBOOK_LINK || 'https://sammytruong.com/ebook.html';

async function sendEbookEmail({ email, name }) {
  await transporter.sendMail({
    from: FROM, to: email,
    subject: '📖 Ebook Hành Trình Tiến Hóa Tối Thượng — Link Tải Của Bạn',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0a0800;color:#F0EAD6;padding:40px;border-radius:16px;">
        <h2 style="color:#E8C56A;font-size:1.5rem;margin-bottom:8px;">Cảm ơn bạn đã tin tưởng! 📖</h2>
        <p style="color:#9A8B6E;margin-bottom:24px;">Xin chào <strong style="color:#F0EAD6;">${name || 'bạn'}</strong>, ebook của bạn đã sẵn sàng để tải về.</p>
        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.28);border-radius:14px;padding:24px;text-align:center;margin-bottom:24px;">
          <p style="font-size:.85rem;color:#9A8B6E;margin-bottom:16px;">Bấm nút bên dưới để tải ebook:</p>
          <a href="${EBOOK_LINK}" style="display:inline-block;background:linear-gradient(135deg,#92600a,#E8C56A,#FCD34D);color:#1a0e00;font-weight:700;padding:14px 32px;border-radius:100px;text-decoration:none;font-size:1rem;">📥 Tải Ebook Ngay</a>
          <p style="font-size:.75rem;color:#9A8B6E;margin-top:12px;">Link có hiệu lực vĩnh viễn — lưu email này để truy cập lại.</p>
        </div>
        <p style="color:#9A8B6E;font-size:.85rem;line-height:1.7;">Nếu gặp vấn đề khi tải, liên hệ Zalo <strong style="color:#F0EAD6;">${ZALO}</strong> để được hỗ trợ.</p>
        <p style="margin-top:24px;font-size:.78rem;color:#9A8B6E;">Sammy Trương · Thần Số Học Chữa Lành</p>
      </div>`
  });
}

// ─── EBOOK TSH ───────────────────────────────────────────
const EBOOK_TSH_LINK = process.env.EBOOK_TSH_LINK || 'https://ebookzone.b-cdn.net/FULL%20T%C3%80I%20LI%E1%BB%86U%20C%C3%94NG%20TH%E1%BB%A8C%20%2B%20%C3%9D%20NGH%C4%A8A%20TSH%20-%20%20SAMMY%20TR%C6%AF%C6%A0NG.rar';

async function sendEbookTshEmail({ email, name }) {
  await transporter.sendMail({
    from: FROM, to: email,
    subject: '📚 Bộ Tài Liệu Công Thức Tính & Ý Nghĩa Các Chỉ Số — Link Tải Của Bạn',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#04020F;color:#EDE9FF;padding:40px;border-radius:16px;">
        <h2 style="background:linear-gradient(135deg,#C4B5FD,#A78BFA,#5EEAD4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-size:1.5rem;margin-bottom:8px;">Cảm ơn bạn đã tin tưởng! 📚</h2>
        <p style="color:#8B82B0;margin-bottom:24px;">Xin chào <strong style="color:#EDE9FF;">${name || 'bạn'}</strong>, bộ tài liệu của bạn đã sẵn sàng để tải về.</p>
        <div style="background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.28);border-radius:14px;padding:28px;text-align:center;margin-bottom:24px;">
          <p style="font-size:.88rem;color:#8B82B0;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;">Bộ Tài Liệu Của Bạn</p>
          <p style="font-size:1rem;color:#EDE9FF;font-weight:700;margin-bottom:20px;">Công Thức Tính & Ý Nghĩa Các Chỉ Số Thần Số Học</p>
          <a href="${EBOOK_TSH_LINK}" style="display:inline-block;background:linear-gradient(135deg,#5B3FA0,#A78BFA,#2DD4BF);color:#fff;font-weight:700;padding:14px 32px;border-radius:100px;text-decoration:none;font-size:1rem;">📥 Tải Bộ Tài Liệu Ngay</a>
          <p style="font-size:.75rem;color:#8B82B0;margin-top:14px;">File định dạng <strong style="color:#EDE9FF;">.RAR</strong> — giải nén để nhận toàn bộ 25+ tài liệu PDF.<br>Link có hiệu lực vĩnh viễn — lưu email này để truy cập lại.</p>
        </div>
        <div style="background:rgba(45,212,191,0.07);border:1px solid rgba(45,212,191,0.22);border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="font-size:.83rem;color:#8B82B0;line-height:1.75;margin:0;">
            ✦ Bộ tài liệu gồm <strong style="color:#EDE9FF;">25+ file PDF</strong> — mỗi chỉ số một file riêng biệt.<br>
            ✦ Bao gồm bảng công thức tổng hợp để tra cứu nhanh.<br>
            ✦ Nếu gặp vấn đề khi tải, liên hệ Zalo <strong style="color:#EDE9FF;">${ZALO}</strong>.
          </p>
        </div>
        <p style="margin-top:24px;font-size:.78rem;color:#8B82B0;">Sammy Trương · Thần Số Học Pythagoras</p>
      </div>`
  });
}

// ─── KHÓA HỌC CHUYÊN SÂU ─────────────────────────────────
// Thay ZALO_GROUP_LINK bằng link nhóm Zalo thực tế khi có
const ZALO_GROUP_LINK = process.env.ZALO_GROUP_LINK || 'https://zalo.me/0362676159';

async function sendAdvancedCourseEmail({ email, name }) {
  await transporter.sendMail({
    from: FROM, to: email,
    subject: '🎓 Chào Mừng Bạn Tham Gia Khóa Học Thần Số Chuyên Sâu!',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#03030C;color:#E8E8F0;padding:40px;border-radius:16px;">
        <h2 style="color:#FB7185;font-size:1.5rem;margin-bottom:8px;">Chào mừng ${name || 'bạn'}! 🔥</h2>
        <p style="color:#9898B8;margin-bottom:24px;">Đăng ký <strong style="color:#E8E8F0;">Khóa Học Thần Số Chuyên Sâu</strong> của bạn đã được xác nhận thành công.</p>
        <div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.28);border-radius:14px;padding:24px;text-align:center;margin-bottom:24px;">
          <p style="font-size:.85rem;color:#9898B8;margin-bottom:16px;">Tham gia nhóm Zalo học viên để nhận lịch khai giảng và tài liệu chuẩn bị:</p>
          <a href="${ZALO_GROUP_LINK}" style="display:inline-block;background:linear-gradient(135deg,#be123c,#F43F5E,#f97316);color:#fff;font-weight:700;padding:14px 32px;border-radius:100px;text-decoration:none;font-size:1rem;">💬 Vào Nhóm Zalo Ngay</a>
          <p style="font-size:.75rem;color:#9898B8;margin-top:12px;">Khai giảng Tháng 6 · 2026</p>
        </div>
        <p style="color:#9898B8;font-size:.85rem;line-height:1.7;">Sammy sẽ liên hệ trực tiếp để xác nhận lịch học. Mọi thắc mắc: Zalo <strong style="color:#E8E8F0;">${ZALO}</strong></p>
      </div>`
  });
}

// ─── TAROT ────────────────────────────────────────────────
async function sendTarotConfirmEmail({ email, name }) {
  await transporter.sendMail({
    from: FROM, to: email,
    subject: '🔮 Xác Nhận Đặt Trải Bài Tarot — Sammy Trương',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#03030C;color:#E8E8F0;padding:40px;border-radius:16px;">
        <h2 style="color:#C084FC;font-size:1.5rem;margin-bottom:8px;">🔮 Đặt Bài Thành Công!</h2>
        <p style="color:#9898B8;margin-bottom:24px;">Xin chào <strong style="color:#E8E8F0;">${name || 'bạn'}</strong>, thanh toán trải bài Tarot của bạn đã được xác nhận.</p>
        <div style="background:rgba(192,132,252,0.08);border:1px solid rgba(192,132,252,0.25);border-radius:14px;padding:24px;margin-bottom:24px;">
          <p style="font-size:.88rem;color:#9898B8;line-height:1.75;">✦ Sammy sẽ trực tiếp trải bài theo câu hỏi của bạn.<br>✦ Video kết quả sẽ được gửi qua email trong vòng <strong style="color:#E8E8F0;">3–5 ngày làm việc</strong>.<br>✦ Kiểm tra cả mục Spam / Quảng cáo.</p>
        </div>
        <p style="color:#9898B8;font-size:.85rem;">Hỗ trợ: Zalo <strong style="color:#E8E8F0;">${ZALO}</strong></p>
      </div>`
  });
}

module.exports = { sendOTPEmail, sendPaymentConfirmEmail, sendActivationEmail, sendEbookEmail, sendEbookTshEmail, sendAdvancedCourseEmail, sendTarotConfirmEmail };
