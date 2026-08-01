const https = require('https');
const { kv } = require('@vercel/kv');
const { checkAdminSecret } = require('./_lib/admin');
const { activateAndNotify, resolveStudentInfo } = require('./_lib/student');
const { sendPaymentConfirmEmail, sendEbookDeliveryEmail, sendEbookHanhTrinhEmail, sendBookingConfirmEmail } = require('./_lib/mailer');

const BOOKING_PKGS = new Set([
  'co-ban','nang-cao','dac-biet',
  'me-be-nang-cao','me-be-dac-biet',
  '2-ngay-sinh-nang-cao','2-ngay-sinh-dac-biet',
  'truc-tiep-11','tarot','nam-thang-ca-nhan',
  // 2026-07-23: 4 dịch vụ trước đây có thẻ trên web nhưng KHÔNG đặt được từ form
  'tien-duyen','gia-dinh','dat-ten-thuong-hieu',
]);

const PKG_CODES = {
  'CO-BAN':    { id: 'co-ban',               price: 500000  },
  'NANG-CAO':  { id: 'nang-cao',             price: 1000000 },
  'DAC-BIET':  { id: 'dac-biet',             price: 2000000 },
  'ME-BE-NC':  { id: 'me-be-nang-cao',       price: 1500000 },
  'ME-BE-DB':  { id: 'me-be-dac-biet',       price: 3000000 },
  '2NS-NC':    { id: '2-ngay-sinh-nang-cao', price: 1500000 },
  '2NS-DB':    { id: '2-ngay-sinh-dac-biet', price: 2500000 },
  'TRUC-TIEP': { id: 'truc-tiep-11',         price: 3000000 },
  'EBOKTSH':   { id: 'ebook-tsh',            price: 579000  },
  'EBOOK':     { id: 'ebook',                price: 128000  },
  'CHUYENSAU': { id: 'khoa-hoc-chuyen-sau',  price: 8868000 },
  'TAROT':     { id: 'tarot',                price: 500000  },
  'HV':        { id: 'khoa-hoc-3-goc',       price: 3868000 },
  'NAMTHANG':  { id: 'nam-thang-ca-nhan',    price: 300000  },
  // 2026-07-23 — 3 mã mới. PHẢI đặt CUỐI: vòng lặp dừng ở mã khớp đầu tiên, nên mã thêm sau
  // không được phép cắt mặt các mã cũ khi tên khách vô tình chứa chuỗi giống.
  'TIEN-DUYEN': { id: 'tien-duyen',           price: 2000000 },
  'GIA-DINH':   { id: 'gia-dinh',             price: 2500000 },
  'DAT-TEN-TH': { id: 'dat-ten-thuong-hieu',  price: 1000000 }
};

// Mã dễ dính trong tên khách chuyển khoản (HV..., NAM THANG/THẮNG..., GIA DINH/Gia Định)
// → bắt buộc kèm 4 số ngay sau mã (vd HV1234, NAMTHANG5678, GIADINH9012)
// Cả 3 mã mới đều bắt buộc kèm 4 số: chúng là TỪ TIẾNG VIỆT THƯỜNG nên rất dễ trùng tên khách
// (khách tên "Tiên Duyên" đặt gói Đặt Tên → nội dung CK chứa cả TIENDUYEN lẫn DATTENTH).
// QR SePay luôn sinh sẵn 4 số sau mã nên ràng buộc này không ảnh hưởng đơn thật.
const CODES_NEED_DIGITS = new Set(['HV', 'NAMTHANG', 'GIA-DINH', 'TIEN-DUYEN', 'DAT-TEN-TH']);

