const { createBlock, verifyChain, calculateScore, sha256 } = require('../utils/blockchain');

const GENESIS = '0'.repeat(64);

// Builds a chain the same way trustController does: each block links to the previous hash
const buildChain = (types) => {
  const chain = [];
  let prev = GENESIS;
  types.forEach((type, i) => {
    const block = createBlock({ type, sellerId: 'seller1', data: { n: i } }, prev);
    chain.push(block);
    prev = block.hash;
  });
  return chain;
};

describe('createBlock', () => {
  test('produces a 64-character SHA-256 hex hash', () => {
    const block = createBlock({ type: 'LISTING_CREATED', sellerId: 's1', data: {} });
    expect(block.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('uses the genesis hash when there is no previous block', () => {
    const block = createBlock({ type: 'LISTING_CREATED', sellerId: 's1', data: {} });
    expect(block.previousHash).toBe(GENESIS);
  });

  test('hash equals the SHA-256 of the block contents', () => {
    const { hash, ...contents } = createBlock({ type: 'LISTING_CREATED', sellerId: 's1', data: {} });
    expect(sha256(contents)).toBe(hash);
  });
});

describe('verifyChain', () => {
  test('an empty chain is valid', () => {
    expect(verifyChain([])).toBe(true);
  });

  test('an untouched chain is valid', () => {
    const chain = buildChain(['LISTING_CREATED', 'BUYER_RATING_5', 'BUYER_RATING_4']);
    expect(verifyChain(chain)).toBe(true);
  });

  test('TC-13: detects a rating changed after it was recorded', () => {
    const chain = buildChain(['LISTING_CREATED', 'BUYER_RATING_5', 'BUYER_RATING_4']);
    chain[1].event.type = 'BUYER_RATING_1'; // tamper: 5 stars -> 1 star
    expect(verifyChain(chain)).toBe(false);
  });

  test('detects tampering with the data inside a block', () => {
    const chain = buildChain(['LISTING_CREATED', 'BUYER_RATING_5']);
    chain[0].event.data.n = 999;
    expect(verifyChain(chain)).toBe(false);
  });

  test('detects a removed block (broken link)', () => {
    const chain = buildChain(['LISTING_CREATED', 'BUYER_RATING_5', 'BUYER_RATING_4']);
    chain.splice(1, 1);
    expect(verifyChain(chain)).toBe(false);
  });

  test('rejects a first block that does not start from the genesis hash', () => {
    const block = createBlock({ type: 'LISTING_CREATED', sellerId: 's1', data: {} }, 'not-genesis');
    expect(verifyChain([block])).toBe(false);
  });

  test('regression: still valid when blocks carry extra database fields', () => {
    // Mongoose adds _id, seller, blockIndex, timestamps and __v to stored blocks.
    // Earlier, spreading these into the hash made every chain report invalid.
    const chain = buildChain(['LISTING_CREATED', 'BUYER_RATING_5']).map((b, i) => ({
      ...b, _id: `id${i}`, seller: 'seller1', blockIndex: i,
      createdAt: new Date(), updatedAt: new Date(), __v: 0,
    }));
    expect(verifyChain(chain)).toBe(true);
  });
});

describe('calculateScore', () => {
  const score = (types) => calculateScore(buildChain(types));

  test('a seller with no events starts at 50', () => {
    expect(calculateScore([])).toBe(50);
  });

  test('a listing adds 2', () => {
    expect(score(['LISTING_CREATED'])).toBe(52);
  });

  test('a 5-star rating adds 8', () => {
    expect(score(['BUYER_RATING_5'])).toBe(58);
  });

  test('a 1-star rating subtracts 5', () => {
    expect(score(['BUYER_RATING_1'])).toBe(45);
  });

  test('the score never exceeds 100', () => {
    expect(score(Array(10).fill('ADMIN_VERIFIED'))).toBe(100);
  });

  test('the score never drops below 0', () => {
    expect(score(Array(20).fill('BUYER_RATING_1'))).toBe(0);
  });

  test('unknown event types do not change the score', () => {
    expect(score(['SOMETHING_ELSE'])).toBe(50);
  });
});