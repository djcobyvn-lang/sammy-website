const { gasCall }               = require('../_lib/gas');
const { sendPaymentConfirmEmail, sendActivationEmail } = require('../_lib/mailer');

const SEPAY_APIKEY = process.env.SEPAY_APIKEY || '';

const PKG_CODES = {
  'CO-BAN':    { id: 'co-ban',               price: 500000  },
  'NANG-CAO':  { id: 'nang-cao',             price: 1000000 },
  'DAC-BIET':  { id: 'dac-biet',             price: 2000000 },
  'ME-BE-NC':  { id: 'me-be-nang-cao',       price: 1500000 },
  'ME-BE-DB':  { id: 'me-be-dac-biet',       price: 3000000 },
  '2NS-NC':    { id: '2-ngay-sinh-nang-cao', price: 1500000 },
  '2NS-DB':    { id: '2-ngay-sinh-dac-biet', price: 3000000 },
  'TRUC-TIEP': { id: 'truc-tiep-11',         price: 3000000 },
  '3GOC':      { id: 'khoa-hoc-3-goc',       price: 2868000 }
};

module.exports = async (req, res) => {
  // Trả 200 ngay để SePay không retry
  res.json({ received: true });

  if (req.method !== 'POST') return;

  // Xác thực API key
  if (SEPAY_APIKEY) {
    const auth = (req.headers['authorization'] || '').replace('Apikey ', '').trim();
    if (auth !== SEPAY_APIKEY) {
      console.warn('[SePay] API key không hợp lệ');
      return;
    }
  }

  const d = req.body || {};
  console.log('[SePay]', JSON.stringify(d));

  if (d.transferType !== 'in') return;

  const content = (d.content || '').toUpperCase().replace(/\s+/g, '-');
  const amount  = Number(d.transferAmount) || 0;

  // Tìm mã gói trong nội dung chuyển khoản
  let pkg = null, pkgCode = null;
  for (const [code, info] of Object.entries(PKG_CODES)) {
    if (content.includes(code)) { pkgCode = code; pkg = info; break; }
  }
  if (!pkg) { console.warn('[SePay] Không tìm thấy mã gói:', content); return; }
  if (amount < pkg.price) { console.warn('[SePay] Thiếu tiền:', amount, '<', pkg.price); return; }

  // Cập nhật Google Sheets
  await gasCall({ formType: 'update-status', pkgId: pkg.id, status: 'Đã Thanh Toán ✓' });

  // Trích xuất email từ nội dung (nếu có)
  const emailMatch = (d.content || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0].toLowerCase() : null;

  // Kích hoạt khoá học
  if (pkgCode === '3GOC' && email) {
    await gasCall({ formType: 'activate-course', email, status: 'Đã Thanh Toán ✓' });
    await sendActivationEmail({ fullName: email, email }).catch(console.warn);
  }

  // Gửi email xác nhận cho luận giải
  if (email && pkgCode !== '3GOC') {
    await sendPaymentConfirmEmail({
      customerName: email,
      email,
      packageName: pkg.id,
      price: pkg.price
    }).catch(console.warn);
  }

  console.log(`[SePay] ✓ ${pkgCode} — ${amount.toLocaleString('vi-VN')}đ`);
};
