const { verifyOTP } = require('../_lib/otp');
const { signToken }  = require('../_lib/jwt');
const { checkCourseAccess } = require('../_lib/gas');

module.exports = async (req, res) => {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp } = req.body || {};
  if (!email || !otp)
    return res.status(400).json({ error: 'Thiếu email hoặc mã OTP' });

  // 1. Kiểm tra OTP
  if (!verifyOTP(email, otp))
    return res.status(401).json({ error: 'Mã OTP không đúng hoặc đã hết hạn' });

  // 2. Kiểm tra quyền truy cập khoá học qua GAS
  const activated = await checkCourseAccess(email);
  if (!activated)
    return res.status(403).json({ error: 'Email này chưa đăng ký hoặc chưa hoàn tất thanh toán khoá học.' });

  // 3. Cấp JWT
  const token = signToken({ email: email.toLowerCase() });
  res.json({ success: true, token });
};
