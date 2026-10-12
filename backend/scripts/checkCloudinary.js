// ── Check the Cloudinary connection ────────────────────────
//   npm run check-cloudinary
// Confirms the three CLOUDINARY_* values in backend/.env, then pings
// Cloudinary and uploads (and deletes) a 1-pixel test image, explaining
// any failure in plain words.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const cloudinary = require('cloudinary').v2;
require('../utils/cloudinary'); // applies the app's own configuration

const HINTS = [
  [/invalid signature/i, 'CLOUDINARY_API_SECRET is wrong. Copy it again from the Cloudinary dashboard (API Keys).'],
  [/unknown api key|invalid api_key|api_key/i, 'CLOUDINARY_API_KEY is wrong. Copy it again from the Cloudinary dashboard.'],
  [/cloud_name|invalid cloud name|404/i, 'CLOUDINARY_CLOUD_NAME is wrong. It is the name shown at the top of your Cloudinary dashboard.'],
  [/stale request|timestamp/i, "Your computer's clock is wrong. Turn on 'Set time automatically' in Windows date and time settings, then try again."],
  [/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|socket hang up/i, 'Cannot reach Cloudinary. Check your internet connection, VPN or firewall.'],
  [/timeout|ETIMEDOUT/i, 'Cloudinary took too long to answer. Your connection may be slow; try again.'],
  [/disabled|suspended|quota|limit/i, 'Your Cloudinary account is restricted (free-plan limit or suspended). Check the Cloudinary dashboard.'],
];
const explain = (msg) => (HINTS.find(([re]) => re.test(msg)) || [null, 'See the message above.'])[1];

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

(async () => {
  const names = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  let missing = false;
  for (const n of names) {
    const raw = process.env[n];
    if (!raw) { console.log(`❌ ${n} is missing from backend/.env`); missing = true; continue; }
    const note = raw !== raw.trim() ? ' (has spaces around it; ignored)' : /^['"]|['"]$/.test(raw.trim()) ? ' (has quotes; ignored)' : '';
    const value = raw.trim().replace(/^['"]|['"]$/g, '');
    const shown = n === 'CLOUDINARY_CLOUD_NAME' ? value : `${value.slice(0, 4)}… (${value.length} characters)`;
    console.log(`✅ ${n} = ${shown}${note}`);
  }
  if (missing) process.exit(1);

  try {
    await cloudinary.api.ping();
    console.log('✅ Cloudinary accepted the credentials');
  } catch (err) {
    const msg = err?.error?.message || err?.message || String(err);
    console.log(`❌ Cloudinary rejected the check: ${msg}\n   → ${explain(msg)}`);
    process.exit(1);
  }

  try {
    const r = await cloudinary.uploader.upload(TINY_PNG, { folder: 'zammarket/check' });
    await cloudinary.uploader.destroy(r.public_id);
    console.log('✅ Test upload worked. Photo uploads should work in the app.');
  } catch (err) {
    const msg = err?.message || err?.error?.message || String(err);
    console.log(`❌ Test upload failed: ${msg}\n   → ${explain(msg)}`);
    process.exit(1);
  }
})();
