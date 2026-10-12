// Send one test SMS with the configured provider.
// Usage (from backend/): npm run test-sms -- 0971234567
require('dotenv').config();
const { sendSms, smsStatus } = require('../utils/sms');

const phone = process.argv[2];
if (!phone) {
  console.log('Usage: npm run test-sms -- 0971234567');
  process.exit(1);
}

console.log(`SMS provider: ${smsStatus()}`);
sendSms(phone, 'ZamMarket test message: SMS is working.')
  .then((r) => { console.log(`✅ Sent (${r.provider}${r.messageId ? `, id ${r.messageId}` : ''})`); })
  .catch((err) => { console.error(`❌ ${err.message}${err.detail ? `\n   Reason: ${err.detail}` : ''}`); process.exit(1); });
