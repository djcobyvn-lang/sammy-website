const crypto = require('crypto');

const SECRET = process.env.OTP_SECRET || 'sammy-otp-secret-2026';
const WINDOW  = 10 * 60 * 1000; // 10 phút

// Tạo OTP từ email + time window — không cần lưu trữ
function generateOTP(email) {
  const period = Math.floor(Date.now() / WINDOW);
  return _compute(email, period);
}

// Kiểm tra OTP — chấp nhận window hiện tại và window trước
function verifyOTP(email, otp) {
  const period = Math.floor(Date.now() / WINDOW);
  return _compute(email, period) === otp ||
         _compute(email, period - 1) === otp;
}

function _compute(email, period) {
  const hash = crypto
    .createHmac('sha256', SECRET)
    .update(email.toLowerCase() + ':' + period)
    .digest('hex');
  return (parseInt(hash.slice(0, 8), 16) % 1000000)
    .toString()
    .padStart(6, '0');
}

module.exports = { generateOTP, verifyOTP };
