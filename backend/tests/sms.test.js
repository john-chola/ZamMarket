// SMS gateway and OTP sending. fetch and the OTP model are stubbed: nothing is sent.
const assert = require('node:assert/strict');

const OTP = require('../models/OTP');
const { sendSms, smsStatus, toInternational } = require('../utils/sms');
const { sendOTP } = require('../utils/otp');

const KEYS = ['SMS_PROVIDER', 'AT_USERNAME', 'AT_API_KEY', 'AT_SENDER_ID', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'];
const saved = {};
const originals = [];
const stub = (obj, key, fn) => { originals.push([obj, key, obj[key]]); obj[key] = fn; };
let calls;

beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  calls = [];
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  for (const [obj, key, fn] of originals.reverse()) obj[key] = fn;
  originals.length = 0;
  jest.restoreAllMocks();
});

const fakeFetch = (status, body) => stub(global, 'fetch', async (url, opts) => {
  calls.push({ url, opts, form: new URLSearchParams(opts.body) });
  return { ok: status < 400, status, text: async () => JSON.stringify(body) };
});
const atOk = { SMSMessageData: { Message: 'Sent to 1/1', Recipients: [{ statusCode: 101, status: 'Success', messageId: 'ATX1', number: '+260971234567' }] } };

describe('phone numbers', () => {
  test('local and international forms become +260', () => {
    assert.equal(toInternational('0971234567'), '+260971234567');
    assert.equal(toInternational('+260971234567'), '+260971234567');
    assert.equal(toInternational('260971234567'), '+260971234567');
    assert.equal(toInternational('097 123 4567'), '+260971234567');
  });
});

describe('Africa\'s Talking', () => {
  beforeEach(() => {
    process.env.SMS_PROVIDER = 'africastalking';
    process.env.AT_USERNAME = 'zammarket';
    process.env.AT_API_KEY = 'key123';
  });

  test('sends to the live API in international format', async () => {
    fakeFetch(201, atOk);
    const r = await sendSms('0971234567', 'hello');
    assert.equal(r.messageId, 'ATX1');
    assert.equal(calls[0].url, 'https://api.africastalking.com/version1/messaging');
    assert.equal(calls[0].opts.headers.apiKey, 'key123');
    assert.equal(calls[0].form.get('to'), '+260971234567');
    assert.equal(calls[0].form.get('username'), 'zammarket');
    assert.equal(calls[0].form.get('from'), null);
  });

  test('the sandbox username uses the sandbox API; sender ID is passed when set', async () => {
    process.env.AT_USERNAME = 'sandbox';
    process.env.AT_SENDER_ID = 'ZamMarket';
    fakeFetch(201, atOk);
    await sendSms('0971234567', 'hello');
    assert.match(calls[0].url, /api\.sandbox\.africastalking\.com/);
    assert.equal(calls[0].form.get('from'), 'ZamMarket');
  });

  test('a rejected recipient is an error', async () => {
    fakeFetch(201, { SMSMessageData: { Recipients: [{ statusCode: 405, status: 'InsufficientBalance' }] } });
    await assert.rejects(sendSms('0971234567', 'x'), (e) => e.statusCode === 502 && e.detail === 'InsufficientBalance');
  });

  test('missing credentials are reported before any request', async () => {
    delete process.env.AT_API_KEY;
    fakeFetch(201, atOk);
    await assert.rejects(sendSms('0971234567', 'x'), /not set up/);
    assert.equal(calls.length, 0);
    assert.match(smsStatus(), /missing AT_API_KEY/);
  });
});

describe('Twilio', () => {
  test('sends with basic auth and reports Twilio errors', async () => {
    Object.assign(process.env, { SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM: '+15550001111' });
    fakeFetch(201, { sid: 'SM1' });
    const r = await sendSms('0971234567', 'hello');
    assert.equal(r.messageId, 'SM1');
    assert.equal(calls[0].opts.headers.Authorization, `Basic ${Buffer.from('AC1:tok').toString('base64')}`);
    assert.equal(calls[0].form.get('To'), '+260971234567');

    fakeFetch(400, { message: 'The number is unverified' });
    await assert.rejects(sendSms('0971234567', 'x'), (e) => e.detail === 'The number is unverified');
  });
});

describe('sending an OTP', () => {
  const otpStore = () => {
    const docs = [];
    stub(OTP, 'findOne', async () => docs[0] || null);
    stub(OTP, 'deleteMany', async () => { docs.length = 0; });
    stub(OTP, 'create', async (d) => { const doc = { _id: 'o1', ...d }; docs.push(doc); return doc; });
    stub(OTP, 'deleteOne', async () => { docs.length = 0; });
    return docs;
  };

  test('the SMS carries the stored 6-digit code', async () => {
    Object.assign(process.env, { SMS_PROVIDER: 'africastalking', AT_USERNAME: 'zammarket', AT_API_KEY: 'k' });
    const docs = otpStore();
    fakeFetch(201, atOk);
    const r = await sendOTP('0971234567');
    assert.equal(r.simulated, false);
    assert.match(docs[0].code, /^\d{6}$/);
    assert.ok(calls[0].form.get('message').includes(docs[0].code));
  });

  test('if the SMS fails, the code is deleted', async () => {
    Object.assign(process.env, { SMS_PROVIDER: 'africastalking', AT_USERNAME: 'zammarket', AT_API_KEY: 'k' });
    const docs = otpStore();
    fakeFetch(500, {});
    await assert.rejects(sendOTP('0971234567'));
    assert.equal(docs.length, 0);
  });

  test('a second request within a minute is refused without sending', async () => {
    const docs = otpStore();
    docs.push({ _id: 'old', phone: '0971234567', expiresAt: new Date(Date.now() + 10 * 60 * 1000 - 5000) });
    fakeFetch(201, atOk);
    await assert.rejects(sendOTP('0971234567'), (e) => e.statusCode === 429);
    assert.equal(calls.length, 0);
  });

  test('console mode is the default and marks the code as simulated', async () => {
    otpStore();
    const r = await sendOTP('0971234567');
    assert.equal(r.simulated, true);
  });
});
