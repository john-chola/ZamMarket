import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchListings } from '../store/slices/listingSlice';
import ListingCard from '../components/listings/ListingCard';
import { NEIGHBOURHOODS } from '../utils/validation';
import './BrowsePage.css';

const ALL_NEIGHBOURHOODS = ['All', ...NEIGHBOURHOODS];

export default function BrowsePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, loading, error, pagination } = useSelector((s) => s.listings);

  const [neighbourhood, setNeighbourhood] = useState(
    searchParams.get('neighbourhood') || 'All'
  );
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minQty, setMinQty] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(() => {
    dispatch(fetchListings({ neighbourhood, search }));
  }, [dispatch, neighbourhood, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setMinPrice('');
    setMaxPrice('');
    setMinQty('');
    setNeighbourhood('All');
  };

  const filtered = items.filter((l) => {
    if (minPrice && l.pricePerBag < Number(minPrice)) return false;
    if (maxPrice && l.pricePerBag > Number(maxPrice)) return false;
    if (minQty && l.quantityAvailable < Number(minQty)) return false;
    return true;
  });

  const hasActiveFilters =
    search || minPrice || maxPrice || minQty || neighbourhood !== 'All';

  return (
    <div className="browse-page">
      {/* Nav */}
      <nav className="browse-nav">
        <span onClick={() => navigate('/dashboard')} className="browse-nav__logo">
          <span className="browse-nav__dot">●</span> ZamMarket
        </span>
        <span className="browse-nav__count">
          {filtered.length} listing{filtered.length !== 1 ? 's' : ''}
        </span>
      </nav>

      <div className="browse-content">
        {/* Search form */}
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search charcoal listings..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-ember search-btn">
            🔍
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`filter-toggle-btn${showFilters ? ' filter-toggle-btn--active' : ''}`}
          >
            ⚙️
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="clear-filters-btn"
            >
              ✕
            </button>
          )}
        </form>

        {/* Filter panel */}
        {showFilters && (
          <div className="card filter-panel">
            <p className="filter-panel__title">Filter by</p>
            <div className="filter-grid">
              <div>
                <label className="form-label">Min Price (K)</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  min="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Max Price (K)</label>
                <input
                  type="number"
                  placeholder="e.g. 200"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Min Quantity</label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  min="1"
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Neighbourhood pills */}
        <div className="neighbourhood-pills">
          {ALL_NEIGHBOURHOODS.map((n) => (
            <button
              key={n}
              onClick={() => setNeighbourhood(n)}
              className={`neighbourhood-pill${
                neighbourhood === n ? ' neighbourhood-pill--active' : ''
              }`}
            >
              {n.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Results summary */}
        <div className="results-summary">
          <p className="results-summary__text">
            {loading
              ? 'Loading...'
              : `${filtered.length} listings`}
            {neighbourhood !== 'All' &&
              ` in ${neighbourhood.replace('_', ' ')}`}
            {search && ` for "${search}"`}
          </p>
          <p className="results-summary__sort">Newest first</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* Loading skeletons */}
        {loading && (
          <div className="listing-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-image" />
                <div className="skeleton-body">
                  <div className="skeleton-line" />
                  <div className="skeleton-line skeleton-line--short" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Listings grid */}
        {!loading && filtered.length > 0 && (
          <div className="listing-grid">
            {filtered.map((listing) => (
              <ListingCard key={listing._id} listing={listing} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon"></div>
            <h3 className="empty-state__title">No listings found</h3>
            <p className="empty-state__message">
              {search
                ? `No results for "${search}"`
                : `No charcoal listings in ${neighbourhood.replace('_', ' ')} yet`}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn btn-outline">
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Load more */}
        {pagination?.hasMore && !loading && (
          <div className="load-more-container">
            <button
              className="btn btn-outline load-more-btn"
              onClick={() =>
                dispatch(
                  fetchListings({
                    neighbourhood,
                    search,
                    page: pagination.page + 1,
                  })
                )
              }
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}