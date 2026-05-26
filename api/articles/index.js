const { kvGet } = require('../_lib/kv');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const raw      = await kvGet('articles:published');
    const articles = raw ? JSON.parse(raw) : [];
    res.json({ articles });
  } catch (e) {
    console.error('[Articles] GET error:', e.message);
    res.json({ articles: [] });
  }
};
