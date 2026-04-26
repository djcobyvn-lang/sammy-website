const { gasCall } = require('../_lib/gas');

module.exports = async (req, res) => {
  const { email, pkgId } = req.query;
  if (!email && !pkgId)
    return res.status(400).json({ paid: false, error: 'Thiếu thông tin' });

  const result = await gasCall({ formType: 'check-payment', email, pkgId });
  res.json({ paid: result.paid === true });
};
