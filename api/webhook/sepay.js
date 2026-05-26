const { gasCall }                     = require('../_lib/gas');
const { kvSet, kvGet }                = require('../_lib/kv');
const {
  sendActivationEmail,
  sendAdvancedCourseEmail,
  sendEbookEmail,
  sendTarotConfirmEmail,
  sendPaymentConfirmEmail
} = require('../_lib/mailer');

const SEPAY_APIKEY = process.env.SEPAY_APIKEY || '';

// Luận giải packages — code chuẩn hoá (không có dấu gạch) + giá tối thiểu
const PKG_CODES = {
  'COBAN':      { id: 'co-ban',               price: 500000  },
  'NANGCAO':    { id: 'nang-cao',             price: 1000000 },
  'DACBIET':    { id: 'dac-biet',             price: 2000000 },
  'MEBEDB':     { id: 'me-be-dac-biet',       price: 3000000 },
  'MEBENC':     { id: 'me-be-nang-cao',       price: 1500000 },
  '2NSNC':      { id: '2-ngay-sinh-nang-cao', price: 1500000 },
  '2NSDB':      { id: '2-ngay-sinh-dac-biet', price: 2500000 },
  'TRUCTIEP':   { id: 'truc-tiep-11',         price: 3000000 }
};

module.exports = async (req, res) => {
  try { await processWebhook(req); } catch(e) { console.error('[Webhook] Error:', e.message); }
  res.json({ received: true });
};

