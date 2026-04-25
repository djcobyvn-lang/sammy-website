const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'sammy-jwt-secret-2026';

function signToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, SECRET, { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken };
