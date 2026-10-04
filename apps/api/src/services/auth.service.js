const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { BadRequestException } = require('../utils/errors');

function toAuthResponse(user, token) {
  return {
    token,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

// Self-registration always creates a USER. Elevated roles are granted only by
// an ADMIN via PATCH /api/admin/users/:id/role — the client never picks its role.
async function register({ name, email, password }) {
  const exists = await User.exists({ email });
  if (exists) {
    throw new BadRequestException('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: 'USER' });

  const token = generateToken(user.email, user.role);
  return toAuthResponse(user.toJSON(), token);
}

async function login({ email, password }) {
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new BadRequestException('Invalid credentials');
  }

  const token = generateToken(user.email, user.role);
  return toAuthResponse(user.toJSON(), token);
}

module.exports = { register, login };
