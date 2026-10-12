// Admin controller rules. Mongoose model methods are stubbed: no database needed.
const assert = require('node:assert/strict');

const User = require('../models/User');
const Listing = require('../models/Listing');
const TrustChain = require('../models/TrustChain');
const AdminLog = require('../models/AdminLog');
const admin = require('../controllers/adminController');
const { createBlock } = require('../utils/blockchain');

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
const chain = (value) => ({ sort: () => chain(value), select: () => chain(value), limit: () => chain(value), then: (r, j) => Promise.resolve(value).then(r, j) });

const originals = [];
const stub = (obj, key, fn) => { originals.push([obj, key, obj[key]]); obj[key] = fn; };
afterEach(() => { for (const [obj, key, fn] of originals.reverse()) obj[key] = fn; originals.length = 0; });

const ADMIN = { _id: '64b0000000000000000000ad', name: 'Site Admin', role: 'admin' };
const req = (params = {}, body = {}) => ({ params, body, user: ADMIN, query: {} });
const seller = (over = {}) => ({
  _id: '64b000000000000000000002', name: 'Mary Banda', role: 'seller', isActive: true,
  sellerProfile: { isVerified: false }, save: async () => {}, ...over,
});
const captureLogs = () => { const logs = []; stub(AdminLog, 'create', async (d) => { logs.push(d); return d; }); return logs; };

describe('verify seller', () => {
  test('a seller already verified cannot be verified again (no second +15)', async () => {
    stub(User, 'findById', async () => seller({ sellerProfile: { isVerified: true } }));
    let blocks = 0;
    stub(TrustChain, 'create', async () => { blocks += 1; });
    const res = mockRes();
    await admin.verifySeller(req({ id: 'x' }), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 409);
    assert.equal(blocks, 0);
  });

  test('a suspended seller cannot be verified', async () => {
    stub(User, 'findById', async () => seller({ isActive: false }));
    const res = mockRes();
    await admin.verifySeller(req({ id: 'x' }), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 400);
  });

  test('verifying adds one trust block and an activity entry', async () => {
    const s = seller();
    stub(User, 'findById', async () => s);
    stub(User, 'findByIdAndUpdate', async () => {});
    const created = [];
    stub(TrustChain, 'findOne', () => chain(null));
    stub(TrustChain, 'create', async (d) => { created.push(d); return d; });
    stub(TrustChain, 'find', () => chain(created));
    const logs = captureLogs();
    const res = mockRes();
    await admin.verifySeller(req({ id: s._id }), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 200);
    assert.equal(s.sellerProfile.isVerified, true);
    assert.equal(created.length, 1);
    assert.equal(created[0].event.type, 'ADMIN_VERIFIED');
    assert.equal(logs[0].action, 'VERIFY_SELLER');
    assert.equal(logs[0].adminName, 'Site Admin');
  });
});

describe('suspend user', () => {
  test('suspending needs a reason', async () => {
    stub(User, 'findById', async () => seller());
    const res = mockRes();
    await admin.suspendUser(req({ id: 'x' }, {}), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 400);
  });

  test('suspending a seller pauses their listings and logs the reason', async () => {
    const s = seller();
    stub(User, 'findById', async () => s);
    let paused = null;
    stub(Listing, 'updateMany', async (filter, update) => { paused = { filter, update }; });
    const logs = captureLogs();
    const res = mockRes();
    await admin.suspendUser(req({ id: s._id }, { reason: 'Fake listings reported by buyers' }), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 200);
    assert.equal(s.isActive, false);
    assert.equal(paused.update.status, 'paused');
    assert.equal(logs[0].action, 'SUSPEND_USER');
    assert.equal(logs[0].detail, 'Fake listings reported by buyers');
  });

  test('reactivating needs no reason', async () => {
    stub(User, 'findById', async () => seller({ isActive: false }));
    const logs = captureLogs();
    const res = mockRes();
    await admin.suspendUser(req({ id: 'x' }, {}), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 200);
    assert.equal(logs[0].action, 'REACTIVATE_USER');
  });

  test('an admin cannot be suspended', async () => {
    stub(User, 'findById', async () => ({ ...ADMIN, isActive: true }));
    const res = mockRes();
    await admin.suspendUser(req({ id: 'x' }, { reason: 'test' }), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 403);
  });
});

describe('change role', () => {
  test("an admin's role cannot be changed", async () => {
    stub(User, 'findById', () => chain({ ...ADMIN, save: async () => {} }));
    const res = mockRes();
    await admin.changeRole(req({ id: 'x' }, { role: 'buyer' }), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 403);
  });

  test('only buyer or seller can be assigned', async () => {
    const res = mockRes();
    await admin.changeRole(req({ id: 'x' }, { role: 'admin' }), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 400);
  });

  test('a role change is logged with from and to', async () => {
    const u = { _id: 'u1', name: 'Chanda', role: 'buyer', save: async () => {} };
    stub(User, 'findById', () => chain(u));
    const logs = captureLogs();
    const res = mockRes();
    await admin.changeRole(req({ id: 'u1' }, { role: 'seller' }), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 200);
    assert.equal(u.role, 'seller');
    assert.equal(logs[0].detail, 'buyer → seller');
  });
});

describe('remove listing', () => {
  test('removing needs a reason', async () => {
    const res = mockRes();
    await admin.removeListing(req({ id: 'l1' }, {}), res, (e) => assert.fail(e));
    assert.equal(res.statusCode, 400);
  });
});

describe('trust integrity check', () => {
  test('flags only the seller whose chain was altered', async () => {
    const build = (sellerId, types) => {
      let prev = '0'.repeat(64);
      return types.map((type, i) => {
        const b = createBlock({ type, sellerId, data: { i } }, prev);
        prev = b.hash;
        return { ...b, seller: { toString: () => sellerId }, blockIndex: i };
      });
    };
    const good = build('s-good', ['LISTING_CREATED', 'BUYER_RATING_5']);
    const bad = build('s-bad', ['LISTING_CREATED', 'BUYER_RATING_1', 'LISTING_CREATED']);
    bad[1].event.type = 'BUYER_RATING_5'; // tampered
    const sellers = [
      { _id: { toString: () => 's-good' }, name: 'Good', trustScore: { chainHash: good[1].hash, score: 60 } },
      { _id: { toString: () => 's-bad' }, name: 'Bad', trustScore: { chainHash: bad[2].hash, score: 49 } },
    ];
    stub(User, 'find', () => chain(sellers));
    stub(TrustChain, 'find', () => chain([...good, ...bad]));
    const res = mockRes();
    await admin.checkTrustIntegrity(req(), res, (e) => assert.fail(e));
    assert.equal(res.body.checked, 2);
    assert.equal(res.body.invalid.length, 1);
    assert.equal(res.body.invalid[0].name, 'Bad');
  });
});
