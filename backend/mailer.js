const nodemailer = require('nodemailer');

// Cấu hình email — điền thông tin khi deploy
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

async function sendActivationEmail(student) {
  const { fullName, email, password } = student;
  const loginUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/hoc-vien-dang-nhap.html`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#04051A;color:#E8E8F0;padding:40px;border-radius:16px;">
      <h2 style="color:#E8C56A;font-size:1.6rem;margin-bottom:8px;">Chào mừng ${fullName}!</h2>
      <p style="color:#9898B8;margin-bottom:24px;">Thanh toán của bạn đã được xác nhận. Khóa học <strong style="color:#E8E8F0;">Thần Số Học 3 Gốc</strong> đã được kích hoạt.</p>

      <div style="background:#0D1240;border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:.85rem;color:#9898B8;text-transform:uppercase;letter-spacing:.1em;">Thông tin đăng nhập</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> ${email}</p>
        <p style="margin:0;"><strong>Mật khẩu tạm:</strong> <code style="background:#04051A;padding:2px 8px;border-radius:6px;color:#E8C56A;">${password}</code></p>
      </div>

      <p style="color:#9898B8;margin-bottom:20px;font-size:.9rem;">Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.</p>

      <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#92680a,#E8C56A);color:#0D0A00;font-weight:700;padding:14px 32px;border-radius:100px;text-decoration:none;">Vào Học Ngay →</a>

      <p style="margin-top:32px;font-size:.8rem;color:#9898B8;">Nếu cần hỗ trợ, liên hệ Zalo: <strong>0972 624 729</strong></p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from:    `"Sammy Trương" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: '🎓 Khóa Học 3 Gốc — Tài Khoản Đã Được Kích Hoạt',
      html
    });
    console.log('[Mailer] Đã gửi email kích hoạt tới:', email);
  } catch (err) {
    console.error('[Mailer Error]', err.message);
  }
}

async function sendOTPEmail(student, otp) {
  const { fullName, email } = student;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#04051A;color:#E8E8F0;padding:40px;border-radius:16px;">
      <h2 style="color:#A78BFA;font-size:1.3rem;margin-bottom:8px;">Mã Đăng Nhập Của Bạn</h2>
      <p style="color:#9898B8;margin-bottom:28px;">Xin chào <strong style="color:#E8E8F0;">${fullName}</strong>, đây là mã đăng nhập vào Cổng Học Viên.</p>
      <div style="background:#0D1240;border:2px solid rgba(167,139,250,0.35);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
        <p style="font-size:.75rem;color:#9898B8;text-transform:uppercase;letter-spacing:.15em;margin-bottom:12px;">Mã OTP của bạn</p>
        <div style="font-size:3rem;font-weight:700;letter-spacing:.35em;color:#A78BFA;font-family:monospace;">${otp}</div>
        <p style="font-size:.78rem;color:#9898B8;margin-top:12px;margin-bottom:0;">Mã có hiệu lực trong <strong style="color:#E8E8F0;">10 phút</strong></p>
      </div>
      <p style="font-size:.83rem;color:#9898B8;line-height:1.7;">Nếu bạn không yêu cầu mã này, hãy bỏ qua email. Liên hệ hỗ trợ: Zalo <strong>0972 624 729</strong></p>
    </div>
  `;
  try {
    await transporter.sendMail({
      from:    `"Sammy Trương" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: `${otp} — Mã đăng nhập Cổng Học Viên`,
      html
    });
    console.log('[Mailer] Đã gửi OTP tới:', email);
  } catch (err) {
    console.error('[Mailer OTP Error]', err.message);
  }
}

async function sendPaymentConfirmEmail(order) {
  const { customerName, email, packageName, price } = order;
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#04051A;color:#E8E8F0;padding:40px;border-radius:16px;">
      <h2 style="color:#2DD4BF;font-size:1.5rem;margin-bottom:8px;">✓ Thanh toán thành công!</h2>
      <p style="color:#9898B8;margin-bottom:24px;">Xin chào <strong style="color:#E8E8F0;">${customerName}</strong>, hệ thống đã xác nhận thanh toán của bạn.</p>
      <div style="background:#0D1240;border:1px solid rgba(45,212,191,0.3);border-radius:12px;padding:24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:.85rem;color:#9898B8;text-transform:uppercase;letter-spacing:.1em;">Chi tiết đơn hàng</p>
        <p style="margin:0 0 6px;"><strong>Gói dịch vụ:</strong> ${packageName}</p>
        <p style="margin:0 0 6px;"><strong>Số tiền:</strong> ${Number(price).toLocaleString('vi-VN')} VNĐ</p>
        <p style="margin:0;color:#2DD4BF;font-weight:600;">Trạng thái: Đã thanh toán ✓</p>
      </div>
      <p style="color:#9898B8;font-size:.9rem;line-height:1.7;">Sammy sẽ liên hệ với bạn trong vòng <strong style="color:#E8E8F0;">24 giờ</strong> để sắp xếp lịch luận giải.</p>
      <p style="margin-top:24px;font-size:.8rem;color:#9898B8;">Câu hỏi? Liên hệ Zalo: <strong>0362676159</strong></p>
    </div>
  `;
  try {
    await transporter.sendMail({
      from:    `"Sammy Trương" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: `✓ Xác nhận thanh toán — ${packageName}`,
      html
    });
    console.log('[Mailer] Gửi xác nhận thanh toán tới:', email);
  } catch (err) {
    console.error('[Mailer Error]', err.message);
  }
}

module.exports = { sendActivationEmail, sendOTPEmail, sendPaymentConfirmEmail };
