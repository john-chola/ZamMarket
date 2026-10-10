const mongoose = require('mongoose');

// Each document is one block in a seller's trust chain
const trustChainSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blockIndex: { type: Number, required: true },
    timestamp:  { type: String, required: true },
    event: {
      type:     { type: String, required: true }, // LISTING_CREATED, BUYER_RATING_5, etc.
      sellerId: { type: String },
      data:     { type: mongoose.Schema.Types.Mixed },
    },
    previousHash: { type: String, required: true },
    hash:         { type: String, required: true },
  },
  { timestamps: true }
);

// Unique: two events written at the same moment cannot both claim
// the same position (which would fork the chain)
trustChainSchema.index({ seller: 1, blockIndex: 1 }, { unique: true });

module.exports = mongoose.model('TrustChain', trustChainSchema);