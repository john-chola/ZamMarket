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

const app        = express();
const httpServer = http.createServer(app);

app.use(cors({
  origin: ['http://localhost:5173','http://127.0.0.1:5173','http://localhost:3000'],
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

app.get('/api/health', (_, res) =>
  res.json({ status: 'ok', message: 'ZamMarket API — All Sprints', timestamp: new Date() })
);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('✅ MongoDB connected');
  initSocket(httpServer);
  console.log('✅ Socket.io initialized');
  httpServer.listen(PORT, '0.0.0.0', () =>
    console.log(`🚀 ZamMarket API running on http://localhost:${PORT}`)
  );
}).catch((err) => { console.error('❌ MongoDB failed:', err.message); process.exit(1); });

module.exports = app;