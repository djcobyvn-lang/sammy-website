/**
 * POST /api/track-chat  — Lưu session chat vào KV
 * GET  /api/track-chat  — Lấy danh sách session (admin only)
 */
const { kvSet, kvGet, kvZAdd, kvZRevRange, kvZCard, kvZRemRangeByRank } = require('./_lib/kv');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'sammynumerology@gmail.com,honggdiem992@gmail.com').split(',');
const SESSION_TTL  = 90 * 24 * 3600; // 90 ngày
const MAX_SESSIONS = 2000;

module.exports = async (req, res) => {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── POST: nhận tracking data từ chatbot ──
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (!body.id) return res.status(400).json({ error: 'missing id' });

      // Geo từ Vercel headers
      const country = req.headers['x-vercel-ip-country'] || '—';
      const city    = decodeURIComponent(req.headers['x-vercel-ip-city'] || '') || '—';
      const region  = decodeURIComponent(req.headers['x-vercel-ip-region'] || '') || '';
      const ip      = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '—';
      const ua      = req.headers['user-agent'] || '';

      const session = {
        id:         body.id,
        ts:         body.ts         || Date.now(),
        lastActive: body.lastActive || Date.now(),
        msgCount:   body.msgCount   || 0,
        messages:   (body.messages  || []).slice(-40),
        services:   body.services   || [],
        registered: body.registered || false,
        lang:       body.lang       || '',
        mobile:     body.mobile     || false,
        ref:        body.ref        || '',
        country, city, region, ip, ua,
        updatedAt:  Date.now(),
      };

      await kvSet(`chat:sess:${body.id}`, JSON.stringify(session), SESSION_TTL);
      await kvZAdd('chat:sessions', session.lastActive, body.id);
      // Giữ tối đa MAX_SESSIONS session mới nhất
      const total = await kvZCard('chat:sessions');
      if (total > MAX_SESSIONS) {
        await kvZRemRangeByRank('chat:sessions', 0, total - MAX_SESSIONS - 1);
      }

      return res.status(200).json({ ok: true });
    } catch(e) {
      console.error('[track-chat] POST error:', e.message);
      return res.status(500).json({ error: 'server error' });
    }
  }

  // ── GET: admin xem danh sách session ──
  if (req.method === 'GET') {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!ADMIN_EMAILS.map(e => e.toLowerCase().trim()).includes(email)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const page  = Math.max(0, parseInt(req.query.page) || 0);
    const limit = 50;
    const ids   = await kvZRevRange('chat:sessions', page * limit, page * limit + limit - 1);
    const total = await kvZCard('chat:sessions');

    const sessions = [];
    for (const id of ids) {
      const raw = await kvGet(`chat:sess:${id}`);
      if (raw) {
        try { sessions.push(JSON.parse(raw)); } catch(e) {}
      }
    }

    return res.status(200).json({ sessions, total, page, limit });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
