const { gasCall }                                          = require('../_lib/gas');
const { sendPaymentConfirmEmail, sendActivationEmail }     = require('../_lib/mailer');

const SEPAY_APIKEY = process.env.SEPAY_APIKEY || '';

// Mã gói luận giải (khớp trong nội dung CK)
const PKG_CODES = {
  'CO-BAN':    { id: 'co-ban',               price: 500000  },
  'NANG-CAO':  { id: 'nang-cao',             price: 1000000 },
  'DAC-BIET':  { id: 'dac-biet',             price: 2000000 },
  'ME-BE-NC':  { id: 'me-be-nang-cao',       price: 1500000 },
  'ME-BE-DB':  { id: 'me-be-dac-biet',       price: 3000000 },
  '2NS-NC':    { id: '2-ngay-sinh-nang-cao', price: 1500000 },
  '2NS-DB':    { id: '2-ngay-sinh-dac-biet', price: 3000000 },
  'TRUC-TIEP': { id: 'truc-tiep-11',         price: 3000000 }
};

module.exports = async (req, res) => {
  res.json({ received: true }); // Trả 200 ngay để SePay không retry

  if (req.method !== 'POST') return;

  // Xác thực API key (chỉ check khi SePay gửi header)
  const authHeader = (req.headers['authorization'] || '').replace('Apikey ', '').trim();
  if (SEPAY_APIKEY && authHeader && authHeader !== SEPAY_APIKEY) {
    console.warn('[SePay] API key không hợp lệ');
    return;
  }

  const d = req.body || {};
  console.log('[SePay Webhook]', JSON.stringify(d));

  if (d.transferType !== 'in') return;

  const amount  = Number(d.transferAmount) || 0;
  const content = (d.content || '').toUpperCase();

  // ──────────────────────────────────────────────
  // CASE 1: KHÓA HỌC — nội dung có "HV" + 4 số
  // ──────────────────────────────────────────────
  const hvMatch = content.match(/HV(\d{4})/);
  if (hvMatch) {
    console.log('[SePay] → Khóa học, mã HV:', hvMatch[1]);

    if (amount < 2868000) {
      console.warn('[SePay] Thiếu tiền khóa học:', amount);
      return;
    }

    // Trích xuất email từ nội dung (nếu khách ghi email trong CK)
    const emailMatch = (d.content || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0].toLowerCase() : null;

    // Cập nhật GAS: kích hoạt học viên theo email
    if (email) {
      await gasCall({ formType: 'activate-course', email, status: 'Đã Thanh Toán ✓' });
    } else {
      // Nếu không có email trong CK, update theo mã HV trong nội dung
      await gasCall({ formType: 'update-khoa-hoc-by-hv', hvCode: hvMatch[1], status: 'Đã Thanh Toán ✓' });
    }

    // Gửi email kích hoạt nếu biết email
    if (email) {
      const name = extractName(d.content || '', 'HV' + hvMatch[1]);
      await sendActivationEmail({ fullName: name || email, email }).catch(console.warn);
    }

    console.log('[SePay] ✓ Khóa học kích hoạt — HV' + hvMatch[1]);
    return;
  }

  // ──────────────────────────────────────────────
  // CASE 2: LUẬN GIẢI — nội dung có mã gói
  // ──────────────────────────────────────────────
  let matchedCode = null;
  let matchedPkg  = null;

  for (const [code, info] of Object.entries(PKG_CODES)) {
    if (content.includes(code)) {
      matchedCode = code;
      matchedPkg  = info;
      break;
    }
  }

  if (!matchedPkg) {
    console.warn('[SePay] Không tìm thấy mã gói trong nội dung:', content);
    return;
  }

  if (amount < matchedPkg.price) {
    console.warn(`[SePay] Thiếu tiền: ${amount} < ${matchedPkg.price}`);
    return;
  }

  console.log('[SePay] → Luận giải, gói:', matchedCode);

  // Cập nhật GAS: đánh dấu đã thanh toán
  await gasCall({ formType: 'update-status', pkgId: matchedPkg.id, status: 'Đã Thanh Toán ✓' });

  // Trích tên khách từ nội dung CK để gửi email
  const customerName = extractName(d.content || '', matchedCode);
  const customerEmail = null; // Không có email trong CK luận giải — sẽ lấy từ GAS sau

  // Gửi email xác nhận (nếu lấy được email)
  if (customerEmail) {
    await sendPaymentConfirmEmail({
      customerName, email: customerEmail,
      packageName: matchedPkg.id, price: matchedPkg.price
    }).catch(console.warn);
  }

  console.log(`[SePay] ✓ Luận giải — ${matchedCode} — ${amount.toLocaleString('vi-VN')}đ`);
};

// Trích tên khách từ nội dung CK (bỏ phần mã ở cuối)
function extractName(content, suffix) {
  const idx = content.toUpperCase().indexOf(suffix.toUpperCase());
  if (idx === -1) return content.trim();
  return content.slice(0, idx).trim();
}
