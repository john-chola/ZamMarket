const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { otpLimiter, authLimiter, registerLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/request-otp', otpLimiter, authController.requestOTP);
router.post('/register', registerLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// Protected routes (JWT required)
router.get('/me', protect, authController.getMe);

module.exports = router;