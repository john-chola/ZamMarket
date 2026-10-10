// ── Create or promote an administrator ─────────────────────
// Admins cannot sign up through the app (by design), so the first
// admin is created from the command line:
//
//   npm run create-admin -- --phone 0971234567 --name "Site Admin" --password "S3cure!pass"
//
// If the phone number is already registered, that account is
// promoted to admin (its password is only changed if --password
// is given). Uses MONGODB_URI from backend/.env.

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

const readArg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

(async () => {
  const phone    = readArg('phone')    || process.env.ADMIN_PHONE;
  const name     = readArg('name')     || process.env.ADMIN_NAME || 'ZamMarket Admin';
  const password = readArg('password') || process.env.ADMIN_PASSWORD;

  if (!process.env.MONGODB_URI) fail('MONGODB_URI is not set in backend/.env');
  if (!phone) fail('Give a phone number: --phone 0971234567');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to database "${mongoose.connection.name}"`);

  try {
    let user = await User.findOne({ phone }).select('+password');

    if (user) {
      user.role = 'admin';
      user.isActive = true;
      if (password) user.password = password; // re-hashed by the pre-save hook
      await user.save();
      console.log(`✅ ${user.name} (${phone}) is now an admin`);
    } else {
      if (!password) fail('New admin needs a password: --password "at least 6 characters"');
      user = await User.create({ phone, name, password, role: 'admin', neighbourhood: 'Other' });
      console.log(`✅ Created admin ${user.name} (${phone})`);
    }
    console.log('Log in through the app with this phone number and password, then open /admin.');
  } catch (err) {
    if (err.name === 'ValidationError') {
      fail(Object.values(err.errors).map((e) => e.message).join('. '));
    }
    fail(err.message);
  } finally {
    await mongoose.disconnect();
  }
})();
