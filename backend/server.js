const http    = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/user');
const listingRoutes = require('./routes/listing');
const chatRoutes    = require('./routes/chat');
const trustRoutes   = require('./routes/trust');
const adminRoutes   = require('./routes/admin');
const { errorHandler } = require('./middleware/errorHandler');
const { initSocket }   = require('./utils/socket');
const { getAllowedOrigins } = require('./utils/corsOrigins');

const app        = express();
const httpServer = http.createServer(app);

// Render and similar hosts sit behind a proxy; needed for correct
// client IPs in the rate limiters
app.set('trust proxy', 1);

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/chat',     chatRoutes);
app.use('/api/trust',    trustRoutes);
app.use('/api/admin',    adminRoutes);

// Health check, also showing which services are configured (no secrets)
const { isConfigured: cloudinaryConfigured } = require('./utils/cloudinary');
const { smsStatus } = require('./utils/sms');
app.get('/api/health', (_, res) =>
  res.json({
    status: 'ok',
    message: 'ZamMarket API',
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'not connected',
    cloudinary: cloudinaryConfigured() ? 'configured' : 'NOT configured (photos are skipped)',
    sms: smsStatus(),
    allowedOrigins: getAllowedOrigins(),
  })
);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('✅ MongoDB connected');
  console.log(`📱 SMS: ${smsStatus()}`);
  initSocket(httpServer);
  console.log('✅ Socket.io initialized');
  httpServer.listen(PORT, '0.0.0.0', () =>
    console.log(`🚀 ZamMarket API running on http://localhost:${PORT}`)
  );
}).catch((err) => { console.error('❌ MongoDB failed:', err.message); process.exit(1); });

module.exports = app;
