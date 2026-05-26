// Upstash Redis REST API (tương thích với Vercel KV)
const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN;

const hdr = () => ({ Authorization: `Bearer ${KV_TOKEN}` });

async function kvSet(key, value, exSeconds) {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const expiry = exSeconds ? `?ex=${exSeconds}` : '';
    const url = `${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}${expiry}`;
    const res = await fetch(url, { headers: hdr() });
    const data = await res.json();
    return data.result === 'OK';
  } catch(e) { console.warn('[KV] set error:', e.message); return false; }
}

async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const url = `${KV_URL}/get/${encodeURIComponent(key)}`;
    const res = await fetch(url, { headers: hdr() });
    const data = await res.json();
    return data.result;
  } catch(e) { console.warn('[KV] get error:', e.message); return null; }
}

// Sorted set: thêm member với score
async function kvZAdd(key, score, member) {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const url = `${KV_URL}/zadd/${encodeURIComponent(key)}/${score}/${encodeURIComponent(member)}`;
    const res = await fetch(url, { headers: hdr() });
    const data = await res.json();
    return data.result >= 0;
  } catch(e) { console.warn('[KV] zadd error:', e.message); return false; }
}

// Sorted set: lấy range theo thứ tự ngược (mới nhất trước)
async function kvZRevRange(key, start, stop) {
  if (!KV_URL || !KV_TOKEN) return [];
  try {
    const url = `${KV_URL}/zrevrange/${encodeURIComponent(key)}/${start}/${stop}`;
    const res = await fetch(url, { headers: hdr() });
    const data = await res.json();
    return Array.isArray(data.result) ? data.result : [];
  } catch(e) { console.warn('[KV] zrevrange error:', e.message); return []; }
}

// Sorted set: đếm số phần tử
async function kvZCard(key) {
  if (!KV_URL || !KV_TOKEN) return 0;
  try {
    const url = `${KV_URL}/zcard/${encodeURIComponent(key)}`;
    const res = await fetch(url, { headers: hdr() });
    const data = await res.json();
    return data.result || 0;
  } catch(e) { return 0; }
}

// Sorted set: xóa phần tử cũ nhất (giới hạn size)
async function kvZRemRangeByRank(key, start, stop) {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const url = `${KV_URL}/zremrangebyrank/${encodeURIComponent(key)}/${start}/${stop}`;
    await fetch(url, { headers: hdr() });
    return true;
  } catch(e) { return false; }
}

module.exports = { kvSet, kvGet, kvZAdd, kvZRevRange, kvZCard, kvZRemRangeByRank };
