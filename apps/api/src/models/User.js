const { Schema, model } = require('mongoose');

// Mirrors com.proofloop.entity.User / collection "users"
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['USER', 'REVIEWER', 'ADMIN'], required: true },
  },
  {
    collection: 'users',
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
      },
    },
  },
);

module.exports = model('User', userSchema);
