const crypto = require('crypto');
const OTP = require('../models/OTP');
const { sendSms, isConsole } = require('./sms');

const TTL_MS = 10 * 60 * 1000;   // a code lasts 10 minutes
const RESEND_MS = 60 * 1000;     // one SMS per phone per minute

// Generate a 6-digit OTP code (cryptographically random)
const generateCode = () => crypto.randomInt(100000, 1000000).toString();

// Create a code and send it by SMS (or to the server log when SMS_PROVIDER=console)
const sendOTP = async (phone) => {
  // Stop repeated taps from sending (and paying for) several messages
  const previous = await OTP.findOne({ phone, verified: false });
  if (previous) {
    const sentAt = previous.expiresAt.getTime() - TTL_MS;
    const wait = Math.ceil((sentAt + RESEND_MS - Date.now()) / 1000);
    if (wait > 0) {
      const err = new Error(`A code was just sent. Wait ${wait} seconds before asking for another.`);
      err.statusCode = 429;
      throw err;
    }
  }

  // Delete any existing OTP for this phone
  await OTP.deleteMany({ phone });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_MS);
  const otp = await OTP.create({ phone, code, expiresAt });

  try {
    const sent = await sendSms(phone, `Your ZamMarket code is ${code}. It expires in 10 minutes. Do not share it.`);
    return { success: true, expiresAt, messageId: sent.messageId, simulated: isConsole() };
  } catch (err) {
    // The user never received this code, so it must not stay valid
    await OTP.deleteOne({ _id: otp._id });
    throw err;
  }
};

// Verify an OTP code
const verifyOTP = async (phone, code) => {
  const otpDoc = await OTP.findOne({ phone, verified: false });

  if (!otpDoc) {
    return { valid: false, reason: 'No OTP found. Request a new code.' };
  }

  if (new Date() > otpDoc.expiresAt) {
    await OTP.deleteOne({ _id: otpDoc._id });
    return { valid: false, reason: 'OTP has expired. Request a new code.' };
  }

  if (otpDoc.attempts >= 3) {
    await OTP.deleteOne({ _id: otpDoc._id });
    return { valid: false, reason: 'Too many attempts. Request a new code.' };
  }

  if (otpDoc.code !== code) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    const remaining = 3 - otpDoc.attempts;
    return { valid: false, reason: `Incorrect code. ${remaining} attempt(s) remaining.` };
  }

  // Mark as verified and remove
  await OTP.deleteOne({ _id: otpDoc._id });
  return { valid: true };
};

module.exports = { sendOTP, verifyOTP };