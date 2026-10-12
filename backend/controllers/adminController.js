const User         = require('../models/User');
const Listing      = require('../models/Listing');
const Conversation = require('../models/Conversation');
const TrustChain   = require('../models/TrustChain');
const AdminLog     = require('../models/AdminLog');
const { addTrustEvent } = require('./trustController');
const { verifyChain, calculateScore } = require('../utils/blockchain');
const { deleteImage } = require('../utils/cloudinary');
const { escapeRegex } = require('../utils/escapeRegex');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REASON = 300;

const cleanReason = (r) => String(r || '').trim().slice(0, MAX_REASON);

// Record an admin action. A failed log write must never block the action itself.
const logAction = async (req, action, targetType, target, detail = '') => {
  try {
    await AdminLog.create({
      admin: req.user._id,
      adminName: req.user.name,
      action,
      targetType,
      targetId: target._id,
      targetName: target.name || target.title || '',
      detail,
    });
  } catch (err) {
    console.error('Admin log write failed:', err.message);
  }
};

// ── GET /api/admin/stats ───────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const weekAgo = new Date(Date.now() - WEEK_MS);
    const [
      totalUsers, totalSellers, totalBuyers, suspended, pendingVerification, newUsers,
      totalListings, activeListings, soldListings, newListings,
      totalConversations, totalBlocks,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'seller' }),
      User.countDocuments({ role: 'buyer' }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ role: 'seller', isActive: true, 'sellerProfile.isVerified': { $ne: true } }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Listing.countDocuments(),
      Listing.countDocuments({ status: 'active' }),
      Listing.countDocuments({ status: 'sold' }),
      Listing.countDocuments({ createdAt: { $gte: weekAgo } }),
      Conversation.countDocuments(),
      TrustChain.countDocuments(),
    ]);

    res.json({
      status: 'success',
      stats: {
        users:         { total: totalUsers, sellers: totalSellers, buyers: totalBuyers, suspended, newThisWeek: newUsers },
        listings:      { total: totalListings, active: activeListings, sold: soldListings, newThisWeek: newListings },
        sellers:       { pendingVerification },
        conversations: totalConversations,
        trustEvents:   totalBlocks,
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/admin/users ───────────────────────────────────
// Filters: role, status (active | suspended), search (name or phone)
exports.getUsers = async (req, res, next) => {
  try {
    const { role, status, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status === 'active') filter.isActive = true;
    if (status === 'suspended') filter.isActive = false;
    if (search) {
      const pattern = escapeRegex(String(search));
      filter.$or = [
        { name:  { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
      ];
    }
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ status: 'success', users, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) { next(err); }
};

// ── GET /api/admin/sellers/pending ─────────────────────────
// Active sellers not yet verified, with what an admin needs to decide
exports.getPendingSellers = async (req, res, next) => {
  try {
    const sellers = await User.find({ role: 'seller', isActive: true, 'sellerProfile.isVerified': { $ne: true } })
      .select('name phone neighbourhood sellerProfile trustScore createdAt')
      .sort({ createdAt: 1 })
      .limit(100);
    const counts = await Listing.aggregate([
      { $match: { seller: { $in: sellers.map((s) => s._id) } } },
      { $group: { _id: '$seller', listings: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [c._id.toString(), c.listings]));
    res.json({
      status: 'success',
      sellers: sellers.map((s) => ({
        _id: s._id, name: s.name, phone: s.phone, neighbourhood: s.neighbourhood,
        businessName: s.sellerProfile?.businessName || '',
        rating: s.sellerProfile?.rating || 0, ratingCount: s.sellerProfile?.ratingCount || 0,
        trustScore: s.trustScore?.score ?? 50,
        listings: byId.get(s._id.toString()) || 0,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) { next(err); }
};

// ── GET /api/admin/trust-integrity ─────────────────────────
// Re-verifies every seller's chain against its stored head hash
exports.checkTrustIntegrity = async (req, res, next) => {
  try {
    const sellers = await User.find({ role: 'seller' }).select('name neighbourhood isActive trustScore');
    const blocks = await TrustChain.find({ seller: { $in: sellers.map((s) => s._id) } }).sort({ seller: 1, blockIndex: 1 });
    const bySeller = new Map();
    for (const b of blocks) {
      const key = b.seller.toString();
      if (!bySeller.has(key)) bySeller.set(key, []);
      bySeller.get(key).push(b);
    }
    const invalid = [];
    for (const s of sellers) {
      const chain = bySeller.get(s._id.toString()) || [];
      if (!verifyChain(chain, s.trustScore?.chainHash || '')) {
        invalid.push({
          _id: s._id, name: s.name, neighbourhood: s.neighbourhood, isActive: s.isActive,
          blocks: chain.length, storedScore: s.trustScore?.score ?? null, chainScore: calculateScore(chain),
        });
      }
    }
    res.json({ status: 'success', checked: sellers.length, blocks: blocks.length, invalid, checkedAt: new Date() });
  } catch (err) { next(err); }
};

// ── GET /api/admin/listings ────────────────────────────────
exports.getListings = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.title = { $regex: escapeRegex(String(search)), $options: 'i' };
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Listing.countDocuments(filter);
    const listings = await Listing.find(filter)
      .populate('seller', 'name phone neighbourhood')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    res.json({ status: 'success', listings, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) { next(err); }
};

// ── GET /api/admin/activity ────────────────────────────────
exports.getActivity = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const entries = await AdminLog.find().sort({ createdAt: -1 }).limit(limit);
    res.json({ status: 'success', entries });
  } catch (err) { next(err); }
};

// ── PUT /api/admin/users/:id/verify ───────────────────────
// Grant verified seller badge + add trust event (once only)
exports.verifySeller = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    if (user.role !== 'seller') return res.status(400).json({ status: 'error', message: 'User is not a seller' });
    if (!user.isActive) return res.status(400).json({ status: 'error', message: 'Reactivate this seller before verifying them' });
    // Verifying twice would add a second +15 block to the trust chain
    if (user.sellerProfile?.isVerified) {
      return res.status(409).json({ status: 'error', message: `${user.name} is already verified` });
    }

    user.sellerProfile.isVerified = true;
    await user.save();

    // Add ADMIN_VERIFIED block to trust chain
    await addTrustEvent(user._id, 'ADMIN_VERIFIED', { verifiedBy: req.user._id.toString() });
    await logAction(req, 'VERIFY_SELLER', 'user', user);

    res.json({ status: 'success', message: `${user.name} has been verified`, user });
  } catch (err) { next(err); }
};

// ── PUT /api/admin/users/:id/suspend ──────────────────────
// Toggles suspension. Body: { reason } (required when suspending)
exports.suspendUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ status: 'error', message: 'Cannot suspend an admin' });

    const suspending = user.isActive;
    const reason = cleanReason(req.body?.reason);
    if (suspending && !reason) {
      return res.status(400).json({ status: 'error', message: 'Give a reason for the suspension' });
    }

    user.isActive = !user.isActive;
    await user.save();

    // If suspending a seller, pause all their listings
    if (!user.isActive && user.role === 'seller') {
      await Listing.updateMany({ seller: user._id, status: 'active' }, { status: 'paused' });
    }
    await logAction(req, suspending ? 'SUSPEND_USER' : 'REACTIVATE_USER', 'user', user, reason);

    res.json({ status: 'success', message: `${user.name} has been ${user.isActive ? 'reactivated' : 'suspended'}`, isActive: user.isActive });
  } catch (err) { next(err); }
};

// ── DELETE /api/admin/listings/:id ────────────────────────
// Body: { reason } (required)
exports.removeListing = async (req, res, next) => {
  try {
    const reason = cleanReason(req.body?.reason);
    if (!reason) return res.status(400).json({ status: 'error', message: 'Give a reason for removing this listing' });
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ status: 'error', message: 'Listing not found' });
    await deleteImage(listing.image?.publicId);
    await listing.deleteOne();
    await logAction(req, 'REMOVE_LISTING', 'listing', listing, reason);
    res.json({ status: 'success', message: 'Listing removed by admin' });
  } catch (err) { next(err); }
};

// ── PUT /api/admin/users/:id/role ─────────────────────────
exports.changeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['buyer', 'seller'].includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Role must be buyer or seller' });
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    // Admins cannot demote each other (or themselves) from the panel
    if (user.role === 'admin') {
      return res.status(403).json({ status: 'error', message: "An admin's role cannot be changed here" });
    }
    if (user.role === role) {
      return res.status(400).json({ status: 'error', message: `${user.name} is already a ${role}` });
    }
    const from = user.role;
    user.role = role;
    await user.save();
    await logAction(req, 'CHANGE_ROLE', 'user', user, `${from} → ${role}`);
    res.json({ status: 'success', message: `Role updated to ${role}`, user });
  } catch (err) { next(err); }
};
