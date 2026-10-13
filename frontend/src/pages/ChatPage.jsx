import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchMessages, addMessage, setTyping, setOnline,
  setPendingCount, updateConversationPreview,
  sendMessageREST, clearMessages,
} from '../store/slices/chatSlice';
import { initSocket, getSocket } from '../utils/socket';
import { queueMessage, getQueuedMessages, dequeueMessage } from '../utils/offlineQueue';
import api from '../utils/api';
import './mychatpage.css';

/* ── Transaction Rating Component ────────────────────────── */
function TransactionRating({ conversation, user, onRated }) {
  const [showStars, setShowStars]   = useState(false);
  const [rated,     setRated]       = useState(false);
  const [rating,    setRating]      = useState(0);
  const [submitting,setSubmitting]  = useState(false);
  const [rateErr,   setRateErr]     = useState('');

  const myId    = user?._id || user?.id;
  const buyerId = conversation?.buyer?._id || conversation?.buyer;
  const isBuyer = myId && buyerId &&
    myId.toString() === buyerId.toString();

  if (!isBuyer || rated) return null;

  const sellerId = conversation?.seller?._id || conversation?.seller;

  const handleRate = async (stars) => {
    setRating(stars);
    setSubmitting(true);
    setRateErr('');
    try {
      await api.post('/trust/rate', {
        sellerId:       sellerId?.toString(),
        rating:         stars,
        conversationId: conversation._id,
      });
      setRated(true);
      setShowStars(false);
      onRated?.();
    } catch (err) {
      setRateErr(err.response?.data?.message || 'Rating failed. Try again.');
      setRating(0);
    } finally {
      setSubmitting(false);
    }
  };

  // Star rating panel
  if (showStars) return (
    <div className="rating-panel">
      <p className="rating-panel__question">
        How was your experience with this seller?
      </p>
      {rateErr && (
        <p className="rating-panel__error">{rateErr}</p>
      )}
      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            disabled={submitting}
            className={`rating-star-btn${rating >= star ? ' rating-star-btn--active' : ''}`}
          >
            ⭐
          </button>
        ))}
        <button
          onClick={() => { setShowStars(false); setRating(0); setRateErr(''); }}
          className="rating-cancel-btn"
        >
          Cancel
        </button>
      </div>
      <p className="rating-panel__note">
        🔗 Your rating is permanently recorded on the blockchain and cannot be changed.
      </p>
    </div>
  );

  // "Did you collect?" prompt
  return (
    <div className="rating-prompt">
      <p className="rating-prompt__text">
        ✅ Collected your charcoal? Leave a rating.
      </p>
      <button onClick={() => setShowStars(true)} className="rating-prompt__btn">
        Rate Seller
      </button>
    </div>
  );
}

