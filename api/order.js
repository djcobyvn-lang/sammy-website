const { kv } = require('@vercel/kv');
const { isAdmin } = require('./_lib/admin');
const { gasCall } = require('./_lib/gas');
const { sendPaymentConfirmEmail, sendEbookDeliveryEmail, sendEbookHanhTrinhEmail, sendBookingConfirmEmail } = require('./_lib/mailer');

// Map packageId → PKG_CODES key (để tìm payment event từ webhook)
const PKG_ID_TO_CODE = {
  'ebook-tsh':                'EBOKTSH',
  'ebook':                    'EBOOK',
  'khoa-hoc-3-goc':           'HV',
  'khoa-hoc-chuyen-sau':      'CHUYENSAU',
  'tarot':                    'TAROT',
  // Luận giải cá nhân
  'co-ban':                   'CO-BAN',
  'nang-cao':                 'NANG-CAO',
  'dac-biet':                 'DAC-BIET',
  'me-be-nang-cao':           'ME-BE-NC',
  'me-be-dac-biet':           'ME-BE-DB',
  '2-ngay-sinh-nang-cao':     '2NS-NC',
  '2-ngay-sinh-dac-biet':     '2NS-DB',
  'truc-tiep-11':             'TRUC-TIEP',
  'nam-thang-ca-nhan':        'NAMTHANG',
  // 2026-07-23 — 4 dịch vụ mới mở đường đặt hàng (Tiền Duyên, Gia Đình, Đặt Tên TH; Tarot đã có)
  'tien-duyen':               'TIEN-DUYEN',
  'gia-dinh':                 'GIA-DINH',
  'dat-ten-thuong-hieu':      'DAT-TEN-TH',
  'tarot':                    'TAROT',
};

