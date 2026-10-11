// Controller and middleware tests. Mongoose model methods are replaced
// with stubs, so these run without a database.
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const User = require('../models/User');
const TrustChain = require('../models/TrustChain');
const Conversation = require('../models/Conversation');
const { protect, restrictTo } = require('../middleware/auth');
const authController = require('../controllers/authController');
const { addTrustEvent, rateSeller } = require('../controllers/trustController');
const { createBlock } = require('../utils/blockchain');

// ── helpers ────────────────────────────────────────────────
const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
const chain = (value) => ({ sort: () => chain(value), select: () => chain(value), then: (r, j) => Promise.resolve(value).then(r, j) });

const originals = [];
const stub = (obj, key, fn) => { originals.push([obj, key, obj[key]]); obj[key] = fn; };
beforeEach(() => { originals.length = 0; });
afterEach(() => { for (const [obj, key, fn] of originals.reverse()) obj[key] = fn; });

const BUYER = '64b000000000000000000001';
const SELLER = '64b000000000000000000002';
const CONV1 = '64b0000000000000000000c1';
const CONV2 = '64b0000000000000000000c2';

// ── auth middleware ────────────────────────────────────────
test('protect: missing token → 401', async () => {
  const res = mockRes();
  await protect({ headers: {} }, res, () => assert.fail('next called'));
  assert.equal(res.statusCode, 401);
});

test('protect: bad token → 401', async () => {
  const res = mockRes();
  await protect({ headers: { authorization: 'Bearer nonsense' } }, res, () => assert.fail('next called'));
  assert.equal(res.statusCode, 401);
});

test('protect: valid token for a suspended user → 401', async () => {
  stub(User, 'findById', async () => ({ _id: BUYER, isActive: false }));
  const token = jwt.sign({ id: BUYER }, process.env.JWT_SECRET);
  const res = mockRes();
  await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail('next called'));
  assert.equal(res.statusCode, 401);
});

test('protect: valid token → next() with req.user', async () => {
  stub(User, 'findById', async () => ({ _id: BUYER, isActive: true, role: 'buyer' }));
  const token = jwt.sign({ id: BUYER }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  let called = false;
  await protect(req, mockRes(), () => { called = true; });
  assert.ok(called);
  assert.equal(req.user.role, 'buyer');
});

test('restrictTo: buyer cannot reach admin routes', () => {
  const res = mockRes();
  restrictTo('admin')({ user: { role: 'buyer' } }, res, () => assert.fail('next called'));
  assert.equal(res.statusCode, 403);
  let called = false;
  restrictTo('admin')({ user: { role: 'admin' } }, mockRes(), () => { called = true; });
  assert.ok(called);
});

// ── registration ───────────────────────────────────────────
test('register: role "admin" is refused', async () => {
  const res = mockRes();
  await authController.register(
    { body: { phone: '0971234567', otp: '123456', name: 'Eve', password: 'secret123', role: 'admin' } },
    res, (e) => assert.fail(e)
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /buyer or seller/);
});

test('register: missing fields → 400', async () => {
  const res = mockRes();
  await authController.register({ body: { phone: '0971234567' } }, res, (e) => assert.fail(e));
  assert.equal(res.statusCode, 400);
});

// ── trust events ───────────────────────────────────────────
test('addTrustEvent retries when another event took the same position', async () => {
  const head = createBlock({ type: 'LISTING_CREATED', sellerId: SELLER, data: {} });
  const stored = [{ ...head, blockIndex: 0 }];
  let createCalls = 0;
  let savedHash = null;

  stub(TrustChain, 'findOne', () => chain(stored[stored.length - 1]));
  stub(TrustChain, 'create', async (doc) => {
    createCalls += 1;
    if (createCalls === 1) {
      // Simulate a concurrent write that won the race for index 1
      const rival = createBlock({ type: 'LISTING_CREATED', sellerId: SELLER, data: { rival: true } }, head.hash);
      stored.push({ ...rival, blockIndex: 1 });
      const err = new Error('E11000 duplicate key'); err.code = 11000; throw err;
    }
    stored.push(doc);
    return doc;
  });
  stub(TrustChain, 'find', () => chain(stored));
  stub(User, 'findByIdAndUpdate', async (_id, update) => { savedHash = update['trustScore.chainHash']; });

  const result = await addTrustEvent(SELLER, 'BUYER_RATING_5', { buyerId: BUYER });
  assert.equal(result.success, true);
  assert.equal(createCalls, 2);
  assert.equal(stored[2].blockIndex, 2, 'appended after the rival block');
  assert.equal(stored[2].previousHash, stored[1].hash, 'linked to the rival block');
  assert.equal(savedHash, stored[2].hash);
  assert.equal(result.score, 50 + 2 + 2 + 8);
});

// ── rating rules ───────────────────────────────────────────
const rateReq = (body) => ({ body: { sellerId: SELLER, ...body }, user: { _id: { toString: () => BUYER } } });

test('rate: invalid stars → 400', async () => {
  for (const rating of [0, 6, 2.5, 'abc', undefined]) {
    const res = mockRes();
    await rateSeller(rateReq({ rating }), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 400, `rating ${rating}`);
  }
});

test('rate: rating yourself → 400', async () => {
  const res = mockRes();
  await rateSeller({ body: { sellerId: BUYER, rating: 5 }, user: { _id: { toString: () => BUYER } } }, res, (e) => assert.fail(e));
  assert.equal(res.statusCode, 400);
});

test('rate: no conversation with the seller → 403', async () => {
  stub(Conversation, 'exists', async () => null);
  const res = mockRes();
  await rateSeller(rateReq({ rating: 5 }), res, (e) => assert.fail(e));
  assert.equal(res.statusCode, 403);
});

test('rate: every conversation already rated → 409', async () => {
  stub(Conversation, 'exists', async () => ({ _id: CONV1 }));
  stub(Conversation, 'find', () => chain([{ _id: { toString: () => CONV1 } }]));
  stub(TrustChain, 'distinct', async () => [CONV1]);
  const res = mockRes();
  await rateSeller(rateReq({ rating: 5 }), res, (e) => assert.fail(e));
  assert.equal(res.statusCode, 409);
});

test('rate: a second purchase (new conversation) can be rated', async () => {
  stub(Conversation, 'exists', async () => ({ _id: CONV1 }));
  stub(Conversation, 'find', () => chain([{ _id: { toString: () => CONV1 } }, { _id: { toString: () => CONV2 } }]));
  stub(TrustChain, 'distinct', async () => [CONV1]);
  stub(TrustChain, 'findOne', () => chain(null));
  let created = null;
  stub(TrustChain, 'create', async (doc) => { created = doc; return doc; });
  stub(TrustChain, 'find', () => chain(created ? [created] : []));
  stub(User, 'findByIdAndUpdate', async () => {});
  stub(User, 'findById', async () => ({ sellerProfile: { rating: 0, ratingCount: 0 } }));

  const res = mockRes();
  await rateSeller(rateReq({ rating: 4, conversationId: CONV2 }), res, (e) => assert.fail(e));
  assert.equal(res.statusCode, 200);
  assert.equal(created.event.type, 'BUYER_RATING_4');
  assert.equal(created.event.data.conversationId, CONV2);
});
