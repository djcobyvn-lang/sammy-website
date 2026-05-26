const { verifyToken } = require('../_lib/jwt');
const { kvGet, kvSet } = require('../_lib/kv');
const { gasCall }      = require('../_lib/gas');

function auth(req) {
  const raw = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  return raw ? verifyToken(raw) : null;
}

module.exports = async (req, res) => {
  if (!auth(req)) return res.status(401).json({ error: 'Unauthorized' });

  // ── SAVE / UPSERT ────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const article = req.body || {};
    if (!article.id || !article.title)
      return res.status(400).json({ error: 'Thiếu id hoặc tiêu đề' });

    const raw      = await kvGet('articles:published') || '[]';
    let articles   = JSON.parse(raw);

    if (article.status === 'published') {
      const idx = articles.findIndex(a => a.id === article.id);
      if (idx >= 0) articles[idx] = article;
      else          articles.unshift(article);
      // Sort by date descending
      articles.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    } else {
      // Draft / unpublish → remove from public list
      articles = articles.filter(a => a.id !== article.id);
    }

    await kvSet('articles:published', JSON.stringify(articles));

    // Async backup to Google Sheets
    gasCall({ formType: 'save-article', ...article }).catch(e =>
      console.warn('[GAS] save-article:', e.message)
    );

    return res.json({ success: true, count: articles.length });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Thiếu id' });

    const raw      = await kvGet('articles:published') || '[]';
    const articles = JSON.parse(raw).filter(a => a.id !== id);
    await kvSet('articles:published', JSON.stringify(articles));

    gasCall({ formType: 'delete-article', id }).catch(e =>
      console.warn('[GAS] delete-article:', e.message)
    );

    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
