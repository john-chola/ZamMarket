import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { getDrafts, deleteDraft, syncDrafts, DRAFTS_CHANGED } from '../utils/offlineDrafts';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchMyListings, updateListingStatus, deleteListing } from '../store/slices/listingSlice';
import ListingCard from '../components/listings/ListingCard';
import './MyListingsPage.css';

/* ── Listings saved offline, waiting to be posted ─────── */
function PendingDrafts({ onPosted }) {
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () => getDrafts().then(setDrafts);
    load();
    window.addEventListener(DRAFTS_CHANGED, load);
    return () => window.removeEventListener(DRAFTS_CHANGED, load);
  }, []);

  const postNow = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Still offline. They will be posted when you reconnect.');
      return;
    }
    setBusy(true);
    const { posted, failed } = await syncDrafts((fd) => api.post('/listings', fd, { timeout: 90000 }));
    setBusy(false);
    if (posted) { toast.success(`${posted} posted`); onPosted(); }
    if (!posted && !failed) toast.error('Could not reach the server. Try again shortly.');
  }, [onPosted]);

  if (drafts.length === 0) return null;
  return (
    <div className="pending-drafts">
      <div className="pending-drafts__header">
        <p className="pending-drafts__title">📵 Waiting to post ({drafts.length})</p>
        <button className="pending-drafts__post" onClick={postNow} disabled={busy}>
          {busy ? 'Posting…' : 'Post now'}
        </button>
      </div>
      {drafts.map((d) => (
        <div key={d.id} className="pending-drafts__item">
          <div>
            <p className="pending-drafts__name">{d.fields.title}</p>
            <p className="pending-drafts__meta">
              K{d.fields.pricePerBag} per {d.fields.unit} · {d.fields.quantityAvailable} available
              {d.image ? ' · photo' : ''} · saved {new Date(d.savedAt).toLocaleTimeString()}
            </p>
            {d.error && <p className="pending-drafts__error">⚠ {d.error}</p>}
          </div>
          <button
            className="pending-drafts__delete"
            aria-label={`Delete draft ${d.fields.title}`}
            onClick={() => { if (window.confirm('Delete this unsent listing?')) deleteDraft(d.id); }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

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
        <PendingDrafts onPosted={() => dispatch(fetchMyListings())} />
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