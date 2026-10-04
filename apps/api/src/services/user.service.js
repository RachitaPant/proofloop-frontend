const User = require('../models/User');
const { ResourceNotFoundException, BadRequestException } = require('../utils/errors');

async function listUsers() {
  const users = await User.find().sort({ createdAt: 1 });
  return users.map((u) => u.toJSON());
}

// The only way to grant REVIEWER/ADMIN — self-registration always yields USER.
async function updateRole(actingAdmin, userId, role) {
  if (actingAdmin.id === userId) {
    throw new BadRequestException('You cannot change your own role');
  }
  const user = await User.findById(userId).catch(() => null);
  if (!user) throw new ResourceNotFoundException('User not found');

  user.role = role;
  await user.save();
  return user.toJSON();
}

module.exports = { listUsers, updateRole };
