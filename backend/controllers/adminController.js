const User        = require('../models/User');
const Listing     = require('../models/Listing');
const Conversation = require('../models/Conversation');
const TrustChain  = require('../models/TrustChain');
const { addTrustEvent } = require('./trustController');
const { deleteImage } = require('../utils/cloudinary');
const { escapeRegex } = require('../utils/escapeRegex');

// ── GET /api/admin/stats ───────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [
      totalUsers, totalSellers, totalBuyers,
      totalListings, activeListings, soldListings,
      totalConversations, totalBlocks,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'seller' }),
      User.countDocuments({ role: 'buyer' }),
      Listing.countDocuments(),
      Listing.countDocuments({ status: 'active' }),
      Listing.countDocuments({ status: 'sold' }),
      Conversation.countDocuments(),
      TrustChain.countDocuments(),
    ]);

    res.json({
      status: 'success',
      stats: {
        users:         { total: totalUsers, sellers: totalSellers, buyers: totalBuyers },
        listings:      { total: totalListings, active: activeListings, sold: soldListings },
        conversations: totalConversations,
        trustEvents:   totalBlocks,
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/admin/users ───────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
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

// ── GET /api/admin/listings ────────────────────────────────
exports.getListings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
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

// ── PUT /api/admin/users/:id/verify ───────────────────────
// Grant verified seller badge + add trust event
exports.verifySeller = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    if (user.role !== 'seller') return res.status(400).json({ status: 'error', message: 'User is not a seller' });

    user.sellerProfile.isVerified = true;
    await user.save();

    // Add ADMIN_VERIFIED block to trust chain
    await addTrustEvent(user._id, 'ADMIN_VERIFIED', { verifiedBy: req.user._id.toString() });

    res.json({ status: 'success', message: `${user.name} has been verified`, user });
  } catch (err) { next(err); }
};

// ── PUT /api/admin/users/:id/suspend ──────────────────────
exports.suspendUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ status: 'error', message: 'Cannot suspend an admin' });

    user.isActive = !user.isActive; // toggle
    await user.save();

    // If suspending a seller, pause all their listings
    if (!user.isActive && user.role === 'seller') {
      await Listing.updateMany({ seller: user._id, status: 'active' }, { status: 'paused' });
    }

    res.json({ status: 'success', message: `${user.name} has been ${user.isActive ? 'reactivated' : 'suspended'}`, isActive: user.isActive });
  } catch (err) { next(err); }
};

// ── DELETE /api/admin/listings/:id ────────────────────────
exports.removeListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ status: 'error', message: 'Listing not found' });
    await deleteImage(listing.image?.publicId);
    await listing.deleteOne();
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
    const user = await User.findByIdAndUpdate(
      req.params.id, { role }, { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', message: `Role updated to ${role}`, user });
  } catch (err) { next(err); }
};