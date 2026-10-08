// Run with: npm test (from backend/)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBlock, verifyChain, calculateScore, sha256 } = require('../utils/blockchain');

const GENESIS = '0'.repeat(64);
const build = (types) => {
  const blocks = [];
  let prev = GENESIS;
  types.forEach((type, i) => {
    const b = createBlock({ type, sellerId: 's1', data: { i } }, prev);
    blocks.push(b);
    prev = b.hash;
  });
  return blocks;
};
const rehash = (block) => {
  const { hash, ...rest } = block;
  block.hash = sha256(rest);
};

test('empty chain is valid and scores 50', () => {
  assert.equal(verifyChain([]), true);
  assert.equal(calculateScore([]), 50);
});

test('intact chain verifies, with and without the head hash', () => {
  const c = build(['LISTING_CREATED', 'BUYER_RATING_5', 'ADMIN_VERIFIED']);
  assert.equal(verifyChain(c), true);
  assert.equal(verifyChain(c, c[2].hash), true);
});

test('edited, deleted and reordered blocks are detected', () => {
  const edited = build(['LISTING_CREATED', 'BUYER_RATING_1', 'LISTING_CREATED']);
  edited[1].event.type = 'BUYER_RATING_5';
  assert.equal(verifyChain(edited), false);

  const rehashed = build(['LISTING_CREATED', 'BUYER_RATING_1', 'LISTING_CREATED']);
  rehashed[1].event.type = 'BUYER_RATING_5';
  rehash(rehashed[1]);
  assert.equal(verifyChain(rehashed), false);

  const deleted = build(['LISTING_CREATED', 'BUYER_RATING_1', 'LISTING_CREATED']);
  deleted.splice(1, 1);
  assert.equal(verifyChain(deleted), false);

  const swapped = build(['LISTING_CREATED', 'BUYER_RATING_5', 'LISTING_CREATED']);
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.equal(verifyChain(swapped), false);
});

test('an edited LAST block is caught only with the stored head hash', () => {
  const c = build(['LISTING_CREATED', 'BUYER_RATING_1']);
  const headHash = c[1].hash;
  c[1].event.type = 'BUYER_RATING_5';
  rehash(c[1]);
  assert.equal(verifyChain(c), true, 'links alone cannot see this');
  assert.equal(verifyChain(c, headHash), false);
});

test('a deleted last block or a wiped chain is caught with the head hash', () => {
  const c = build(['LISTING_CREATED', 'BUYER_RATING_1']);
  const headHash = c[1].hash;
  assert.equal(verifyChain(c.slice(0, 1), headHash), false);
  assert.equal(verifyChain([], headHash), false);
});

test('database fields added by MongoDB do not cause false alarms', () => {
  const c = build(['LISTING_CREATED', 'BUYER_RATING_4'])
    .map((b, i) => ({ ...b, _id: `id${i}`, blockIndex: i, __v: 0, createdAt: new Date() }));
  assert.equal(verifyChain(c, c[1].hash), true);
});

test('score weights and clamping', () => {
  assert.equal(calculateScore(build(['LISTING_CREATED', 'LISTING_CREATED', 'BUYER_RATING_5', 'ADMIN_VERIFIED'])), 77);
  assert.equal(calculateScore(build(['BUYER_RATING_4'])), 55);
  assert.equal(calculateScore(build(['BUYER_RATING_3'])), 52);
  assert.equal(calculateScore(build(['BUYER_RATING_2'])), 48);
  assert.equal(calculateScore(build(['BUYER_RATING_1'])), 45);
  assert.equal(calculateScore(build(Array(10).fill('ADMIN_VERIFIED'))), 100);
  assert.equal(calculateScore(build(Array(20).fill('BUYER_RATING_1'))), 0);
});

test('verifying 1,000 blocks takes well under 100 ms', () => {
  const big = build(Array(1000).fill('LISTING_CREATED'));
  const start = process.hrtime.bigint();
  assert.equal(verifyChain(big, big[999].hash), true);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 100, `took ${ms} ms`);
});