async function processWebhook(req) {
  if (req.method !== 'POST') return;

  const authRaw     = (req.headers['authorization'] || '').trim();
  const receivedKey = authRaw.replace(/^(Bearer|Apikey)\s+/i, '').trim();
  if (SEPAY_APIKEY && receivedKey && receivedKey !== SEPAY_APIKEY) {
    console.warn('[SePay] Auth mismatch — tiếp tục để debug');
  }

  const d = req.body || {};
  if (d.transferType !== 'in') return;

  const amount      = Number(d.transferAmount) || 0;
  const contentRaw  = (d.content || '').toUpperCase();
  const contentNorm = contentRaw.replace(/[^A-Z0-9]/g, '');
  console.log('[SePay] amount=%d content=%s', amount, contentNorm);

  // ══════════════════════════════════════════════════════
  // CASE 1: KHÓA HỌC NỀN TẢNG — HV + 4 digits
  // ══════════════════════════════════════════════════════
  const hvMatch = contentRaw.match(/HV(\d{4})/);
  if (hvMatch) {
    if (amount < 2868000) { console.warn('[HV] Thiếu tiền:', amount); return; }
    const code = hvMatch[1];
    await kvSet('paid:khoa-hoc-3-goc', '1', 86400);
    console.log('[HV] ✓ paid:khoa-hoc-3-goc set');

    // Lấy thông tin khách từ KV
    const infoRaw = await kvGet(`info:HV${code}`);
    const info = safeParseJSON(infoRaw);
    if (info?.email) {
      await gasCall({ formType: 'activate-course', email: info.email, name: info.name, phone: info.phone, status: 'Đã Thanh Toán ✓' }).catch(console.warn);
      await sendActivationEmail({ fullName: info.name || info.email, email: info.email }).catch(console.warn);
      console.log('[HV] ✓ activation email →', info.email);
    } else {
      console.warn('[HV] Không có info trong KV cho code HV' + code);
    }
    return;
  }

  // ══════════════════════════════════════════════════════
  // CASE 2: EBOOK — EBOOK + 4 digits
  // ══════════════════════════════════════════════════════
  const ebookMatch = contentNorm.match(/^EBOOK(\d{4})/) || contentNorm.match(/EBOOK(\d{4})/);
  if (ebookMatch) {
    if (amount < 89000) { console.warn('[EBOOK] Thiếu tiền:', amount); return; }
    const code = ebookMatch[1];
    await kvSet(`paid:ebook-${code}`, '1', 86400);
    // Set chung để browser poll
    await kvSet('paid:ebook', '1', 86400);
    console.log('[EBOOK] ✓ paid:ebook set');

    const infoRaw = await kvGet(`info:EBOOK${code}`);
    const info = safeParseJSON(infoRaw);
    if (info?.email) {
      await sendEbookEmail({ email: info.email, name: info.name || '' }).catch(console.warn);
      await gasCall({ formType: 'ebook-order', email: info.email, name: info.name, phone: info.phone, status: 'Đã Thanh Toán ✓' }).catch(console.warn);
      console.log('[EBOOK] ✓ ebook email →', info.email);
    }
    return;
  }

  // ══════════════════════════════════════════════════════
  // CASE 3: KHÓA HỌC CHUYÊN SÂU — CHUYENSAU + 4 digits
  // ══════════════════════════════════════════════════════
  const csMatch = contentNorm.match(/CHUYENSAU(\d{4})/);
  if (csMatch) {
    if (amount < 6868000) { console.warn('[CS] Thiếu tiền:', amount); return; }
    const code = csMatch[1];
    await kvSet(`paid:khoa-hoc-chuyen-sau`, '1', 86400);
    console.log('[CS] ✓ paid:khoa-hoc-chuyen-sau set');

    const infoRaw = await kvGet(`info:CHUYENSAU${code}`);
    const info = safeParseJSON(infoRaw);
    if (info?.email) {
      await sendAdvancedCourseEmail({ email: info.email, name: info.name || '' }).catch(console.warn);
      await gasCall({ formType: 'advanced-course', email: info.email, name: info.name, status: 'Đã Thanh Toán ✓' }).catch(console.warn);
      console.log('[CS] ✓ advanced course email →', info.email);
    }
    return;
  }

  // ══════════════════════════════════════════════════════
  // CASE 4: ĐẶT TÊN NICKNAME — NICKNAME + 4 digits
  // ══════════════════════════════════════════════════════
  const nickMatch = contentNorm.match(/NICKNAME(\d{4})/);
  if (nickMatch) {
    if (amount < 500000) { console.warn('[NICKNAME] Thiếu tiền:', amount); return; }
    const code = nickMatch[1];
    await kvSet(`paid:nickname-${code}`, '1', 86400);
    console.log('[NICKNAME] ✓ paid set');

    const infoRaw = await kvGet(`info:NICKNAME${code}`);
    const info = safeParseJSON(infoRaw);
    if (info?.email) {
      // Gửi email xác nhận
      await sendPaymentConfirmEmail({
        customerName: info.name || info.email,
        email: info.email,
        packageName: 'Dịch Vụ Đặt Tên Nickname',
        price: amount
      }).catch(console.warn);
      // Ghi vào Sheets
      await gasCall({
        formType: 'save-article', // dùng tạm — hoặc tạo formType riêng sau
        id: `NICKNAME${code}`,
        title: `Đặt Tên Nickname — ${info.name}`,
        slug: `nickname-${code}`,
        category: 'Đặt Tên Nickname',
        date: new Date().toISOString().split('T')[0],
        excerpt: info.note || '',
        status: 'published'
      }).catch(console.warn);
      console.log('[NICKNAME] ✓ confirm email →', info.email);
    }
    return;
  }

  // ══════════════════════════════════════════════════════
  // CASE 5: TAROT — TAROT + 4 digits
  // ══════════════════════════════════════════════════════
  const tarotMatch = contentNorm.match(/TAROT(\d{4})/);
  if (tarotMatch) {
    if (amount < 500000) { console.warn('[TAROT] Thiếu tiền:', amount); return; }
    const code = tarotMatch[1];
    await kvSet(`paid:tarot-${code}`, '1', 86400);
    await kvSet('paid:tarot', '1', 86400);
    console.log('[TAROT] ✓ paid:tarot set');

    const infoRaw = await kvGet(`info:TAROT${code}`);
    const info = safeParseJSON(infoRaw);
    if (info?.email) {
      await sendTarotConfirmEmail({ email: info.email, name: info.name || '' }).catch(console.warn);
      await gasCall({ formType: 'tarot-order', email: info.email, name: info.name, question: info.question || '', status: 'Đã Thanh Toán ✓' }).catch(console.warn);
      console.log('[TAROT] ✓ tarot confirm email →', info.email);
    }
    return;
  }

  // ══════════════════════════════════════════════════════
  // CASE 5: LUẬN GIẢI — detect CODE + 4 digits suffix
  // ══════════════════════════════════════════════════════
  let matchedCode = null, matchedPkg = null, lgCode = null;
  for (const [code, info] of Object.entries(PKG_CODES)) {
    // Match: code followed by 4 digits (e.g. COBAN1234 or NANGCAO5678)
    const re = new RegExp(code + '(\\d{4})');
    const m  = contentNorm.match(re);
    if (m) { matchedCode = code; matchedPkg = info; lgCode = m[1]; break; }
    // Fallback: match without code suffix (backward compat)
    if (contentNorm.includes(code)) {
      matchedCode = code; matchedPkg = info; lgCode = '0000'; break;
    }
  }

  if (!matchedPkg) {
    console.warn('[SePay] Không match mã gói. norm=', contentNorm);
    return;
  }
  if (amount < matchedPkg.price) {
    console.warn('[Luận Giải] Thiếu tiền:', amount, '<', matchedPkg.price);
    return;
  }

  await kvSet(`paid:${matchedPkg.id}`, '1', 86400);
  console.log('[Luận Giải] ✓ paid:%s set', matchedPkg.id);

  // Lấy thông tin khách từ KV
  const lgInfoRaw = await kvGet(`info:${matchedCode}${lgCode}`);
  const lgInfo = safeParseJSON(lgInfoRaw);

  // GAS cập nhật sheet với thông tin khách đầy đủ
  gasCall({
    formType: 'update-status',
    pkgId: matchedPkg.id,
    email: lgInfo?.email || '',
    name:  lgInfo?.name  || '',
    phone: lgInfo?.phone || '',
    status: 'Đã Thanh Toán ✓'
  }).then(r => console.log('[GAS]', JSON.stringify(r)))
    .catch(e => console.warn('[GAS] failed:', e.message));

  // Gửi email xác nhận cho khách
  if (lgInfo?.email) {
    const pkgNameMap = {
      'co-ban':'Gói Cơ Bản','nang-cao':'Gói Nâng Cao','dac-biet':'Gói Đặc Biệt',
      'me-be-nang-cao':'Gói Mẹ & Bé — Nâng Cao','me-be-dac-biet':'Gói Mẹ & Bé — Đặc Biệt',
      '2-ngay-sinh-nang-cao':'Gói 2 Ngày Sinh — Nâng Cao','2-ngay-sinh-dac-biet':'Gói 2 Ngày Sinh — Đặc Biệt',
      'truc-tiep-11':'Gói Trực Tiếp 1:1'
    };
    sendPaymentConfirmEmail({
      customerName: lgInfo.name || lgInfo.email,
      email: lgInfo.email,
      packageName: pkgNameMap[matchedPkg.id] || matchedPkg.id,
      price: amount
    }).catch(e => console.warn('[Mail] luận giải:', e.message));
    console.log('[Luận Giải] ✓ confirm email →', lgInfo.email);
  }

  console.log('[Luận Giải] ✓ Done:', matchedCode, lgCode, amount + 'đ');
}

function safeParseJSON(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}
