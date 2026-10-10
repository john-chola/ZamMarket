const TrustChain    = require('../models/TrustChain');
const User          = require('../models/User');
const Listing       = require('../models/Listing');
const Conversation  = require('../models/Conversation');
const { createBlock, verifyChain, calculateScore } = require('../utils/blockchain');

// ── Internal: add event to a seller's chain ───────────────
// If two events for the same seller arrive at once, both may read the
// same last block. The unique (seller, blockIndex) index rejects the
// second write, so we re-read the chain head and try again.
const MAX_APPEND_ATTEMPTS = 5;

const addTrustEvent = async (sellerId, eventType, eventData = {}) => {
  for (let attempt = 1; attempt <= MAX_APPEND_ATTEMPTS; attempt++) {
    try {
      const lastBlock    = await TrustChain.findOne({ seller: sellerId }).sort({ blockIndex: -1 });
      const previousHash = lastBlock ? lastBlock.hash : '0'.repeat(64);
      const blockIndex   = lastBlock ? lastBlock.blockIndex + 1 : 0;

      const block = createBlock(
        { type: eventType, sellerId: sellerId.toString(), data: eventData },
        previousHash
      );

      await TrustChain.create({
        seller: sellerId, blockIndex,
        timestamp: block.timestamp, event: block.event,
        previousHash: block.previousHash, hash: block.hash,
      });

      const allBlocks = await TrustChain.find({ seller: sellerId }).sort({ blockIndex: 1 });
      const newScore  = calculateScore(allBlocks);
      const headHash  = allBlocks[allBlocks.length - 1].hash;

      await User.findByIdAndUpdate(sellerId, {
        'trustScore.score':     newScore,
        'trustScore.chainHash': headHash,
      });

      return { success: true, score: newScore, block };
    } catch (err) {
      if (err.code === 11000 && attempt < MAX_APPEND_ATTEMPTS) continue; // lost the race — retry
      console.error('addTrustEvent error:', err.message);
      return { success: false };
    }
  }
  return { success: false };
};

// Conversations between this buyer and seller that have not been rated yet
const findUnratedConversations = async (buyerId, sellerId) => {
  const conversations = await Conversation.find({ buyer: buyerId, seller: sellerId }).select('_id');
  if (conversations.length === 0) return [];
  const rated = await TrustChain.distinct('event.data.conversationId', {
    seller: sellerId,
    'event.type': { $regex: /^BUYER_RATING/ },
    'event.data.buyerId': buyerId.toString(),
  });
  const ratedSet = new Set(rated.map(String));
  return conversations.filter((c) => !ratedSet.has(c._id.toString()));
};

// Verify against the head hash stored on the User and recompute the
// score from the chain itself, so editing the stored score has no effect
const describeChain = (seller, blocks) => {
  const isValid = verifyChain(blocks, seller.trustScore?.chainHash || '');
  return { blocks, length: blocks.length, isValid, score: calculateScore(blocks) };
};

