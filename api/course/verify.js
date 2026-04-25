const { verifyToken } = require('../_lib/jwt');

module.exports = (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ access: false, error: 'Chưa đăng nhập' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ access: false, error: 'Token không hợp lệ' });

  res.json({ access: true, email: payload.email });
};
