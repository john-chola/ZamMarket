import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ListingCard.css';

const STATUS_LABELS = {
  active:  'In Stock',
  sold:    'Sold Out',
  paused:  'Paused',
};

export default function ListingCard({ listing, showActions = false, onStatusChange, onDelete }) {
  const navigate = useNavigate();
  const imageUrl = listing.image?.url;

  const statusClass = `listing-card__status-badge listing-card__status-badge--${listing.status || 'active'}`;

  return (
    <div
      className="listing-card"
      onClick={() => navigate(`/listings/${listing._id}`)}
    >
      {/* Image */}
      <div className="listing-card__image">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.title}
            className="listing-card__image-img"
          />
        ) : (
          <span className="listing-card__placeholder">🪵</span>
        )}
        <span className={statusClass}>
          {STATUS_LABELS[listing.status] || STATUS_LABELS.active}
        </span>
      </div>

      {/* Body */}
      <div className="listing-card__body">
        <p className="listing-card__title">{listing.title}</p>

        <div className="listing-card__price-row">
          <span className="listing-card__price">
            K{listing.pricePerBag}
            <span className="listing-card__price-unit">/{listing.unit}</span>
          </span>
          <span className="listing-card__quantity">
            {listing.quantityAvailable} {listing.unit}s left
          </span>
        </div>

        <div className="listing-card__info-row">
          <span className="listing-card__location">
            {listing.neighbourhood?.replace('_', ' ')}
          </span>
          {listing.seller?.trustScore?.score >= 70 && (
            <span className="listing-card__trust-badge">✓ Trusted</span>
          )}
        </div>

        {/* Seller action buttons */}
        {showActions && (
          <div
            className="listing-card__actions"
            onClick={(e) => e.stopPropagation()}
          >
            {listing.status === 'active' && (
              <button
                onClick={() => onStatusChange(listing._id, 'sold')}
                className="listing-card__action-btn listing-card__action-btn--sold"
              >
                Mark Sold
              </button>
            )}
            {listing.status === 'sold' && (
              <button
                onClick={() => onStatusChange(listing._id, 'active')}
                className="listing-card__action-btn listing-card__action-btn--relist"
              >
                Relist
              </button>
            )}
            {listing.status === 'active' && (
              <button
                onClick={() => onStatusChange(listing._id, 'paused')}
                className="listing-card__action-btn listing-card__action-btn--pause"
              >
                Pause
              </button>
            )}
            <button
              onClick={() => onDelete(listing._id)}
              className="listing-card__action-btn listing-card__action-btn--small listing-card__action-btn--delete"
            >
              🗑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}