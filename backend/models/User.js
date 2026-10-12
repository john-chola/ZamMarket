const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^(\+260|0)(9[5-7]|7[6-9])\d{7}$/, 'Enter a valid Zambian phone number'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['buyer', 'seller', 'admin'],
      default: 'buyer',
    },
    neighbourhood: {
      type: String,
      enum: [
        'Kalingalinga', 'Kanyama', 'Mtendere', 'Chilenje',
        'Matero', 'Bauleni', 'Chelstone', 'Woodlands',
        'Kabwata', 'Libala', 'Lusaka_CBD', 'Munali', 'Roma',
        'Lima', 'Mandevu', 'Makeni', 'Chawama', 'Feira',
        'Kafue West', 'Kafue South', 'Chongwe East', 'Chongwe West',
        'Chilanga South', 'Chilanga North', 'Other',
      ],
      default: 'Other',
    },
    sellerProfile: {
      businessName: { type: String, trim: true },
      description: { type: String, maxlength: 300 },
      isVerified: { type: Boolean, default: false },
      totalSales: { type: Number, default: 0 },
      rating: { type: Number, default: 0, min: 0, max: 5 },
      ratingCount: { type: Number, default: 0 },
    },
    trustScore: {
      score: { type: Number, default: 50, min: 0, max: 100 },
      chainHash: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ── Hash password before save ──────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare passwords ─────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Virtual: public profile ────────────────────────────────
// SAFE version — guards against undefined fields
// (phone may be undefined when user is populated with limited select fields)
userSchema.virtual('publicProfile').get(function () {
  const maskedPhone = this.phone
    ? this.phone.replace(/(\+260|0)(\d{2})(\d{4})(\d{3})/, '$1$2****$4')
    : null;

  return {
    id: this._id,
    name: this.name,
    phone: maskedPhone,
    role: this.role,
    neighbourhood: this.neighbourhood,
    sellerProfile: this.sellerProfile,
    trustScore: this.trustScore,
    createdAt: this.createdAt,
  };
});

module.exports = mongoose.model('User', userSchema);