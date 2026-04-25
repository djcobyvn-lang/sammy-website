const { generateOTP } = require('../_lib/otp');
const { sendOTPEmail } = require('../_lib/mailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Thiếu email' });

  try {
    const otp = generateOTP(email);
    await sendOTPEmail(email, otp);
    res.json({ success: true, message: 'Mã OTP đã được gửi vào email của bạn' });
  } catch (err) {
    console.error('[send-otp]', err.message);
    res.status(500).json({ error: 'Không gửi được email. Vui lòng thử lại.' });
  }
};
