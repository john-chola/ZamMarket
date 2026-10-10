const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getAllowedOrigins } = require('./corsOrigins');

const onlineUsers = new Map();

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    onlineUsers.set(userId, socket.id);
    console.log(`Socket connected: ${userId}`);

    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
    });

    socket.on('send_message', async (data) => {
      try {
        const { conversationId, text } = data;
        if (!text?.trim()) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const isParticipant =
          conversation.buyer.toString() === userId ||
          conversation.seller.toString() === userId;
        if (!isParticipant) return;

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          text: text.trim(),
        });
        await message.populate('sender', 'name');

        const isBuyer = conversation.buyer.toString() === userId;
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: { text: text.trim(), sentAt: new Date(), sentBy: userId },
          $inc: isBuyer ? { unreadSeller: 1 } : { unreadBuyer: 1 },
        });

        io.to(conversationId).emit('new_message', {
          message: {
            _id: message._id,
            conversation: conversationId,
            sender: message.sender,
            text: message.text,
            createdAt: message.createdAt,
          },
        });

        const otherId = isBuyer
          ? conversation.seller.toString()
          : conversation.buyer.toString();
        const otherSocket = onlineUsers.get(otherId);
        if (otherSocket) {
          io.to(otherSocket).emit('conversation_updated', {
            conversationId,
            lastMessage: { text: text.trim(), sentAt: new Date() },
          });
        }
      } catch (err) {
        console.error('send_message error:', err.message);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit('user_typing', { userId, isTyping });
    });

    socket.on('mark_read', async ({ conversationId }) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;
        const isBuyer = conversation.buyer.toString() === userId;
        await Conversation.findByIdAndUpdate(conversationId,
          isBuyer ? { unreadBuyer: 0 } : { unreadSeller: 0 }
        );
      } catch (err) {
        console.error('mark_read error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      console.log(`Socket disconnected: ${userId}`);
    });
  });

  return io;
};

module.exports = { initSocket };