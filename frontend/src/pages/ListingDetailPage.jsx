import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchListing, clearCurrent } from '../store/slices/listingSlice';
import { startConversation, clearError } from '../store/slices/chatSlice';
import './ListingDetailPage.css';

const fmtArea = (n) => (n ? n.replace('_', ' ') : 'Unknown');

export default function ListingDetailPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { current: listing, loading, error } = useSelector((s) => s.listings);
  const { user } = useSelector((s) => s.auth);
  const { loading: chatLoading, error: chatError } = useSelector((s) => s.chat);

  useEffect(() => {
    dispatch(fetchListing(id));
    return () => {
      dispatch(clearCurrent());
      dispatch(clearError());
    };
  }, [id, dispatch]);

  const handleMessage = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    dispatch(clearError());
    try {
      const result = await dispatch(startConversation(listing._id.toString())).unwrap();
      navigate(`/chat/${result.conversation._id}`);
    } catch (err) {
      console.error('startConversation failed:', err);
    }
  };

  if (loading)
    return (
      <div className="listing-detail-loading">
        <p>Loading listing...</p>
      </div>
    );

  if (error || !listing)
    return (
      <div className="listing-detail-error">
        <div className="error-icon"></div>
        <p>Listing not found.</p>
        <button className="btn btn-outline btn-browse" onClick={() => navigate('/browse')}>
          Browse listings
        </button>
      </div>
    );

  const seller = listing.seller;
  const isOwner = user?._id === seller?._id;
  const statusActive = listing.status === 'active';

  const getStatusClass = (status) => {
    if (status === 'active') return 'status-active';
    if (status === 'sold') return 'status-sold';
    return 'status-paused';
  };

  return (
    <div className="listing-detail-container">
      <nav className="listing-detail-nav">
        <button onClick={() => navigate(-1)} className="nav-back-btn" aria-label="Go back">
          ←
        </button>
        <span className="nav-title">{listing.title}</span>
      </nav>

      <div className="listing-detail-content">
        {/* Image */}
        <div className="listing-image-container">
          {listing.image?.url ? (
            <img
              src={listing.image.url}
              alt={listing.title}
              className="listing-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <span className="listing-image-placeholder"></span>
          )}
        </div>

        {/* Main info */}
        <div className="card listing-info-card">
          <div className="listing-header">
            <h1 className="listing-title">{listing.title}</h1>
            <span className={`listing-status-badge ${getStatusClass(listing.status)}`}>
              {listing.status === 'active'
                ? 'In Stock'
                : listing.status === 'sold'
                ? 'Sold Out'
                : 'Paused'}
            </span>
          </div>

          <div className="listing-price">
            K{listing.pricePerBag}
            <span className="listing-price-unit"> per {listing.unit}</span>
          </div>

          <div className="listing-details-grid">
            {[
              { label: 'Type', value: listing.charcoalType || 'N/A' },
              { label: 'Available', value: `${listing.quantityAvailable} ${listing.unit}s` },
              { label: 'Area', value: fmtArea(listing.neighbourhood) },
              { label: 'Views', value: listing.views ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="detail-item">
                <div className="detail-label">{label}</div>
                <div className="detail-value">{value}</div>
              </div>
            ))}
          </div>

          {listing.description && (
            <p className="listing-description">{listing.description}</p>
          )}
        </div>

        {/* Seller card */}
        <div className="card seller-card">
          <p className="seller-card-label">Seller</p>
          <div className="seller-info">
            <div className="seller-avatar">
              {seller?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="seller-details">
              <p className="seller-name">{seller?.name || 'Unknown'}</p>
              <p className="seller-location">
                {fmtArea(seller?.neighbourhood)}
                {seller?.sellerProfile?.isVerified ? ' · ✓ Verified' : ''}
              </p>
            </div>
            <div className="seller-trust">
              <div
                className={`seller-trust-score ${
                  (seller?.trustScore?.score ?? 50) >= 70 ? 'trust-high' : 'trust-medium'
                }`}
              >
                {seller?.trustScore?.score ?? 50}
              </div>
              <div className="seller-trust-label">Trust</div>
            </div>
          </div>

          {/* Error display */}
          {chatError && <div className="error-msg chat-error">{chatError}</div>}

          {/* Buyer actions */}
          {!isOwner && statusActive && (
            <div className="buyer-actions">
              <button
                onClick={handleMessage}
                disabled={chatLoading}
                className="btn btn-ember btn-message"
              >
                {chatLoading ? <span className="spinner" /> : 'Message Seller'}
              </button>
              {seller?.phone && (
                <a href={`tel:${seller.phone}`} className="btn btn-outline btn-call">
                  📞 Call
                </a>
              )}
            </div>
          )}

          {isOwner && (
            <button onClick={() => navigate('/listings/my')} className="btn btn-ember btn-my-listings">
              My Listings
            </button>
          )}
        </div>

        <p className="listing-date">
          Listed{' '}
          {new Date(listing.createdAt).toLocaleDateString('en-ZM', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>
    </div>
  );
}