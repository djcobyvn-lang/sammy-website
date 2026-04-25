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

module.exports = { sendOTPEmail, sendPaymentConfirmEmail, sendActivationEmail };
