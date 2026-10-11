// ── Demo data for presentations ────────────────────────────
// Fills the database with a small, realistic marketplace so a demo
// never starts on an empty screen:
//   3 sellers, 1 buyer, 5 listings, 2 conversations with messages,
//   and real trust chains (listings, a 5-star rating, a verification).
//
//   npm run seed-demo            create or reset the demo data
//   npm run seed-demo -- --check validate the data without a database
//
// Only the demo accounts below (phones 096000000x) and their data are
// touched. Running it again resets them to the same starting state.
// Every demo account uses the password printed at the end.

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Listing = require('../models/Listing');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const TrustChain = require('../models/TrustChain');
const { addTrustEvent } = require('../controllers/trustController');

const PASSWORD = 'demo1234';

const USERS = {
  mary:   { phone: '0960000001', name: 'Mary Banda',     role: 'seller', neighbourhood: 'Kanyama',
            sellerProfile: { businessName: "Mary's Charcoal", description: 'Hardwood charcoal, collected near Kanyama market.' } },
  joseph: { phone: '0960000002', name: 'Joseph Phiri',   role: 'seller', neighbourhood: 'Mtendere',
            sellerProfile: { businessName: 'Phiri Fuel', description: 'Mixed charcoal by the tin or bag.' } },
  grace:  { phone: '0960000003', name: 'Grace Mwale',    role: 'seller', neighbourhood: 'Chilenje',
            sellerProfile: { businessName: 'Mwale Miombo', description: 'Big bags of miombo charcoal.' } },
  chanda: { phone: '0960000004', name: 'Chanda Mulenga', role: 'buyer',  neighbourhood: 'Kanyama' },
};

const LISTINGS = [
  { key: 'm1', seller: 'mary',   title: 'Hardwood charcoal — 25kg bags', charcoalType: 'Hardwood (Miombo)', pricePerBag: 95,  unit: 'bag', quantityAvailable: 10, neighbourhood: 'Kanyama',  description: 'Dry, well-burnt hardwood. Collect from my stand by Kanyama market.' },
  { key: 'm2', seller: 'mary',   title: 'Small bags for the week',        charcoalType: 'Hardwood (Miombo)', pricePerBag: 45,  unit: 'bag', quantityAvailable: 15, neighbourhood: 'Kanyama',  description: 'Half-size bags, good for one household for a week.' },
  { key: 'j1', seller: 'joseph', title: 'Mixed charcoal by the tin',      charcoalType: 'Mixed',             pricePerBag: 40,  unit: 'tin', quantityAvailable: 20, neighbourhood: 'Mtendere', description: 'Tins filled on the spot.' },
  { key: 'j2', seller: 'joseph', title: 'Mixed charcoal, full bags',      charcoalType: 'Mixed',             pricePerBag: 85,  unit: 'bag', quantityAvailable: 8,  neighbourhood: 'Mtendere', description: '' },
  { key: 'g1', seller: 'grace',  title: 'Miombo charcoal, big bags',      charcoalType: 'Hardwood (Miombo)', pricePerBag: 120, unit: 'bag', quantityAvailable: 6,  neighbourhood: 'Chilenje', description: 'Large bags, delivery possible within Chilenje.' },
];

// buyer ↔ seller conversations about a listing; `rate` adds a rating block
const CONVERSATIONS = [
  { listing: 'm1', buyer: 'chanda', rate: 5, messages: [
    ['chanda', 'Hello, are the 25kg bags still available?'],
    ['mary', 'Yes, I have 10 bags. K95 each.'],
    ['chanda', 'I will take 2. Can I collect today?'],
    ['mary', 'Yes, come to the stand by Kanyama market.'],
    ['chanda', 'Collected, thank you!'],
  ] },
  { listing: 'j1', buyer: 'chanda', messages: [
    ['chanda', 'Do you have tins available tomorrow morning?'],
    ['joseph', 'Yes, from 7am. How many do you need?'],
  ] },
];

const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };

