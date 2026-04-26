const { gasCall } = require('../_lib/gas');

module.exports = async (req, res) => {
  const { email, pkgId } = req.query;
  if (!email && !pkgId)
    return res.status(400).json({ paid: false });

  // Thử gọi GAS từ server
  try {
    const result = await gasCall({ formType: 'check-payment', email, pkgId });
    console.log('[check] GAS result:', JSON.stringify(result));
    return res.json({ paid: result.paid === true });
  } catch(e) {
    console.warn('[check] GAS failed:', e.message);
    return res.json({ paid: false });
  }
};
