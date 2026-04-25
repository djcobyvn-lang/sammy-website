const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const { findStudent, createStudent } = require('../db');
const { generateOTP, saveOTP, verifyOTP: checkOTP } = require('../otp-store');
const { sendOTPEmail } = require('../mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'sammy-3goc-secret-2026';

// POST /api/auth/send-otp — Gửi mã OTP về email
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Thiếu email' });
    const student = findStudent(email);
    if (!student) return res.status(404).json({ error: 'Email này chưa đăng ký khóa học. Vui lòng kiểm tra lại hoặc đăng ký trước.' });
    if (!student.activated) return res.status(403).json({ error: 'Tài khoản chưa được kích hoạt. Vui lòng hoàn tất thanh toán.' });
    const otp = generateOTP();
    saveOTP(email, otp);
    await sendOTPEmail(student, otp);
    res.json({ success: true, message: 'Mã OTP đã được gửi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// POST /api/auth/verify-otp — Xác nhận OTP, trả về JWT
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Thiếu thông tin' });
    const result = checkOTP(email, otp);
    if (!result.valid) return res.status(401).json({ error: result.reason });
    const student = findStudent(email);
    const token = jwt.sign(
      { id: student.id, email: student.email, name: student.fullName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ success: true, token, name: student.fullName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// POST /api/auth/register — Học viên đăng ký (trước thanh toán)
router.post('/register', async (req, res) => {
  try {
    const { fullName, dob, email, zalo, goal } = req.body;
    if (!fullName || !email || !zalo) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }
    const existing = findStudent(email);
    if (existing) {
      return res.json({ success: true, message: 'Đã đăng ký trước đó', alreadyExists: true });
    }
    const student = createStudent({ fullName, dob, email, zalo, goal });
    return res.json({ success: true, studentId: student.id, message: 'Đăng ký thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// POST /api/auth/login — Học viên đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = findStudent(email);
    if (!student) return res.status(401).json({ error: 'Email không tồn tại' });
    if (!student.activated) return res.status(403).json({ error: 'Tài khoản chưa được kích hoạt. Vui lòng hoàn tất thanh toán.' });

    const valid = await bcrypt.compare(password, student.password);
    if (!valid) return res.status(401).json({ error: 'Mật khẩu không đúng' });

    const token = jwt.sign(
      { id: student.id, email: student.email, name: student.fullName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ success: true, token, name: student.fullName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// POST /api/auth/set-password — Đặt mật khẩu lần đầu sau kích hoạt
router.post('/set-password', async (req, res) => {
  try {
    const { email, tempPassword, newPassword } = req.body;
    const student = findStudent(email);
    if (!student) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

    // Kiểm tra temp password (plain text khi mới kích hoạt)
    if (student.password !== tempPassword && !(await bcrypt.compare(tempPassword, student.password))) {
      return res.status(401).json({ error: 'Mật khẩu tạm không đúng' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    setPassword(email, hashed);
    res.json({ success: true, message: 'Đặt mật khẩu thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Middleware xác thực token
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

module.exports = router;
module.exports.authMiddleware = authMiddleware;
