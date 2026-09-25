import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../utils/api';
import './TrustScorePage.css';

const EVENT_LABELS = {
  LISTING_CREATED:   { label: 'Listing posted',         icon: '📦', color: '#3B6D11' },
  BUYER_RATING_5:    { label: '5-star rating received',  icon: '⭐', color: '#BA7517' },
  BUYER_RATING_4:    { label: '4-star rating received',  icon: '⭐', color: '#BA7517' },
  BUYER_RATING_3:    { label: '3-star rating received',  icon: '⭐', color: '#888780' },
  BUYER_RATING_2:    { label: '2-star rating received',  icon: '⚠️', color: '#E08A00' },
  BUYER_RATING_1:    { label: '1-star rating received',  icon: '⚠️', color: '#A32D2D' },
  ADMIN_VERIFIED:    { label: 'Admin verified',          icon: '✓',  color: '#3B6D11' },
};

export default function TrustScorePage() {
  const { sellerId } = useParams();
  const navigate     = useNavigate();
  const { user }     = useSelector((s) => s.auth);

  const getStoredUserId = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('zammarket_user'));
      return stored?._id || stored?.id || null;
    } catch { return null; }
  };

  const myId = user?._id || user?.id || getStoredUserId();
  const isValidId = (id) => id && id !== 'undefined' && id !== 'null' && /^[a-f\d]{24}$/i.test(id);
  const targetId  = isValidId(sellerId) ? sellerId : myId;

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [rating, setRating]   = useState(0);
  const [rated, setRated]     = useState(false);
  const [rateError, setRateError] = useState('');

  // Redirect buyers away from their own trust page
  useEffect(() => {
    const viewingOwnProfile = !sellerId ||
      sellerId === 'undefined' ||
      (myId && myId.toString() === sellerId.toString());
    if (viewingOwnProfile && user?.role === 'buyer') {
      navigate('/dashboard', { replace: true });
    }
  }, [user?.role, sellerId, myId, navigate]);

  useEffect(() => {
    if (!targetId || !isValidId(targetId)) {
      setError('Could not identify user. Please log out and log back in.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    api.get(`/trust/${targetId}`)
      .then(({ data: d }) => { setData(d); setLoading(false); })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load trust data');
        setLoading(false);
      });
  }, [targetId]);

  const handleRate = async (stars) => {
    if (!isValidId(targetId)) return;
    setRating(stars);
    setRateError('');
    try {
      await api.post('/trust/rate', { sellerId: targetId, rating: stars });
      setRated(true);
      const { data: fresh } = await api.get(`/trust/${targetId}`);
      setData(fresh);
    } catch (err) {
      setRateError(err.response?.data?.message || 'Rating failed');
      setRating(0);
    }
  };

  if (loading) return (
    <div className="trust-loading">
      <p>Loading trust data...</p>
    </div>
  );

  const score    = data?.chain?.score ?? 50;
  const isValid  = data?.chain?.isValid;
  const blocks   = data?.chain?.blocks || [];
  const seller   = data?.seller;
  const canRate  = data?.canRate;

  const isSelf = !!(myId && targetId && myId.toString() === targetId.toString());
  const showRating = !isSelf && !!user && canRate && !rated;

  const getScoreCategory = (score) => {
    if (score >= 70) return 'trusted';
    if (score >= 40) return 'building';
    return 'new';
  };
  const scoreCategory = getScoreCategory(score);
  const scoreLabel = score >= 70 ? 'Trusted Seller'
    : score >= 40 ? 'Building Reputation' : 'New Seller';

  return (
    <div className="trust-container">
      <nav className="trust-nav">
        <button onClick={() => navigate(-1)} className="trust-back-btn" aria-label="Go back">
          ←
        </button>
        <span className="trust-nav-title">Trust Score</span>
        {isSelf && (
          <span className="trust-nav-self-label">Your profile</span>
        )}
      </nav>

      <div className="trust-content">
        {error && <div className="error-msg">{error}</div>}

        {/* Score card */}
        <div className="card trust-score-card">
          <div className={`trust-score-value ${scoreCategory}`}>{score}</div>
          <p className="trust-score-out-of">out of 100</p>
          <p className={`trust-score-label ${scoreCategory}`}>{scoreLabel}</p>

          <div className="trust-progress-bar">
            <div
              className={`trust-progress-fill ${scoreCategory}`}
              style={{ width: `${score}%` }}
            />
          </div>

          <div className="trust-stats-grid">
            {[
              { label: 'Listings', value: blocks.filter(b => b.event?.type === 'LISTING_CREATED').length, icon: '📦' },
              { label: 'Ratings',  value: blocks.filter(b => b.event?.type?.startsWith('BUYER_RATING')).length, icon: '⭐' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="trust-stat-item">
                <div className="trust-stat-icon">{icon}</div>
                <div className="trust-stat-value">{value}</div>
                <div className="trust-stat-label">{label}</div>
              </div>
            ))}
          </div>

          <div className="trust-badges">
            <span className={`trust-badge ${isValid ? 'badge-valid' : 'badge-invalid'}`}>
              {isValid ? '🔗 Chain Valid' : '⚠️ Chain Invalid'}
            </span>
            {seller?.isVerified && (
              <span className="trust-badge badge-verified">✓ Verified Seller</span>
            )}
          </div>
        </div>

        {/* How to build score (only when empty and viewing own profile) */}
        {blocks.length === 0 && isSelf && (
          <div className="card trust-guide-card">
            <p className="trust-guide-title">How to build your trust score</p>
            {[
              { icon: '📦', action: 'Post a listing',             points: '+2 pts' },
              { icon: '⭐', action: 'Receive a 5-star rating',    points: '+8 pts' },
              { icon: '✓',  action: 'Get verified by admin',      points: '+15 pts' },
            ].map(({ icon, action, points }) => (
              <div key={action} className="trust-guide-item">
                <span className="trust-guide-action">{icon} {action}</span>
                <span className="trust-guide-points">{points}</span>
              </div>
            ))}
          </div>
        )}

        {/* Seller info */}
        {seller && (
          <div className="card trust-seller-card">
            <div className="trust-seller-info">
              <div className="trust-seller-avatar">
                {seller.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="trust-seller-details">
                <p className="trust-seller-name">{seller.name}</p>
                <p className="trust-seller-meta">
                  📍 {(seller.neighbourhood || '').replace('_', ' ')}
                  {' · '}{blocks.length} trust event{blocks.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rating widget */}
        {showRating && (
          <div className="card trust-rating-card">
            <p className="trust-rating-title">Rate this seller</p>
            <p className="trust-rating-description">
              You have chatted with this seller. Your rating is permanently recorded on the blockchain.
            </p>
            {rateError && <div className="error-msg trust-rate-error">{rateError}</div>}
            <div className="trust-stars-container">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  className={`trust-star-btn ${rating >= star ? 'star-active' : 'star-inactive'}`}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Explanation for non-ratable users */}
        {!isSelf && user && !canRate && !rated && (
          <div className="trust-rating-notice">
            💬 Message this seller and have a conversation before you can leave a rating.
          </div>
        )}

        {/* Rating success banner */}
        {rated && (
          <div className="trust-rated-banner">
            ✓ Rating recorded on blockchain. Trust score updated.
          </div>
        )}

        {/* Blockchain event history */}
        <div className="card trust-chain-card">
          <p className="trust-chain-header">
            Blockchain History · {blocks.length} block{blocks.length !== 1 ? 's' : ''}
          </p>

          {blocks.length === 0 && (
            <div className="trust-chain-empty">
              <div className="trust-chain-empty-icon">🔗</div>
              <p className="trust-chain-empty-text">
                No trust events yet.
                {isSelf ? ' Post a listing to add the first block.' : ''}
              </p>
            </div>
          )}

          {[...blocks].reverse().map((block, i) => {
            const meta = EVENT_LABELS[block.event?.type] || {
              label: block.event?.type || 'Unknown event',
              icon: '⬛', color: 'var(--ash)',
            };
            return (
              <div
                key={block._id || i}
                className={`trust-chain-item ${i < blocks.length - 1 ? 'chain-item-border' : ''}`}
              >
                <div className="chain-item-icon" style={{ background: `${meta.color}22` }}>
                  {meta.icon}
                </div>
                <div className="chain-item-content">
                  <p className="chain-item-label">{meta.label}</p>
                  <p className="chain-item-hash">#{block.hash?.slice(0, 24)}...</p>
                </div>
                <p className="chain-item-date">
                  {new Date(block.timestamp).toLocaleDateString('en-ZM', {
                    day: 'numeric', month: 'short' })}
                </p>
              </div>
            );
          })}
        </div>

        <p className="trust-footer">
          Secured by SHA-256 hash chain · ZamMarket 2026
        </p>
      </div>
    </div>
  );
}