/* ── Chat Page ───────────────────────────────────────────── */
export default function ChatPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id: conversationId } = useParams();
  const {
    messages, messagesLoading, currentConversation,
    isTyping, isOnline, pendingCount,
  } = useSelector((s) => s.chat);
  const { user, token } = useSelector((s) => s.auth);

  const [text,    setText]    = useState('');
  const [sending, setSending] = useState(false);
  const [ratedOk, setRatedOk] = useState(false);
  const bottomRef    = useRef(null);
  const typingTimer  = useRef(null);
  const socketRef    = useRef(null);

  // Load messages
  useEffect(() => {
    dispatch(fetchMessages(conversationId));
    return () => dispatch(clearMessages());
  }, [conversationId, dispatch]);

  // Socket.io
  useEffect(() => {
    const socket = initSocket(token);
    socketRef.current = socket;

    socket.emit('join_conversation', conversationId);
    socket.emit('mark_read', { conversationId });

    socket.on('new_message', ({ message }) => {
      dispatch(addMessage(message));
      dispatch(updateConversationPreview({
        conversationId,
        lastMessage: { text: message.text, sentAt: message.createdAt },
      }));
      socket.emit('mark_read', { conversationId });
    });

    socket.on('user_typing', ({ isTyping: t }) => {
      dispatch(setTyping(t));
    });

    return () => {
      socket.off('new_message');
      socket.off('user_typing');
    };
  }, [conversationId, token, dispatch]);

  // Flush offline queue
  const flushOfflineQueue = useCallback(async () => {
    const queued = await getQueuedMessages();
    if (queued.length === 0) return;
    for (const item of queued) {
      try {
        await dispatch(sendMessageREST({
          conversationId: item.conversationId,
          text: item.text,
        })).unwrap();
        await dequeueMessage(item.id);
      } catch { break; }
    }
    const remaining = await getQueuedMessages();
    dispatch(setPendingCount(remaining.length));
  }, [dispatch]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = async () => {
      dispatch(setOnline(true));
      await flushOfflineQueue();
    };
    const handleOffline = () => dispatch(setOnline(false));
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    dispatch(setOnline(navigator.onLine));
    getQueuedMessages().then((q) => dispatch(setPendingCount(q.length)));
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch, flushOfflineQueue]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing indicator
  const handleTyping = (val) => {
    setText(val);
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing', { conversationId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing', { conversationId, isTyping: false });
    }, 1500);
  };

  // Send message
  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    setSending(true);
    const socket = getSocket();
    if (isOnline && socket?.connected) {
      socket.emit('send_message', { conversationId, text: trimmed });
      socket.emit('typing', { conversationId, isTyping: false });
    } else {
      await queueMessage(conversationId, trimmed);
      const queued = await getQueuedMessages();
      dispatch(setPendingCount(queued.length));
      dispatch(addMessage({
        _id: `offline_${Date.now()}`,
        conversation: conversationId,
        sender: { _id: user._id || user.id, name: user.name },
        text: trimmed,
        createdAt: new Date().toISOString(),
        offline: true,
      }));
    }
    setSending(false);
  };

  // Helpers
  const other = currentConversation
    ? ((user?._id || user?.id) === (currentConversation.buyer?._id || currentConversation.buyer?.toString())
        ? currentConversation.seller
        : currentConversation.buyer)
    : null;

  const isMine = (msg) => {
    const senderId = msg.sender?._id || msg.sender;
    const myId     = user?._id || user?.id;
    return senderId?.toString() === myId?.toString();
  };

  return (
    <div className="chat-page">

      {/* Header */}
      <nav className="chat-header">
        <button onClick={() => navigate('/chat')} className="chat-header__back-btn">
          ←
        </button>
        <div className="chat-header__avatar">
          {other?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="chat-header__info">
          <p className="chat-header__name">
            {other?.name || 'Chat'}
          </p>
          <p className="chat-header__neighbourhood">
            📍 {other?.neighbourhood?.replace('_', ' ') || ''}
          </p>
        </div>
        <div className="chat-header__status">
          <div className={`chat-header__dot${isOnline ? ' chat-header__dot--online' : ' chat-header__dot--offline'}`} />
          <span className="chat-header__status-text">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </nav>

      {/* Listing context banner */}
      {currentConversation?.listing && (
        <div className="listing-banner">
          <span className="listing-banner__icon"></span>
          <div className="listing-banner__info">
            <p className="listing-banner__title">
              {currentConversation.listing.title}
            </p>
            <p className="listing-banner__price">
              K{currentConversation.listing.pricePerBag} per {currentConversation.listing.unit}
            </p>
          </div>
        </div>
      )}

      {/* Offline queue banner */}
      {!isOnline && (
        <div className="offline-banner">
          <span className="offline-banner__icon">📵</span>
          <p className="offline-banner__text">
            Offline — messages will send when reconnected.
            {pendingCount > 0 && ` (${pendingCount} queued)`}
          </p>
        </div>
      )}

      {/* Rating success banner */}
      {ratedOk && (
        <div className="rating-success-banner">
          <p className="rating-success-banner__text">
            ✓ Rating recorded on blockchain. Thank you!
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messagesLoading && (
          <p className="chat-loading">Loading messages...</p>
        )}

        {!messagesLoading && messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty__icon">👋</div>
            <p className="chat-empty__text">
              Ask about availability, price, or collection point.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const mine = isMine(msg);
          return (
            <div
              key={msg._id}
              className={`message-row${mine ? ' message-row--mine' : ' message-row--theirs'}`}
            >
              <div
                className={`message-bubble${
                  mine ? ' message-bubble--mine' : ' message-bubble--theirs'
                }${msg.offline ? ' message-bubble--offline' : ''}`}
              >
                <p className="message-bubble__text">{msg.text}</p>
                <p
                  className={`message-bubble__meta${
                    mine ? ' message-bubble__meta--mine' : ' message-bubble__meta--theirs'
                  }`}
                >
                  {msg.offline
                    ? '⏳ queued'
                    : new Date(msg.createdAt).toLocaleTimeString('en-ZM', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                </p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="typing-indicator">
            <div className="typing-bubble">
              <div className="typing-dots">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Transaction Rating */}
      {currentConversation && messages.length > 0 && !ratedOk && (
        <TransactionRating
          conversation={currentConversation}
          user={user}
          onRated={() => setRatedOk(true)}
        />
      )}

      {/* Input bar */}
      <form onSubmit={handleSend} className="chat-input-bar">
        <input
          type="text"
          placeholder={isOnline ? 'Type a message...' : 'Offline — message will be queued'}
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
          className={`chat-input${!isOnline ? ' chat-input--offline' : ''}`}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className={`chat-send-btn${text.trim() ? ' chat-send-btn--active' : ''}`}
        >
          ↑
        </button>
      </form>
    </div>
  );
}