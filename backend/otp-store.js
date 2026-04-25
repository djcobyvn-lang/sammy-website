const fs   = require('fs');
const path = require('path');

const OTP_PATH = path.join(__dirname, 'data', 'otps.json');

function readOTPs() {
  if (!fs.existsSync(OTP_PATH)) {
    fs.mkdirSync(path.dirname(OTP_PATH), { recursive: true });
    fs.writeFileSync(OTP_PATH, '{}');
  }
  return JSON.parse(fs.readFileSync(OTP_PATH, 'utf8'));
}
function writeOTPs(data) { fs.writeFileSync(OTP_PATH, JSON.stringify(data, null, 2)); }

function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

function saveOTP(email, otp) {
  const store = readOTPs();
  store[email.toLowerCase()] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 }; // 10 phút
  writeOTPs(store);
  return otp;
}

function verifyOTP(email, otp) {
  const store = readOTPs();
  const record = store[email.toLowerCase()];
  if (!record) return { valid: false, reason: 'Chưa yêu cầu mã' };
  if (Date.now() > record.expiresAt) { delete store[email.toLowerCase()]; writeOTPs(store); return { valid: false, reason: 'Mã đã hết hạn (10 phút)' }; }
  if (record.otp !== otp) return { valid: false, reason: 'Mã không đúng' };
  delete store[email.toLowerCase()];
  writeOTPs(store);
  return { valid: true };
}

module.exports = { generateOTP, saveOTP, verifyOTP };
