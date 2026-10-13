import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchConversations } from '../store/slices/chatSlice';
import './InboxPage.css';

const timeAgo = (date) => {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function InboxPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { conversations, loading, error } = useSelector((s) => s.chat);
  const { user } = useSelector((s) => s.auth);

  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  const isSeller = user?.role === 'seller' || user?.role === 'admin';

  return (
    <div className="inbox-container">
      <nav className="inbox-nav">
        <button
          onClick={() => navigate('/dashboard')}
          className="inbox-back-btn"
          aria-label="Back to dashboard"
        >
          ←
        </button>
        <span className="inbox-nav-title">Messages</span>
        {conversations.length > 0 && (
          <span className="inbox-unread-count">
            {conversations.reduce(
              (n, c) => n + (isSeller ? c.unreadSeller : c.unreadBuyer),
              0
            ) || null}
          </span>
        )}
      </nav>

      <div className="inbox-content">
        {loading && (
          <div className="inbox-loading">
            <p>Loading messages...</p>
          </div>
        )}

        {error && (
          <div className="error-msg inbox-error">{error}</div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="inbox-empty">
            <div className="inbox-empty-icon">💬</div>
            <h3 className="inbox-empty-title">No messages yet</h3>
            <p className="inbox-empty-description">
              {isSeller
                ? 'When buyers message you about your listings, conversations will appear here.'
                : 'Find a listing you like and tap "Message Seller" to start a conversation.'}
            </p>
            {!isSeller && (
              <button
                onClick={() => navigate('/browse')}
                className="btn btn-ember btn-browse-listings"
              >
                Browse Listings
              </button>
            )}
          </div>
        )}

        {conversations.map((conv) => {
          const other = isSeller ? conv.buyer : conv.seller;
          const unread = isSeller ? conv.unreadSeller : conv.unreadBuyer;

          return (
            <div
              key={conv._id}
              onClick={() => navigate(`/chat/${conv._id}`)}
              className={`conversation-item ${unread > 0 ? 'conversation-unread' : 'conversation-read'}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  navigate(`/chat/${conv._id}`);
                }
              }}
            >
              {/* Avatar */}
              <div className="conversation-avatar">
                {other?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>

              {/* Content */}
              <div className="conversation-content">
                <div className="conversation-header">
                  <span
                    className={`conversation-name ${
                      unread > 0 ? 'conversation-name-unread' : ''
                    }`}
                  >
                    {other?.name || 'Unknown'}
                  </span>
                  <span className="conversation-time">
                    {timeAgo(conv.lastMessage?.sentAt || conv.updatedAt)}
                  </span>
                </div>
                <p className="conversation-listing">
                  {conv.listing?.title || 'Listing'}
                </p>
                <p
                  className={`conversation-preview ${
                    unread > 0 ? 'conversation-preview-unread' : ''
                  }`}
                >
                  {conv.lastMessage?.text || 'No messages yet'}
                </p>
              </div>

              {/* Unread badge */}
              {unread > 0 && (
                <div className="conversation-badge">
                  {unread}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}