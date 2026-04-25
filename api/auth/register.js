const { gasCall } = require('../_lib/gas');

module.exports = async (req, res) => {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { fullName, dob, email, zalo, goal } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Thiếu email' });

  await gasCall({ formType: 'khoa-hoc', fullName, dob, email, zalo, goal });
  res.json({ success: true });
};
