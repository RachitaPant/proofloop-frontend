const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');
const { UnauthorizedException, AccessDeniedException } = require('../utils/errors');

// Validates the bearer token, loads the user fresh from the DB (so role
// changes take effect immediately), and attaches it to req.user.
// 401 = not authenticated (missing/invalid/expired token) — the client should
// re-login. 403 = authenticated but not allowed.
async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    let payload;
    try {
      payload = verifyToken(header.slice(7));
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await User.findOne({ email: payload.sub });
    if (!user) throw new UnauthorizedException('User not found');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) return next(new AccessDeniedException());
    next();
  };
}

const requireAdmin = requireRole('ADMIN');

module.exports = { requireAuth, requireRole, requireAdmin };
