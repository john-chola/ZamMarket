const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Listing = require('../models/Listing');

// ── POST /api/chat/conversations ───────────────────────────
exports.startConversation = async (req, res, next) => {
  try {
    const { listingId } = req.body;

    if (!listingId) {
      return res.status(400).json({ status: 'error', message: 'listingId is required' });
    }

    // Find listing WITHOUT populate first
    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({ status: 'error', message: 'Listing not found' });
    }

    // Check ownership
    if (listing.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({ status: 'error', message: 'You cannot message your own listing' });
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      listing: listingId,
      buyer: req.user._id,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        listing: listingId,
        buyer: req.user._id,
        seller: listing.seller,
      });
    }

    // Populate separately
    conversation = await Conversation.findById(conversation._id)
      .populate('listing', 'title image pricePerBag unit neighbourhood')
      .populate('buyer',   'name neighbourhood')
      .populate('seller',  'name neighbourhood trustScore');
    res.status(201).json({ status: 'success', conversation });

  } catch (err) {
    console.error('startConversation error:', err.message);
    next(err);
  }
};

// ── GET /api/chat/conversations ────────────────────────────
exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const isSeller = req.user.role === 'seller' || req.user.role === 'admin';
    const filter = isSeller ? { seller: userId } : { buyer: userId };

    const conversations = await Conversation.find(filter)
      .populate('listing', 'title image pricePerBag unit neighbourhood')
      .populate('buyer',   'name neighbourhood')
      .populate('seller',  'name neighbourhood trustScore')
      .sort({ updatedAt: -1 });

    res.json({ status: 'success', conversations });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/chat/conversations/:id/messages ───────────────
exports.getMessages = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('listing', 'title image pricePerBag unit neighbourhood')
      .populate('buyer',   'name neighbourhood')
      .populate('seller',  'name neighbourhood trustScore');

    if (!conversation) {
      return res.status(404).json({ status: 'error', message: 'Conversation not found' });
    }

    const userId = req.user._id.toString();
    const buyerId  = conversation.buyer?._id?.toString()  || conversation.buyer?.toString();
    const sellerId = conversation.seller?._id?.toString() || conversation.seller?.toString();

    if (buyerId !== userId && sellerId !== userId) {
      return res.status(403).json({ status: 'error', message: 'Not authorised' });
    }

    const messages = await Message.find({ conversation: req.params.id })
      .populate('sender', 'name')
      .sort({ createdAt: 1 });

    const isBuyer = buyerId === userId;
    await Conversation.findByIdAndUpdate(
      req.params.id,
      isBuyer ? { unreadBuyer: 0 } : { unreadSeller: 0 }
    );

    res.json({ status: 'success', messages, conversation });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/chat/conversations/:id/messages ──────────────
exports.sendMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Message text is required' });
    }

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ status: 'error', message: 'Conversation not found' });
    }

    const userId  = req.user._id.toString();
    const buyerId  = conversation.buyer.toString();
    const sellerId = conversation.seller.toString();

    if (buyerId !== userId && sellerId !== userId) {
      return res.status(403).json({ status: 'error', message: 'Not authorised' });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      text: text.trim(),
      deliveredOffline: true,
    });
    await message.populate('sender', 'name');

    const isBuyer = buyerId === userId;
    await Conversation.findByIdAndUpdate(req.params.id, {
      lastMessage: { text: text.trim(), sentAt: new Date(), sentBy: req.user._id },
      $inc: isBuyer ? { unreadSeller: 1 } : { unreadBuyer: 1 },
    });

    res.status(201).json({ status: 'success', message });
  } catch (err) {
    next(err);
  }
};