const crypto = require('crypto');

// ── Simple SHA-256 hash chain ──────────────────────────────
// Not a distributed ledger — a tamper-evident linked chain
// Each block contains: event data + hash of previous block
// If any block is modified, all subsequent hashes become invalid

const sha256 = (data) =>
  crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

// Create a new block for the chain
const createBlock = (event, previousHash = '0'.repeat(64)) => {
  const block = {
    timestamp: new Date().toISOString(),
    event,          // { type, sellerId, data }
    previousHash,
  };
  block.hash = sha256(block);
  return block;
};

// ── Verify the entire chain is intact (tamper detection) ──
// IMPORTANT: blocks retrieved from MongoDB are Mongoose documents,
// not plain objects. Spreading them (`{...block}`) pulls in extra
// fields that were never part of the original hash — _id, seller,
// blockIndex, createdAt, updatedAt, __v, Mongoose internals — which
// makes the recomputed hash never match, even with zero tampering.
//
// Fix: explicitly rebuild the SAME shape that was hashed at
// creation time in createBlock() — only {timestamp, event, previousHash}
// — before recomputing. Works whether `blocks` are Mongoose documents
// or plain lean objects, since we access fields by dot notation.
const verifyChain = (blocks) => {
  if (!blocks || blocks.length === 0) return true;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Reconstruct the exact canonical shape used at creation time
    const canonical = {
      timestamp: block.timestamp,
      event: {
        type:     block.event?.type,
        sellerId: block.event?.sellerId,
        data:     block.event?.data,
      },
      previousHash: block.previousHash,
    };

    const recomputed = sha256(canonical);
    if (recomputed !== block.hash) {
      return false; // this block's content doesn't match its own hash
    }

    if (i === 0) {
      // First block must chain from the genesis hash
      if (block.previousHash !== '0'.repeat(64)) return false;
    } else {
      // Every other block must link to the previous block's hash
      const previous = blocks[i - 1];
      if (block.previousHash !== previous.hash) return false;
    }
  }
  return true;
};

// Calculate trust score from a chain of events
const calculateScore = (blocks) => {
  if (!blocks || blocks.length === 0) return 50; // default score

  let score = 50;
  for (const block of blocks) {
    switch (block.event?.type) {
      case 'LISTING_CREATED':    score += 2;  break; // +2 per listing
      case 'BUYER_RATING_5':     score += 8;  break; // +8 for 5-star rating
      case 'BUYER_RATING_4':     score += 5;  break;
      case 'BUYER_RATING_3':     score += 2;  break;
      case 'BUYER_RATING_1':     score -= 5;  break; // -5 for bad rating
      case 'ADMIN_VERIFIED':     score += 15; break; // +15 for admin verification
      default: break;
    }
  }
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, score));
};

module.exports = { createBlock, verifyChain, calculateScore, sha256 };