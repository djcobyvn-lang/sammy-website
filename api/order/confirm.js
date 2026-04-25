const { gasCall } = require('../_lib/gas');

module.exports = async (req, res) => {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const order = req.body || {};
  await gasCall({ ...order, formType: 'xac-nhan-ck' });
  res.json({ success: true });
};
