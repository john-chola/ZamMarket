const User = require('../models/User');
const { sendOTP, verifyOTP } = require('../utils/otp');
const { createAuthResponse } = require('../utils/jwt');

// Same rule as the User model
const PHONE_RE = /^(\+260|0)(9[5-7]|7[6-9])\d{7}$/;

// ── POST /api/auth/request-otp ─────────────────────────────
// Step 1 of registration: send OTP to phone number
exports.requestOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ status: 'error', message: 'Phone number is required' });
    if (!PHONE_RE.test(String(phone))) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid Zambian phone number' });
    }
    // Don't spend an SMS on a number that already has an account
    if (await User.exists({ phone })) {
      return res.status(409).json({ status: 'error', message: 'This number is already registered. Log in instead.' });
    }

    const result = await sendOTP(phone);
    res.json({
      status: 'success',
      message: 'OTP sent to your phone number',
      expiresAt: result.expiresAt,
      // With SMS_PROVIDER=console the code is only in the server log
      ...(result.simulated && { devNote: 'Check server console for the OTP code' }),
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/register ────────────────────────────────
// Step 2: verify OTP + create account
exports.register = async (req, res, next) => {
  try {
    const { phone, otp, name, password, role, neighbourhood } = req.body;

    // Validate required fields
    if (!phone || !otp || !name || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone, OTP, name and password are all required',
      });
    }

    // Only buyer and seller accounts can be created here.
    // Admins are created with `npm run create-admin` (scripts/createAdmin.js).
    if (role && !['buyer', 'seller'].includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Role must be buyer or seller' });
    }

    // Check phone not already registered
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({
        status: 'error',
        message: 'This phone number is already registered. Please log in.',
      });
    }

    // Verify the OTP
    const otpResult = await verifyOTP(phone, otp);
    if (!otpResult.valid) {
      return res.status(400).json({ status: 'error', message: otpResult.reason });
    }

    // Create user
    const user = await User.create({
      phone,
      name,
      password,
      role: role || 'buyer',
      neighbourhood: neighbourhood || 'Other',
    });

    createAuthResponse(user, res, 201);
  } catch (err) {
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ status: 'error', message: messages.join('. ') });
    }
    next(err);
  }
};

// ── POST /api/auth/login ───────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ status: 'error', message: 'Phone and password are required' });
    }

    const user = await User.findOne({ phone }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ status: 'error', message: 'Invalid phone number or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ status: 'error', message: 'Account suspended. Contact support.' });
    }

    createAuthResponse(user, res);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ───────────────────────────────────────
// Returns current logged-in user (token required)
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    res.json({ status: 'success', user: user.publicProfile });
  } catch (err) {
    next(err);
  }
};