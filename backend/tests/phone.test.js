// Phone numbers: one stored form, and login with either form.
const assert = require('node:assert/strict');

const User = require('../models/User');
const auth = require('../controllers/authController');
const { normalizePhone, isValidPhone, phoneVariants } = require('../utils/phone');

const originals = [];
const stub = (obj, key, fn) => { originals.push([obj, key, obj[key]]); obj[key] = fn; };
afterEach(() => { for (const [obj, key, fn] of originals.reverse()) obj[key] = fn; originals.length = 0; });

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.cookie = () => res;
  return res;
};

test('numbers are normalised to +260', () => {
  assert.equal(normalizePhone('0770824729'), '+260770824729');
  assert.equal(normalizePhone('077 082 4729'), '+260770824729');
  assert.equal(normalizePhone('260770824729'), '+260770824729');
  assert.equal(normalizePhone('+260770824729'), '+260770824729');
  assert.ok(isValidPhone('0960000001'));
  assert.ok(!isValidPhone('0123456789'));
  assert.deepEqual(phoneVariants('0960000001'), ['+260960000001', '0960000001']);
});

test('the User model stores the +260 form', async () => {
  const u = new User({ phone: '0770824729', name: 'Test User', password: 'secret123' });
  await u.validate();
  assert.equal(u.phone, '+260770824729');
});

test('login finds an account whichever form was typed or stored', async () => {
  let query = null;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const account = { _id: 'u1', phone: '+260770824729', isActive: true, comparePassword: async () => true, toPublicJSON: () => ({}) };
  stub(User, 'findOne', (q) => { query = q; return { select: async () => account }; });
  const res = mockRes();
  await auth.login({ body: { phone: '0770 824 729', password: 'secret123' } }, res, (e) => assert.fail(e));
  assert.deepEqual(query.phone.$in, ['+260770824729', '0770824729']);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.token);
});
