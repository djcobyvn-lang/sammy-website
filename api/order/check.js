const { kvGet } = require('../_lib/kv');

module.exports = async (req, res) => {
  const { pkgId, email } = req.query;
  if (!pkgId && !email)
    return res.status(400).json({ paid: false });

  // Kiểm tra KV store — được set bởi webhook khi SePay xác nhận
  const key   = `paid:${pkgId || 'unknown'}`;
  const value = await kvGet(key);

  console.log('[check] key:', key, '→', value);
  return res.json({ paid: value === '1' });
};
