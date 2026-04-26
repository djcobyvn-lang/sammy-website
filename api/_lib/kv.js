// Vercel KV (Upstash Redis) — REST API, không cần SDK
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvSet(key, value, exSeconds) {
  if (!KV_URL || !KV_TOKEN) {
    console.warn('[KV] env vars missing');
    return false;
  }
  try {
    const args = exSeconds ? `${value}/ex/${exSeconds}` : value;
    const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(args)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await res.json();
    console.log('[KV] set', key, '→', JSON.stringify(data));
    return data.result === 'OK';
  } catch(e) {
    console.warn('[KV] set error:', e.message);
    return false;
  }
}

async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res  = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await res.json();
    return data.result;
  } catch(e) {
    console.warn('[KV] get error:', e.message);
    return null;
  }
}

async function kvDel(key) {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
  } catch(e) {}
}

module.exports = { kvSet, kvGet, kvDel };