function gasGet(payloadStr) {
  const url = process.env.GAS_URL;
  if (!url) return Promise.resolve();
  // VÁ 2026-07-19: kèm khóa server (env GAS_KEY) — GAS chỉ nhận update-status khi có khóa đúng.
  let payload = payloadStr;
  try {
    payload = JSON.stringify({ ...JSON.parse(payloadStr), key: process.env.GAS_KEY || '' });
  } catch { /* payload không phải JSON — giữ nguyên */ }
  return new Promise(resolve => {
    https.get(url + '?payload=' + encodeURIComponent(payload), r => { r.resume(); r.on('end', resolve); }).on('error', resolve);
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = (req.url || '').split('/api/webhook/')[1]?.split('?')[0] || '';

  if (action === 'sepay' && req.method === 'POST') {
    // ── DEBUG: Await log trước mọi thứ — ghi được dù auth fail ──
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const debugLog = {
      ts: new Date().toISOString(),
      url: req.url,
      authHeader: (authHeader || 'MISSING').slice(0, 60),
      body: { transferType: req.body?.transferType, transferAmount: req.body?.transferAmount, content: (req.body?.content || '').slice(0, 60) }
    };
    await Promise.all([
      kv.set('webhook:debug:last', debugLog, { ex: 86400 }),
      kv.lpush('webhook:debug:log', JSON.stringify(debugLog)).then(() => kv.ltrim('webhook:debug:log', 0, 29))
    ]).catch(() => {});
    console.log('[webhook/sepay] Incoming:', JSON.stringify(debugLog));

    // ── Auth check — 3 lớp (nâng cấp 2026-07-14) ──
    // (1) Header "Authorization: Apikey <SEPAY_APIKEY>" — chuẩn SePay khi bật API key.
    // (2) Khóa trong URL "?k=<WEBHOOK_KEY>" — dành cho SePay KHÔNG gửi header:
    //     đặt URL webhook trên SePay = https://www.sammytruong.com/api/webhook/sepay?k=xxxx
    // (3) x-admin-secret (env ADMIN_SECRET) — bypass để test thủ công.
    // Chế độ MỀM (mặc định, giữ từ fix 2026-07-10 để không gãy thanh toán):
    //   thiếu mọi xác thực → vẫn xử lý + cảnh báo; header CÓ mà SAI → từ chối.
    // Chế độ STRICT: đặt env WEBHOOK_STRICT=1 (SAU khi đã gắn ?k= trên SePay)
    //   → từ chối tất cả request không qua được 1 trong 3 lớp trên.
    const isAdminTest = checkAdminSecret(req);
    const apiKey = (process.env.SEPAY_APIKEY || '').trim();
    const headerKey = authHeader.replace(/^(bearer|apikey)\s+/i, '').trim();
    const headerOk = !!(apiKey && authHeader && headerKey === apiKey);
    const urlKeyEnv = (process.env.WEBHOOK_KEY || '').trim();
    const urlOk = !!(urlKeyEnv && String(req.query?.k || '').trim() === urlKeyEnv);

    if (!isAdminTest && !headerOk && !urlOk) {
      if (authHeader && apiKey) {
        console.error('[webhook/sepay] Auth mismatch — từ chối.');
        await kv.set('webhook:debug:auth_fail', { ts: new Date().toISOString(), header: authHeader.slice(0, 60) }, { ex: 86400 }).catch(() => {});
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (process.env.WEBHOOK_STRICT === '1') {
        console.error('[webhook/sepay] STRICT mode — thiếu xác thực, từ chối.');
        await kv.set('webhook:debug:auth_fail', { ts: new Date().toISOString(), reason: 'strict-no-auth' }, { ex: 86400 }).catch(() => {});
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.warn('[webhook/sepay] Không có xác thực — vẫn xử lý (soft auth). Nên gắn ?k= vào URL webhook trên SePay rồi bật WEBHOOK_STRICT=1.');
    }

    // Process TRƯỚC → respond SAU để đảm bảo KV writes hoàn thành
    // (Vercel có thể kill function ngay sau res.json nếu có await phía sau)
    try {
      const d = req.body;
      console.log('[webhook/sepay] Received:', d.transferType, d.transferAmount, d.content?.slice(0, 40));

      if (d.transferType !== 'in') return res.json({ received: true });

      // ── VÁ 2026-07-19 — CHỐNG XỬ LÝ TRÙNG ──
      // SePay gửi lại webhook khi lần trước timeout hoặc không trả 2xx. Bản cũ mỗi lần gọi lại
      // đều find() ra MỘT đơn pending khác cùng gói rồi đánh dấu completed → 1 lần chuyển khoản
      // đóng 2 đơn (đã xảy ra với Lê Thị Tuyết Nhi ngày 10/07: 3 đơn nang-cao, 2 đơn completed).
      // Nay chốt theo mã giao dịch SePay: mỗi giao dịch chỉ được xử lý đúng 1 lần.
      const txId = String(d.id || d.referenceCode || '').trim();
      if (txId) {
        const firstTime = await kv.set(`sepay:tx:${txId}`, {
          at: new Date().toISOString(),
          amount: d.transferAmount,
          content: (d.content || '').slice(0, 80)
        }, { nx: true, ex: 30 * 86400 });
        // SET NX trả 'OK' nếu là lần đầu, null nếu mã giao dịch đã có → đã xử lý rồi
        if (!firstTime) {
          console.log('[webhook/sepay] Giao dịch', txId, 'đã xử lý trước đó — bỏ qua.');
          return res.json({ received: true, duplicate: true });
        }
      } else {
        console.warn('[webhook/sepay] Payload không có id/referenceCode — không chống trùng được.');
      }

      const content = (d.content || '').toUpperCase().replace(/\s+/g, ' ').trim();
      // Ngân hàng thường XÓA ký tự đặc biệt trong nội dung CK ("CO-BAN" → "COBAN"/"CO BAN")
      // → so khớp trên bản chuẩn hóa chỉ còn A-Z0-9 (fix 2026-07-10)
      const contentNorm = content.replace(/[^A-Z0-9]/g, '');
      const amount  = Number(d.transferAmount) || 0;

      let pkgCode = null, pkg = null, matchPackageId = null, payCode = null;
      for (const [code, info] of Object.entries(PKG_CODES)) {
        const codeNorm = code.replace(/[^A-Z0-9]/g, '');
        // Mã trong CODES_NEED_DIGITS dễ trùng tên khách → bắt buộc kèm 4 số (vd HV1234, NAMTHANG5678)
        const matched = CODES_NEED_DIGITS.has(code)
          ? new RegExp(codeNorm + '\\d{4}').test(contentNorm)
          : contentNorm.includes(codeNorm);
        if (matched) {
          pkgCode = code; pkg = info; matchPackageId = info.id;
          // Bắt luôn mã 4 số đi kèm (vd EBOKTSH1234 → "1234") để khớp ĐÚNG đơn đã trả tiền
          const cm = contentNorm.match(new RegExp(codeNorm + '(\\d{4})'));
          payCode = cm ? cm[1] : null;
          break;
        }
      }
      if (!pkg) {
        const daMatch = contentNorm.match(/DA(\d{4})/);
        if (daMatch) { pkgCode = 'DA'; pkg = { id: 'da-nang-luong', price: 0 }; matchPackageId = 'DA' + daMatch[1]; }
      }

      if (!pkg) {
        console.log('[webhook/sepay] No package matched:', content.slice(0, 60));
        return res.json({ received: true });
      }
      if (amount < pkg.price) {
        console.log('[webhook/sepay] Amount too low:', amount, '<', pkg.price);
        return res.json({ received: true });
      }

      console.log('[webhook/sepay] Matched:', pkgCode, '→', matchPackageId, 'amount:', amount);

      // Lưu payment event (race condition fallback)
      const paymentEventKey = `payment:${pkgCode}:${Date.now()}`;
      await kv.set(paymentEventKey, {
        pkgCode, matchPackageId, amount,
        payCode,                                  // mã 4 số — để order.js khớp đúng đơn (vá 2026-07-19)
        content: content.slice(0, 80),
        receivedAt: new Date().toISOString()
      }, { ex: 86400 });

      // ── VÁ 2026-07-19 — CHỌN ĐÚNG ĐƠN ĐÃ TRẢ TIỀN ──
      // Bản cũ chỉ khớp TÊN GÓI và không giới hạn tuổi đơn → một khoản tiền (kể cả tiền test)
      // đóng nhầm đơn treo lâu ngày của khách khác. Ca thật: 2026-06-27 một khoản ebook-tsh test
      // đã đóng đơn 5 NGÀY TUỔI của tinagiakhanh1201.
      // Nay: (1) ưu tiên khớp CHÍNH XÁC mã 4 số trong nội dung CK,
      //      (2) chỉ khi không có mã mới lùi về "đơn pending mới nhất", và giới hạn ≤ 24 giờ.
      const MAX_AGE = 24 * 60 * 60 * 1000;
      const ids = await kv.lrange('orders:list', 0, -1);
      const orders = (ids?.length ? await Promise.all(ids.map(id => kv.get(`order:${id}`))) : []).filter(Boolean);
      const isPending = o => o.status === 'pending_verification' || o.status === 'pending';
      const ageOf = o => Date.now() - new Date(o.confirmedAt || 0).getTime();

      let order = null, matchedBy = '';
      if (payCode) {
        order = orders.find(o => isPending(o) && o.packageId === matchPackageId && o.orderCode === payCode);
        if (order) matchedBy = 'mã CK ' + payCode;
      }
      if (!order) {
        // lrange trả [mới nhất → cũ nhất] nên find() lấy đơn pending mới nhất
        order = orders.find(o => isPending(o) && o.packageId === matchPackageId && ageOf(o) <= MAX_AGE);
        if (order) matchedBy = 'gói + trong 24h (không có mã CK)';
      }
      if (order) console.log('[webhook/sepay] Chọn đơn', order.id, '— khớp theo', matchedBy);

      // ── VÁ 2026-08-01 — KÍCH HOẠT HỌC VIÊN KHÓA 3 GỐC ──
      // Phải chạy TRƯỚC cửa thoát "không có đơn" ngay bên dưới. Đơn chỉ sinh ra khi khách
      // bấm nút "Tôi Đã Chuyển Khoản" trên trang thanh toán; khách quét QR trả tiền rồi
      // đóng tab là KHÔNG có đơn nào — bản cũ thoát ở đây và học viên không bao giờ được bật.
      // Nguồn email nay lấy theo thứ tự: đơn → orderinfo:HV#### (trang thanh toán tự lưu khi
      // load) → email gõ trong nội dung CK. Bản cũ CHỈ nhận nguồn cuối, mà nội dung CK do web
      // sinh ra là "HV1234 TÊN KHÁCH" nên nhánh kích hoạt chưa từng chạy một lần nào.
      let hvActivated = false;
      if (pkgCode === 'HV') {
        const info = await resolveStudentInfo({ order, payCode, content: d.content });
        if (!info) {
          console.error('[webhook/sepay] HV: KHÔNG tìm ra email khách (payCode=', payCode, ') — cần bật tay trong admin.');
          await kv.set('webhook:hv:unresolved', {
            at: new Date().toISOString(), payCode, amount, content: content.slice(0, 80)
          }, { ex: 30 * 86400 }).catch(() => {});
        } else {
          // 2026-08-02: KHÔNG truyền sendEbook → tiền về chỉ bật tài khoản + gửi mail OTP,
          // bộ 35 PDF nay là tùy chọn, gửi tay bằng nút riêng trong admin.
          const r = await activateAndNotify({
            email: info.email, fullName: info.fullName, zalo: info.zalo,
            source: `webhook:${info.from}`
          });
          hvActivated = !!r.ok;
          if (r.ok) await kv.del('webhook:hv:unresolved').catch(() => {});
          // Đóng dấu Sheet ngay cả khi không có đơn (nhánh dưới chỉ chạy khi có đơn)
          if (r.ok && !order) {
            await gasGet(JSON.stringify({
              formType: 'update-status', email: info.email, pkgId: 'khoa-hoc-3-goc',
              status: 'Đã Thanh Toán ✓', name: info.fullName || '', phone: info.zalo || ''
            }));
          }
        }
      }

      if (!order) {
        console.log('[webhook/sepay] No pending order for', matchPackageId, '— event saved:', paymentEventKey);
        return res.json({ received: true, activated: hvActivated });
      }

      await kv.set(`order:${order.id}`, { ...order, status: 'completed', completedAt: new Date().toISOString() });
      await kv.del(paymentEventKey).catch(() => {});
      console.log('[webhook/sepay] Order', order.id, 'completed for', order.email);

      if (pkg.id !== 'da-nang-luong') {
        await gasGet(JSON.stringify({ formType: 'update-status', email: order.email, pkgId: pkg.id, status: 'Đã Thanh Toán ✓', name: order.customerName, phone: order.zalo }));
      }
      if (pkg.id === 'ebook-tsh') {
        await sendEbookDeliveryEmail({ email: order.email, customerName: order.customerName }).catch(console.error);
      } else if (pkg.id === 'ebook') {
        await sendEbookHanhTrinhEmail({ email: order.email, customerName: order.customerName }).catch(console.error);
      } else if (BOOKING_PKGS.has(pkg.id)) {
        await sendBookingConfirmEmail({ email: order.email, customerName: order.customerName, packageName: order.packageName || pkg.id, price: order.price || pkg.price, zalo: order.zalo || '' }).catch(console.error);
      } else if (hvActivated) {
        // Khóa 3 Gốc đã nhận mail kích hoạt (hướng dẫn đăng nhập OTP) ở khối trên
        // → không gửi thêm mail "xác nhận thanh toán" chung chung nữa.
        console.log('[webhook/sepay] HV đã gửi mail kích hoạt — bỏ qua mail xác nhận chung.');
      } else {
        await sendPaymentConfirmEmail(order).catch(console.error);
      }
    } catch (err) {
      console.error('[webhook/sepay] Error:', err.message);
    }
    return res.json({ received: true });
  }

  res.status(404).json({ error: 'Không tìm thấy endpoint' });
};