// ── GET /api/trust/:sellerId ──────────────────────────────
const getTrustChain = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    if (!sellerId || sellerId === 'undefined') {
      return res.status(400).json({ status: 'error', message: 'Invalid seller ID' });
    }

    const seller = await User.findById(sellerId)
      .select('name trustScore sellerProfile neighbourhood role');
    if (!seller) {
      return res.status(404).json({ status: 'error', message: 'Seller not found' });
    }

    if (seller.role === 'buyer') {
      return res.status(400).json({
        status: 'error',
        message: 'Trust scores are only available for sellers',
      });
    }

    const blocks = await TrustChain.find({ seller: sellerId }).sort({ blockIndex: 1 });

    // Auto-backfill existing listings for sellers who registered before Sprint 3.
    // Skipped if a head hash was recorded: then an empty chain means deletion.
    if (blocks.length === 0 && seller.role === 'seller' && !seller.trustScore?.chainHash) {
      const listings = await Listing.find({ seller: sellerId });
      for (const listing of listings) {
        await addTrustEvent(sellerId, 'LISTING_CREATED', {
          listingId: listing._id,
          title: listing.title,
        });
      }
      if (listings.length > 0) {
        const freshBlocks = await TrustChain.find({ seller: sellerId }).sort({ blockIndex: 1 });
        const freshSeller = await User.findById(sellerId)
          .select('name trustScore sellerProfile neighbourhood role');
        const freshChain  = describeChain(freshSeller, freshBlocks);
        return res.json({
          status: 'success',
          seller: {
            id: freshSeller._id, name: freshSeller.name,
            neighbourhood: freshSeller.neighbourhood,
            trustScore: { score: freshChain.score, chainHash: freshSeller.trustScore?.chainHash || '' },
            isVerified: freshSeller.sellerProfile?.isVerified,
            role: freshSeller.role,
          },
          chain: freshChain,
          canRate: false,
        });
      }
    }

    // Check if requesting user has had a conversation with this seller
    // Used by frontend to show/hide the rating widget
    let canRate = false;
    if (req.headers.authorization) {
      try {
        const jwt     = require('jsonwebtoken');
        const token   = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const buyerId = decoded.id;

        // Can rate if not rating yourself and at least one
        // conversation with this seller has not been rated yet
        if (buyerId !== sellerId) {
          canRate = (await findUnratedConversations(buyerId, sellerId)).length > 0;
        }
      } catch {
        canRate = false;
      }
    }

    const chain = describeChain(seller, blocks);
    res.json({
      status: 'success',
      seller: {
        id: seller._id, name: seller.name,
        neighbourhood: seller.neighbourhood,
        trustScore: { score: chain.score, chainHash: seller.trustScore?.chainHash || '' },
        isVerified: seller.sellerProfile?.isVerified,
        role: seller.role,
      },
      chain,
      canRate, // ← tells frontend whether to show rating widget
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/trust/check-conversation/:sellerId ────────────
// Legacy endpoint for explicit conversation checking (if needed)
const checkConversationWithSeller = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const buyerId = req.user._id;

    if (!sellerId || sellerId === 'undefined') {
      return res.status(400).json({ status: 'error', message: 'Invalid seller ID' });
    }

    if (buyerId.toString() === sellerId.toString()) {
      return res.status(400).json({ status: 'error', message: 'Cannot check conversation with yourself' });
    }

    const hasConversation = !!(await Conversation.exists({ buyer: buyerId, seller: sellerId }));
    const canRate = hasConversation && (await findUnratedConversations(buyerId, sellerId)).length > 0;

    res.json({
      status: 'success',
      hasConversation,
      canRate,
      message: canRate
        ? 'You can rate this seller'
        : hasConversation
          ? 'You have already rated this seller for each conversation'
          : 'You must complete a conversation to rate this seller',
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/trust/rate ──────────���───────────────────────
const rateSeller = async (req, res, next) => {
  try {
    const { sellerId, rating, conversationId } = req.body;

    if (!sellerId || sellerId === 'undefined') {
      return res.status(400).json({ status: 'error', message: 'sellerId is required' });
    }
    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ status: 'error', message: 'Rating must be a whole number from 1 to 5' });
    }

    // Prevent self-rating
    if (req.user._id.toString() === sellerId.toString()) {
      return res.status(400).json({ status: 'error', message: 'You cannot rate yourself' });
    }

    // VALIDATION: the rating must belong to a real conversation between
    // this buyer and this seller. One rating per conversation (i.e. per
    // listing the buyer contacted the seller about).
    const hasAnyConversation = await Conversation.exists({ buyer: req.user._id, seller: sellerId });
    if (!hasAnyConversation) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only rate sellers you have had a conversation with',
      });
    }

    const unrated = await findUnratedConversations(req.user._id, sellerId);
    const conversation = conversationId
      ? unrated.find((c) => c._id.toString() === String(conversationId))
      : unrated[0];

    if (!conversation) {
      return res.status(409).json({
        status: 'error',
        message: 'You have already rated this seller for this purchase',
      });
    }

    const eventType = `BUYER_RATING_${stars}`;
    const result    = await addTrustEvent(sellerId, eventType, {
      rating:         stars,
      buyerId:        req.user._id.toString(),
      conversationId: conversation._id.toString(),
    });
    if (!result.success) {
      return res.status(500).json({ status: 'error', message: 'Could not record the rating. Please try again.' });
    }

    // Update seller's average rating
    const seller = await User.findById(sellerId);
    if (seller) {
      const oldTotal  = (seller.sellerProfile?.rating || 0) * (seller.sellerProfile?.ratingCount || 0);
      const newCount  = (seller.sellerProfile?.ratingCount || 0) + 1;
      const newRating = (oldTotal + stars) / newCount;
      await User.findByIdAndUpdate(sellerId, {
        'sellerProfile.rating':      Math.round(newRating * 10) / 10,
        'sellerProfile.ratingCount': newCount,
      });
    }

    res.json({ status: 'success', newScore: result.score, message: 'Rating recorded on blockchain' });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/trust/verify-chain ──────────────────────────
const verifySellerChain = async (req, res, next) => {
  try {
    const { sellerId } = req.body;
    const seller = await User.findById(sellerId).select('trustScore');
    if (!seller) return res.status(404).json({ status: 'error', message: 'Seller not found' });
    const blocks  = await TrustChain.find({ seller: sellerId }).sort({ blockIndex: 1 });
    const isValid = verifyChain(blocks, seller.trustScore?.chainHash || '');
    res.json({ status: 'success', isValid, blockCount: blocks.length });
  } catch (err) {
    next(err);
  }
};

module.exports = { addTrustEvent, getTrustChain, rateSeller, verifySellerChain, checkConversationWithSeller };