// Các gói cần email "đặt bài" (Sammy sẽ liên hệ)
const BOOKING_PKGS = new Set([
  'co-ban','nang-cao','dac-biet',
  'me-be-nang-cao','me-be-dac-biet',
  '2-ngay-sinh-nang-cao','2-ngay-sinh-dac-biet',
  'truc-tiep-11','tarot','nam-thang-ca-nhan',
  'tien-duyen','gia-dinh','dat-ten-thuong-hieu',
]);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || (req.url || '').split('/api/order/')[1]?.split('?')[0] || '';

  try {
    // POST /api/order?action=confirm
    if (action === 'confirm' && req.method === 'POST') {
      const { packageId, packageName, price, orderCode, customerName, email, zalo, confirmedAt } = req.body;
      // VÁ 2026-07-19 (2): order.id CŨ = Date.now() → chỉ phân giải tới mili-giây.
      // Hai đơn tạo trong cùng 1 ms nhận CÙNG id → kv.set ghi đè, đơn trước MẤT TRẮNG và
      // orders:list dính id trùng. Đo thử: 20 đơn liên tiếp chỉ còn 3 bản ghi (mất 17).
      // Thêm hậu tố ngẫu nhiên → id vừa duy nhất vừa không đoán được.
      const crypto = require('crypto');
      const checkToken = crypto.randomBytes(16).toString('hex');
      const order = {
        id: Date.now().toString() + '-' + crypto.randomBytes(4).toString('hex'),
        packageId, packageName, price, customerName, email, zalo,
        // mã 4 số trong nội dung CK — để webhook khớp ĐÚNG đơn đã trả tiền (vá 2026-07-19)
        orderCode: String(orderCode || '').replace(/\D/g, '').slice(0, 4),
        checkToken,
        status: 'pending_verification',
        confirmedAt: confirmedAt || new Date().toISOString()
      };
      await kv.set(`order:${order.id}`, order);
      await kv.lpush('orders:list', order.id);

      // ── FIX RACE CONDITION: kiểm tra xem SePay đã gửi webhook trước đó chưa ──
      // Nếu có payment event trong KV (webhook đến trước Xác Nhận), auto-complete ngay
      const pkgCode = PKG_ID_TO_CODE[packageId];
      if (pkgCode) {
        try {
          // Lấy tất cả keys payment:PKGCODE:* trong 24h gần nhất
          const eventKeys = await kv.keys(`payment:${pkgCode}:*`);
          if (eventKeys && eventKeys.length > 0) {
            // Dùng event gần nhất
            const latestKey = eventKeys.sort().pop();
            const event = await kv.get(latestKey);
            // VÁ 2026-07-19: bản cũ chỉ so packageId → một event tồn đọng trong 24h có thể
            // auto-complete đơn của khách KHÁC cùng gói mà chưa ai trả tiền cho đơn đó.
            // Nay bắt buộc thêm: (1) số tiền đã về ≥ giá gói, (2) event còn mới ≤ 30 phút.
            const evAmount = Number(event?.amount) || 0;
            const evAge = event?.receivedAt ? Date.now() - new Date(event.receivedAt).getTime() : Infinity;
            const amountOk = evAmount > 0 && evAmount >= (Number(price) || Infinity);
            const freshOk = evAge >= 0 && evAge <= 30 * 60 * 1000;
            // VÁ 2026-07-19: nếu CẢ HAI bên đều có mã 4 số thì bắt buộc trùng mã — chặn việc
            // tiền của khách này auto-complete đơn của khách kia (cùng gói, cùng giá).
            const myCode = String(orderCode || '').replace(/\D/g, '').slice(0, 4);
            const codeOk = !(event?.payCode && myCode) || event.payCode === myCode;
            if (event && event.matchPackageId === packageId && amountOk && freshOk && codeOk) {
              // Payment event khớp → auto-complete order ngay
              const completed = { ...order, status: 'completed', completedAt: new Date().toISOString(), completedBy: 'payment-event-match' };
              await kv.set(`order:${order.id}`, completed);
              await kv.del(latestKey).catch(() => {});
              console.log('[order/confirm] Auto-completed via payment event', latestKey, 'for', email);

              // VÁ 2026-07-19: đóng dấu Sheet TỪ SERVER (kèm khóa GAS_KEY).
              // Trước đây nhánh này KHÔNG hề gọi GAS — Sheet chỉ được cập nhật nhờ lệnh gọi
              // update-status từ browser (đã bỏ vì URL GAS công khai). Không có dòng này thì
              // đơn auto-complete sẽ không bao giờ lên "Đã Thanh Toán ✓" trong Sheet.
              // VÁ 2026-07-24 — PHẢI AWAIT. Bản trước gọi gasCall/send*Email rồi thả trôi
              // (fire-and-forget) và trả res.json ngay bên dưới. Vercel đóng băng instance
              // NGAY khi response được flush → request tới GAS và phiên SMTP bị cắt giữa chừng,
              // KHÔNG lỗi, KHÔNG log. Hậu quả: đơn "completed" trong KV nhưng Sheet vẫn
              // "Chờ Thanh Toán" và khách KHÔNG nhận email. Ca thật: Bùi Hương Giang
              // 24/07 03:45 (gói nang-cao, mã CK 4155) — KV completed, Sheet paid=false.
              // webhook.js vốn đã await đúng ở nhánh của nó; nhánh này bị bỏ sót.
              if (packageId !== 'da-nang-luong' && !/^DA\d{4}$/.test(packageId)) {
                await gasCall({
                  formType: 'update-status',
                  email, pkgId: packageId, status: 'Đã Thanh Toán ✓',
                  name: customerName || '', phone: zalo || ''
                }).catch(e => console.warn('[order/confirm] GAS update-status lỗi:', e.message));
              }

              // Gửi email
              if (packageId === 'ebook-tsh') {
                await sendEbookDeliveryEmail({ email, customerName: customerName || 'bạn' }).catch(console.error);
              } else if (packageId === 'ebook') {
                await sendEbookHanhTrinhEmail({ email, customerName: customerName || 'bạn' }).catch(console.error);
              } else if (BOOKING_PKGS.has(packageId)) {
                await sendBookingConfirmEmail({ email, customerName: customerName || 'bạn', packageName: completed.packageName || packageId, price: completed.price || 0, zalo: completed.zalo || '' }).catch(console.error);
              } else if (packageId === 'khoa-hoc-3-goc') {
                // VÁ 2026-08-01: nhánh này TRƯỚC GIỜ chỉ gửi mail xác nhận chung mà KHÔNG kích
                // hoạt học viên. Nó chạy khi webhook SePay tới TRƯỚC lúc khách bấm "Tôi Đã
                // Chuyển Khoản" — tiền đã về thật, đơn đã completed, nhưng tài khoản vẫn khóa.
                // Hàm activateAndNotify tự chống trùng nên webhook chạy trước cũng vô hại.
                // 2026-08-02: KHÔNG truyền sendEbook → đường tự động không gửi bộ 35 PDF nữa.
                // Muốn tặng thì bấm nút "📚 Chỉ Gửi Bộ 35 PDF" trong admin cho từng khách.
                const { activateAndNotify } = require('./_lib/student');
                await activateAndNotify({
                  email, fullName: customerName || '', zalo: zalo || '', source: 'order-confirm'
                }).catch(console.error);
              } else {
                await sendPaymentConfirmEmail(completed).catch(console.error);
              }
            }
          }
        } catch (e) {
          console.warn('[order/confirm] Payment event check failed:', e.message);
        }
      }

      return res.json({ success: true, orderId: order.id, checkToken });
    }

    // GET /api/order?action=list — CHỈ ADMIN (chứa họ tên, email, Zalo của khách)
    if (action === 'list' && req.method === 'GET') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      const ids = await kv.lrange('orders:list', 0, -1);
      if (!ids || !ids.length) return res.json([]);
      const orders = await Promise.all(ids.map(id => kv.get(`order:${id}`)));
      return res.json(orders.filter(Boolean).reverse());
    }

    // GET /api/order?action=subscribers — CHỈ ADMIN: danh sách email đăng ký bản tin
    if (action === 'subscribers' && req.method === 'GET') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      const emails = await kv.lrange('subscribers:list', 0, -1);
      if (!emails || !emails.length) return res.json([]);
      const subs = await Promise.all(emails.map(e => kv.get(`subscriber:${e}`)));
      return res.json(subs.filter(Boolean));
    }

    // GET /api/order?action=gas-health&k=<GAS_KEY> — tự kiểm đường server → GAS (thêm 2026-07-19)
    // Vì sao cần: nếu GAS_KEY trên Vercel lệch với API_KEY trong Apps Script, GAS sẽ trả
    // Unauthorized và Sheet LẶNG LẼ ngừng cập nhật khi có thanh toán — không ai biết.
    // Cổng vào chính là GAS_KEY: ai biết khóa thì vốn đã ghi được Sheet, nên không lộ thêm gì.
    // Phép thử dùng revert-status trên email không tồn tại → GAS không ghi/sửa dòng nào.
    if (action === 'gas-health' && req.method === 'GET') {
      const k = String(req.query.k || '');
      const envKey = process.env.GAS_KEY || '';
      if (!envKey || k !== envKey) return res.status(401).json({ error: 'Unauthorized' });
      const r = await gasCall({
        formType: 'revert-status',
        email: 'gas-health-check@example.invalid',
        pkgId: 'nang-cao'
      });
      return res.json({
        gasUrlSet: !!process.env.GAS_URL,
        gasKeySet: true,
        gasAccepted: r?.success === true,   // true = khóa server khớp Apps Script
        gasReply: r
      });
    }

    // GET /api/order?action=check&orderId=...
    // VÁ 2026-07-19 — LỖI NGHIÊM TRỌNG: bản cũ dò theo (pkgId + email) trên TOÀN BỘ lịch sử đơn,
    // không giới hạn thời gian, lại còn bỏ qua email khi email rỗng. Hậu quả: khách quen quay lại
    // mua đúng gói cũ bị trả về paid=true NGAY khi mở trang thanh toán (khớp đơn completed từ lần
    // trước) → web tự báo "Đã Thanh Toán ✓" dù chưa nhận được đồng nào.
    // Nay CHỈ tra đúng đơn vừa tạo theo orderId.
    if (action === 'check' && req.method === 'GET') {
      const orderId = String(req.query.orderId || '').trim();
      if (orderId) {
        const o = await kv.get(`order:${orderId}`);
        if (!o) return res.json({ paid: false });
        // Đơn tạo TỪ 2026-07-19 trở đi đều có checkToken → bắt buộc khớp.
        // Đơn cũ chưa có token thì bỏ qua kiểm tra (không làm gãy đơn đang dở).
        const token = String(req.query.t || '').trim();
        if (o.checkToken && o.checkToken !== token) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        return res.json({ paid: o.status === 'completed' });
      }

      // Legacy: đá năng lượng dùng packageId dạng DA#### — mã 4 số DUY NHẤT cho từng đơn,
      // nên tra theo packageId vẫn là tra đúng 1 đơn. Mọi packageId khác đều bị từ chối.
      const pkgId = String(req.query.pkgId || '').trim();
      if (!/^DA\d{4}$/.test(pkgId)) {
        return res.status(400).json({ error: 'Thiếu orderId' });
      }
      const ids = await kv.lrange('orders:list', 0, -1);
      const orders = ids?.length ? await Promise.all(ids.map(id => kv.get(`order:${id}`))) : [];
      const match = orders.filter(Boolean).find(o =>
        o.packageId === pkgId && o.status === 'completed'
      );
      return res.json({ paid: !!match });
    }

    // POST /api/order?action=subscribe — đăng ký bản tin (form cuối trang chủ)
    if (action === 'subscribe' && req.method === 'POST') {
      const email = (req.body?.email || '').toLowerCase().trim();
      const source = String(req.body?.source || 'homepage').slice(0, 50);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return res.status(400).json({ error: 'Email không hợp lệ' });
      }
      const key = `subscriber:${email}`;
      const existed = await kv.get(key);
      if (!existed) {
        await kv.set(key, { email, source, createdAt: new Date().toISOString() });
        await kv.lpush('subscribers:list', email);
      }
      return res.json({ success: true, already: !!existed });
    }

    // GET /api/order?action=fb-cron&slot=am|pm — cron đăng bài lên fanpage
    // (slot=am 8:00 VN: SEO + đăng lại · slot=pm 20:00 VN: bài mới của ngày)
    // Auth: Vercel Cron gửi Bearer CRON_SECRET; test tay bằng ?k=CRON_SECRET; hoặc admin JWT.
    if (action === 'fb-cron' && req.method === 'GET') {
      const okCron = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
      const okKey = process.env.CRON_SECRET && req.query.k === process.env.CRON_SECRET;
      if (!okCron && !okKey && !isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      const slot = req.query.slot === 'am' ? 'am' : 'pm';
      const { pickPost, postToPage, todayVN } = require('./_lib/fb');
      const item = await pickPost(kv, slot);
      if (!item) return res.json({ success: true, slot, posted: null, msg: 'Không có bài tới hạn chưa đăng', today: todayVN() });
      const postId = await postToPage(item);
      const mode = item.mode || 'link'; // 'full' = trọn bài + ảnh · 'link' = dẫn về website
      await kv.set(`fb:posted:${item.id}`, { postId, date: item.date, mode, at: new Date().toISOString() });
      await kv.lpush('fb:log', JSON.stringify({ id: item.id, slot, mode, postId, at: new Date().toISOString() }));
      console.log('[fb-cron]', slot, mode, 'posted', item.id, postId);
      return res.json({ success: true, slot, mode, posted: item.id, postId });
    }

    // GET /api/order?action=fb-log — CHỈ ADMIN: xem nhật ký đã đăng fanpage
    if (action === 'fb-log' && req.method === 'GET') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      const log = await kv.lrange('fb:log', 0, 30);
      return res.json((log || []).map(x => { try { return JSON.parse(x); } catch { return x; } }));
    }

    // POST /api/order?action=save-info
    if (action === 'save-info' && req.method === 'POST') {
      const { code, email, name, phone } = req.body;
      if (!code) return res.status(400).json({ error: 'Thiếu code' });
      await kv.set(`orderinfo:${code}`, { ...req.body, savedAt: new Date().toISOString() }, { ex: 60 * 60 * 24 * 3 });
      return res.json({ success: true });
    }

    res.status(404).json({ error: 'Không tìm thấy endpoint' });
  } catch (err) {
    console.error('[order]', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};
