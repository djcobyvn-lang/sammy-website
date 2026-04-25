const express  = require('express');
const https    = require('https');
const router   = express.Router();
const { findStudent, activateStudent } = require('../db');
const { sendActivationEmail, sendPaymentConfirmEmail } = require('../mailer');
const { findPendingOrder, completeOrder } = require('./order');

const GAS_URL      = process.env.GAS_URL      || 'https://script.google.com/macros/s/AKfycbwFi3Iq79XFFA9BBAUar9Ius727HeZncIHOVQdxMXczbpNRJ_TiBUgHnsI-YJDYnNl-ew/exec';
const SEPAY_APIKEY = process.env.SEPAY_APIKEY || '';

// Mapping: pkg.code (in transfer content) → { id, price }
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

// ─────────────────────────────────────────────
// POST /api/webhook/sepay
// SePay gọi endpoint này khi có giao dịch mới
// ─────────────────────────────────────────────
router.post('/sepay', async (req, res) => {
  // Trả 200 ngay để SePay không retry
  res.json({ received: true });

  try {
    // 1. Xác thực API key
    if (SEPAY_APIKEY) {
      const auth = (req.headers['authorization'] || '').replace('Apikey ', '').trim();
      if (auth !== SEPAY_APIKEY) {
        console.warn('[Webhook] API key không hợp lệ');
        return;
      }
    }

    const d = req.body;
    console.log('[SePay]', JSON.stringify(d));

    // 2. Chỉ xử lý tiền vào
    if (d.transferType !== 'in') return;

    const content = (d.content || '').toUpperCase().replace(/\s+/g, '-');
    const amount  = Number(d.transferAmount) || 0;

    // 3. Tìm mã gói trong nội dung chuyển khoản
    let pkgCode = null;
    let pkg     = null;
    for (const [code, info] of Object.entries(PKG_CODES)) {
      if (content.includes(code)) { pkgCode = code; pkg = info; break; }
    }

    if (!pkg) {
      console.warn('[Webhook] Không tìm thấy mã gói trong nội dung:', content);
      return;
    }

    console.log(`[Webhook] Gói: ${pkgCode} | Số tiền: ${amount} | Yêu cầu: ${pkg.price}`);

    // 4. Kiểm tra số tiền
    if (amount < pkg.price) {
      console.warn(`[Webhook] Thiếu tiền: ${amount} < ${pkg.price}`);
      return;
    }

    // 5. Tìm đơn hàng pending khớp
    const order = findPendingOrder(pkg.id);
    if (order) {
      completeOrder(order.id);
      await updateSheetStatus(order.email, pkg.id);
      await sendPaymentConfirmEmail(order);
      console.log(`[Webhook] ✓ Hoàn thành: ${order.customerName} — ${pkgCode}`);
    } else {
      // Không có đơn khớp nhưng tiền đã vào — vẫn ghi log
      console.warn(`[Webhook] Không tìm thấy đơn pending cho gói: ${pkg.id}`);
      await updateSheetStatusByPkg(pkg.id);
    }

    // 6. Nếu là khoá học → kích hoạt học viên
    if (pkgCode === '3GOC') {
      const rawContent = d.content || '';
      const emailMatch = rawContent.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        const email   = emailMatch[0].toLowerCase();
        const student = findStudent(email);
        if (student) {
          const activated = activateStudent(email);
          await sendActivationEmail(activated);
          console.log(`[Webhook] Kích hoạt học viên: ${email}`);
        }
      }
    }

  } catch (err) {
    console.error('[Webhook Error]', err.message);
  }
});

// ─────────────────────────────────────────────
// Cập nhật trạng thái trên Google Sheet
// ─────────────────────────────────────────────
async function updateSheetStatus(email, pkgId) {
  const payload = JSON.stringify({ formType: 'update-status', email, pkgId, status: 'Đã Thanh Toán ✓' });
  await gasGet(payload);
}

async function updateSheetStatusByPkg(pkgId) {
  const payload = JSON.stringify({ formType: 'update-status', pkgId, status: 'Đã Thanh Toán ✓' });
  await gasGet(payload);
}

function gasGet(payloadStr) {
  return new Promise((resolve) => {
    const url = GAS_URL + '?payload=' + encodeURIComponent(payloadStr);
    https.get(url, (res) => {
      res.resume();
      res.on('end', resolve);
    }).on('error', (e) => {
      console.warn('[GAS]', e.message);
      resolve();
    });
  });
}

module.exports = router;
