const { gasCall }                                      = require('../_lib/gas');
const { sendPaymentConfirmEmail, sendActivationEmail } = require('../_lib/mailer');
const { kvSet }                                        = require('../_lib/kv');

const SEPAY_APIKEY = process.env.SEPAY_APIKEY || '';

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
  // XỬ LÝ TRƯỚC — gửi response SAU
  // (Vercel có thể kill function ngay sau res.json nếu gọi quá sớm)
  try {
    await processWebhook(req);
  } catch(e) {
    console.error('[Webhook] Uncaught error:', e.message);
  }
  // Gửi 200 về SePay sau khi xử lý xong
  res.json({ received: true });
};

async function processWebhook(req) {
  if (req.method !== 'POST') return;

  // Log env vars để debug
  console.log('[ENV] KV_URL:', process.env.KV_REST_API_URL ? 'SET' : 'NOT SET');
  console.log('[ENV] SEPAY_KEY:', process.env.SEPAY_APIKEY ? 'SET' : 'NOT SET');

  // Auth check
  const authRaw     = (req.headers['authorization'] || '').trim();
  const receivedKey = authRaw.replace(/^(Bearer|Apikey)\s+/i, '').trim();
  console.log('[SePay] Auth:', authRaw ? authRaw.substring(0, 12) + '...' : '(none)');
  if (SEPAY_APIKEY && receivedKey && receivedKey !== SEPAY_APIKEY) {
    console.warn('[SePay] API key mismatch — bỏ qua check để debug');
  }

  const d = req.body || {};
  console.log('[SePay] Body:', JSON.stringify(d).substring(0, 300));

  if (d.transferType !== 'in') {
    console.log('[SePay] Skip: not incoming transfer, type=', d.transferType);
    return;
  }

  const amount      = Number(d.transferAmount) || 0;
  const contentRaw  = (d.content || '').toUpperCase();
  const contentNorm = contentRaw.replace(/[^A-Z0-9]/g, '');
  console.log('[SePay] amount=', amount, 'content=', contentNorm);

  // CASE 1: Khóa học
  const hvMatch = contentRaw.match(/HV(\d{4})/);
  if (hvMatch) {
    console.log('[SePay] → Khóa học HV:', hvMatch[1]);
    if (amount < 2868000) { console.warn('[SePay] Thiếu tiền KH:', amount); return; }
    await kvSet('paid:khoa-hoc-3-goc', '1', 86400);
    console.log('[SePay] ✓ KV khoa-hoc set');
    const emailMatch = (d.content || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0].toLowerCase() : null;
    if (email) {
      await gasCall({ formType: 'activate-course', email, status: 'Đã Thanh Toán ✓' }).catch(console.warn);
      await sendActivationEmail({ fullName: email, email }).catch(console.warn);
    }
    return;
  }

  // CASE 2: Luận giải
  let matchedCode = null, matchedPkg = null;
  for (const [code, info] of Object.entries(PKG_CODES)) {
    if (contentNorm.includes(code.replace(/[^A-Z0-9]/g, ''))) {
      matchedCode = code; matchedPkg = info; break;
    }
  }

  if (!matchedPkg) {
    console.warn('[SePay] Không match mã gói. norm=', contentNorm);
    return;
  }

  console.log('[SePay] → Gói:', matchedCode, 'amount=', amount, 'price=', matchedPkg.price);

  if (amount < matchedPkg.price) {
    console.warn('[SePay] Thiếu tiền:', amount, '<', matchedPkg.price);
    return;
  }

  // KV — lưu flag để browser detect
  console.log('[KV] Setting paid:', matchedPkg.id);
  const kvOk = await kvSet(`paid:${matchedPkg.id}`, '1', 86400);
  console.log('[KV] Result:', kvOk);

  // GAS — best effort
  gasCall({ formType: 'update-status', pkgId: matchedPkg.id, status: 'Đã Thanh Toán ✓' })
    .then(r => console.log('[GAS]', JSON.stringify(r)))
    .catch(e => console.warn('[GAS] failed:', e.message));

  console.log('[SePay] ✓ Done:', matchedCode, amount + 'đ');
}

function extractName(content, suffix) {
  const idx = content.toUpperCase().indexOf(suffix.toUpperCase());
  if (idx === -1) return content.trim();
  return content.slice(0, idx).trim();
}
