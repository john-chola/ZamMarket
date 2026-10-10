import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchMyListings, updateListingStatus, deleteListing } from '../store/slices/listingSlice';
import ListingCard from '../components/listings/ListingCard';
import './MyListingsPage.css';

export default function MyListingsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { myListings, myLoading, error } = useSelector((s) => s.listings);

  useEffect(() => {
    dispatch(fetchMyListings());
  }, [dispatch]);

  const handleStatusChange = (id, status) => {
    if (window.confirm(`Mark this listing as "${status}"?`)) {
      dispatch(updateListingStatus({ id, status }));
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this listing? This cannot be undone.')) {
      dispatch(deleteListing(id));
    }
  };

  const active = myListings.filter((l) => l.status === 'active');
  const other = myListings.filter((l) => l.status !== 'active');

  return (
    <div className="my-listings-container">
      <nav className="my-listings-nav">
        <div className="nav-left">
          <button
            onClick={() => navigate('/dashboard')}
            className="nav-back-btn"
            aria-label="Back to dashboard"
          >
            ←
          </button>
          <span className="nav-title">My Listings</span>
        </div>
        <button
          onClick={() => navigate('/listings/new')}
          className="btn-new-listing"
        >
          + New
        </button>
      </nav>

      <div className="my-listings-content">
        {/* Summary stats */}
        <div className="stats-grid">
          {[
            {
              label: 'Active',
              value: myListings.filter((l) => l.status === 'active').length,
              color: 'var(--green)',
            },
            {
              label: 'Sold',
              value: myListings.filter((l) => l.status === 'sold').length,
              color: 'var(--ember)',
            },
            {
              label: 'Paused',
              value: myListings.filter((l) => l.status === 'paused').length,
              color: 'var(--ash)',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card card">
              <div className="stat-value" style={{ color }}>
                {value}
              </div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {error && <div className="error-msg">{error}</div>}

        {myLoading && (
          <p className="loading-message">Loading your listings...</p>
        )}

        {!myLoading && myListings.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🪵</div>
            <h3 className="empty-state-title">No listings yet</h3>
            <p className="empty-state-description">
              Post your first charcoal listing and start getting buyers.
            </p>
            <button
              onClick={() => navigate('/listings/new')}
              className="btn btn-ember btn-post-first"
            >
              Post First Listing
            </button>
          </div>
        )}

        {active.length > 0 && (
          <>
            <h3 className="section-title">Active</h3>
            <div className="listings-grid">
              {active.map((l) => (
                <ListingCard
                  key={l._id}
                  listing={l}
                  showActions
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}

        {other.length > 0 && (
          <>
            <h3 className="section-title">Sold / Paused</h3>
            <div className="listings-grid">
              {other.map((l) => (
                <ListingCard
                  key={l._id}
                  listing={l}
                  showActions
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}