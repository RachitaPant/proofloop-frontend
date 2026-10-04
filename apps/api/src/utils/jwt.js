const jwt = require('jsonwebtoken');

const EXPIRATION_MS = Number(process.env.JWT_EXPIRATION_MS || 86400000);

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
  }
  return secret;
}

// Mirrors com.proofloop.util.JwtUtil — subject = email, "role" claim, HS256.
function generateToken(email, role) {
  return jwt.sign({ role }, getSecret(), {
    algorithm: 'HS256',
    subject: email,
    expiresIn: Math.floor(EXPIRATION_MS / 1000),
  });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
}

module.exports = { generateToken, verifyToken };
