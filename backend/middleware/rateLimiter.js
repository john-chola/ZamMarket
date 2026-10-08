const rateLimit = require('express-rate-limit');

// Strict limiter for OTP requests (prevent abuse / SMS cost)
exports.otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  message: { status: 'error', message: 'Too many OTP requests. Try again in 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General auth limiter (login attempts)
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { status: 'error', message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Account creation (limits fake-account sign-ups from one IP)
exports.registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { status: 'error', message: 'Too many sign-up attempts. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});