// Validate every document against the real schemas (no database needed)
const check = () => {
  const problems = [];
  for (const [key, u] of Object.entries(USERS)) {
    const err = new User({ ...u, password: PASSWORD }).validateSync();
    if (err) problems.push(`user ${key}: ${err.message}`);
  }
  for (const l of LISTINGS) {
    const err = new Listing({ ...l, seller: new mongoose.Types.ObjectId() }).validateSync();
    if (err) problems.push(`listing ${l.key}: ${err.message}`);
  }
  for (const c of CONVERSATIONS) {
    if (!LISTINGS.find((l) => l.key === c.listing)) problems.push(`conversation: unknown listing ${c.listing}`);
    for (const [who] of c.messages) if (!USERS[who]) problems.push(`message from unknown user ${who}`);
  }
  return problems;
};

const removeDemoData = async () => {
  const existing = await User.find({ phone: { $in: Object.values(USERS).map((u) => u.phone) } }).select('_id');
  const ids = existing.map((u) => u._id);
  if (ids.length === 0) return 0;
  const convs = await Conversation.find({ $or: [{ buyer: { $in: ids } }, { seller: { $in: ids } }] }).select('_id');
  await Message.deleteMany({ conversation: { $in: convs.map((c) => c._id) } });
  await Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
  await Listing.deleteMany({ seller: { $in: ids } });
  await TrustChain.deleteMany({ seller: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  return ids.length;
};

(async () => {
  const problems = check();
  if (problems.length) fail(`Demo data is invalid:\n  ${problems.join('\n  ')}`);
  if (process.argv.includes('--check')) {
    console.log(`✅ Demo data is valid: ${Object.keys(USERS).length} users, ${LISTINGS.length} listings, ${CONVERSATIONS.length} conversations`);
    return;
  }
  if (!process.env.MONGODB_URI) fail('MONGODB_URI is not set in backend/.env');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to database "${mongoose.connection.name}"`);

  try {
    const removed = await removeDemoData();
    if (removed) console.log(`Removed previous demo data (${removed} accounts)`);

    const users = {};
    for (const [key, u] of Object.entries(USERS)) {
      users[key] = await User.create({ ...u, password: PASSWORD }); // hashed by the pre-save hook
    }

    const listings = {};
    for (const l of LISTINGS) {
      const { key, seller, ...fields } = l;
      listings[key] = await Listing.create({ ...fields, seller: users[seller]._id, views: Math.floor(Math.random() * 30) });
      await addTrustEvent(users[seller]._id, 'LISTING_CREATED', { listingId: listings[key]._id.toString(), title: fields.title });
    }

    for (const c of CONVERSATIONS) {
      const listing = listings[c.listing];
      const sellerKey = LISTINGS.find((l) => l.key === c.listing).seller;
      const conv = await Conversation.create({ listing: listing._id, buyer: users[c.buyer]._id, seller: users[sellerKey]._id });
      let last = null;
      for (const [who, text] of c.messages) {
        last = await Message.create({ conversation: conv._id, sender: users[who]._id, text });
      }
      await Conversation.findByIdAndUpdate(conv._id, {
        lastMessage: { text: last.text, sentAt: last.createdAt, sentBy: last.sender },
      });
      if (c.rate) {
        await addTrustEvent(users[sellerKey]._id, `BUYER_RATING_${c.rate}`, {
          rating: c.rate, buyerId: users[c.buyer]._id.toString(), conversationId: conv._id.toString(),
        });
        await User.findByIdAndUpdate(users[sellerKey]._id, { 'sellerProfile.rating': c.rate, 'sellerProfile.ratingCount': 1 });
      }
    }

    // Mary is a verified seller, so the demo shows the badge and the +15
    await User.findByIdAndUpdate(users.mary._id, { 'sellerProfile.isVerified': true });
    await addTrustEvent(users.mary._id, 'ADMIN_VERIFIED', { verifiedBy: 'demo-seed' });

    const scores = await User.find({ _id: { $in: Object.values(users).map((u) => u._id) }, role: 'seller' })
      .select('name trustScore.score');
    console.log('\n✅ Demo data ready\n');
    console.log('Log in with any of these (password for all: ' + PASSWORD + '):');
    for (const [key, u] of Object.entries(USERS)) console.log(`  ${u.phone}  ${u.name.padEnd(15)} ${u.role}  (${key})`);
    console.log('\nTrust scores:');
    for (const s of scores) console.log(`  ${s.name.padEnd(15)} ${s.trustScore.score}`);
    console.log('\nChanda can still rate Joseph live during the demo (the tin conversation is unrated).');
  } catch (err) {
    console.error(err);
    fail(err.message);
  } finally {
    await mongoose.disconnect();
  }
})();
