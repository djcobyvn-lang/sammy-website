/**
 * /api/order?action=check|save-info|confirm
 * Gộp 3 order endpoints thành 1 function để tiết kiệm serverless slot.
 */
const { kvGet, kvSet } = require('./_lib/kv');
const { gasCall }      = require('./_lib/gas');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query.action || '';

  // ── check: GET /api/order?action=check&pkgId=xxx ──
  if (action === 'check') {
    const { pkgId } = req.query;
    if (!pkgId) return res.status(400).json({ paid: false });
    const key   = `paid:${pkgId}`;
    const value = await kvGet(key);
    console.log('[order/check] key:', key, '→', value);
    return res.json({ paid: value === '1' });
  }

  // ── save-info: POST /api/order?action=save-info ──
  if (action === 'save-info') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false });
    const { code, email, name, phone } = req.body || {};
    if (!code || !email) return res.status(400).json({ ok: false, error: 'Missing code or email' });
    await kvSet(`info:${code}`, JSON.stringify({ email, name: name || '', phone: phone || '' }), 86400);
    console.log('[order/save-info] saved info for', code, '→', email);
    return res.json({ ok: true });
  }

  // ── confirm: POST /api/order?action=confirm ──
  if (action === 'confirm') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const order = req.body || {};
    await gasCall({ ...order, formType: 'xac-nhan-ck' });
    return res.json({ success: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
