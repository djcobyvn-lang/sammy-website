/**
 * POST /api/admin/sync-articles
 * Nhận danh sách bài viết đã published và lưu vào KV.
 * Auth: email phải nằm trong ADMIN_EMAILS.
 * Không yêu cầu JWT — dùng cho trường hợp chưa có token.
 */
const { kvSet } = require('../_lib/kv');

const ADMIN_EMAILS = [
  'sammynumerology@gmail.com',
  'honggdiem992@gmail.com',
];

module.exports = async (req, res) => {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { email, articles } = req.body || {};

  if (!email || !ADMIN_EMAILS.includes(email.toLowerCase().trim()))
    return res.status(403).json({ error: 'Không có quyền truy cập' });

  if (!Array.isArray(articles))
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });

  const published = articles
    .filter(a => a.status === 'published' && a.id && a.title)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  await kvSet('articles:published', JSON.stringify(published));

  console.log('[SyncArticles] saved', published.length, 'articles for', email);
  return res.json({ success: true, count: published.length });
};
