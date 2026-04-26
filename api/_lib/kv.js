// Upstash Redis REST API (tương thích với Vercel KV)
// Hỗ trợ cả Vercel KV vars và Upstash direct vars
const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvSet(key, value, exSeconds) {
  if (!KV_URL || !KV_TOKEN) {
    console.warn('[KV] env vars missing — KV_REST_API_URL hoặc UPSTASH_REDIS_REST_URL chưa set');
    return false;
  }
  try {
    // Upstash REST: GET /set/<key>/<value>?ex=<seconds>
    const expiry = exSeconds ? `?ex=${exSeconds}` : '';
    const url    = `${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}${expiry}`;
    const res    = await fetch(url, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const data   = await res.json();
    console.log('[KV] set', key, '=', value, '→', data.result);
    return data.result === 'OK';
  } catch(e) {
    console.warn('[KV] set error:', e.message);
    return false;
  }
}

async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const url  = `${KV_URL}/get/${encodeURIComponent(key)}`;
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const data = await res.json();
    return data.result;
  } catch(e) {
    console.warn('[KV] get error:', e.message);
    return null;
  }
}

module.exports = { kvSet, kvGet };
