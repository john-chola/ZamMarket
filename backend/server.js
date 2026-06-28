const http     = require('http');
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const morgan   = require('morgan');
require('dotenv').config();

const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/user');
const listingRoutes = require('./routes/listing');
const chatRoutes    = require('./routes/chat');
const trustRoutes   = require('./routes/trust');
const adminRoutes   = require('./routes/admin');
const { errorHandler } = require('./middleware/errorHandler');
const { initSocket }   = require('./utils/socket');

const app        = express();
const httpServer = http.createServer(app);

// ── CORS — allow both local dev and production frontend ──
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL, // set this to your Vercel URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Routes ──────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/chat',     chatRoutes);
app.use('/api/trust',    trustRoutes);
app.use('/api/admin',    adminRoutes);

app.get('/api/health', (_, res) =>
  res.json({
    status: 'ok',
    message: 'ZamMarket API is running',
    env: process.env.NODE_ENV,
    timestamp: new Date(),
  })
);

app.use(errorHandler);

// ── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('✅ MongoDB connected');
  initSocket(httpServer);
  console.log('✅ Socket.io initialized');
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ZamMarket API running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('❌ MongoDB failed:', err.message);
  process.exit(1);
});

module.exports = app;