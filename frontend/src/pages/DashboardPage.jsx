import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logout, upgradeToSeller } from '../store/slices/authSlice';
import { isPWA } from '../utils/pwa';
import './DashboardPage.css';

const getUserId = (user) => user?._id || user?.id || null;

/* ── Offline Banner ──────────────────────────────── */
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner">
      <span className="offline-banner__icon">📵</span>
      <div>
        <p className="offline-banner__title">You are offline</p>
        <p className="offline-banner__subtitle">
          Messages will queue and send when reconnected.
        </p>
      </div>
    </div>
  );
}

/* ── PWA Install Banner ─────────────────────────── */
function PWAInstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa_dismissed') === '1'
  );
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  if (!prompt || dismissed || isPWA()) return null;
  const install = async () => {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  };
  const dismiss = () => { setDismissed(true); localStorage.setItem('pwa_dismissed', '1'); };
  return (
    <div className="pwa-banner">
      <div className="pwa-banner__icon">🪵</div>
      <div className="pwa-banner__content">
        <p className="pwa-banner__title">Install ZamMarket</p>
        <p className="pwa-banner__subtitle">Add to home screen — works offline</p>
      </div>
      <div className="pwa-banner__actions">
        <button onClick={dismiss} className="pwa-banner__later-btn">Later</button>
        <button onClick={install} className="pwa-banner__install-btn">Install</button>
      </div>
    </div>
  );
}

/* ── Dashboard Page ──────────────────────────────── */
export default function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading } = useSelector((s) => s.auth);
  const { conversations } = useSelector((s) => s.chat);

  const userId = getUserId(user);
  const isSeller = user?.role === 'seller' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';
  const unreadTotal = conversations.reduce(
    (n, c) => n + (isSeller ? (c.unreadSeller || 0) : (c.unreadBuyer || 0)),
    0
  );
  const trustScore = user?.trustScore?.score || 50;

  const handleLogout = () => { dispatch(logout()); navigate('/login'); };
  const handleUpgrade = () => {
    const businessName = prompt('Enter your business name (optional):');
    dispatch(upgradeToSeller({ businessName }));
  };

  if (!user) return null;
  const initials = user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  // ── Seller nav — 4 items, trust score in grid only ──
  const sellerItems = [
    { icon: '📦', label: 'My Listings',  sub: 'Manage your listings',   path: '/listings/my' },
    { icon: '➕', label: 'New Listing',  sub: 'Post by voice or text',   path: '/listings/new' },
    { icon: '💬', label: 'Messages',
      sub: unreadTotal > 0 ? `${unreadTotal} unread` : 'Your inbox',
      path: '/chat', badge: unreadTotal },
    { icon: '🔗', label: 'Trust Score',  sub: `Score: ${trustScore}/100`,
      path: userId ? `/trust/${userId}` : '/trust' },
  ];

  // ── Buyer nav 
  const buyerItems = [
    { icon: '🔍', label: 'Browse Charcoal', sub: 'Find sellers near you', path: '/browse' },
    
    { icon: '💬', label: 'Messages',
      sub: unreadTotal > 0 ? `${unreadTotal} unread` : 'Your inbox',
      path: '/chat', badge: unreadTotal },

    { icon: '🪵', label: 'Become a Seller', sub: 'Post charcoal listings',
      path: null, action: 'upgrade' },
  ];

  const navItems = isSeller ? sellerItems : buyerItems;

  return (
    <div className="dashboard">
      {/* Navbar */}
      <nav className="dashboard-nav">
        <span className="dashboard-nav__logo">
          <span className="dashboard-nav__dot">●</span> ZamMarket
        </span>
        <div className="dashboard-nav__actions">
          {isAdmin && (
            <button onClick={() => navigate('/admin')} className="dashboard-nav__admin-btn">
              ⚙️ Admin
            </button>
          )}
          <button onClick={handleLogout} className="dashboard-nav__logout-btn">Log out</button>
        </div>
      </nav>

      {/* Content */}
      <div className="dashboard__content">
        <OfflineBanner />
        <PWAInstallBanner />

        {/* Profile card  */}
        <div className="card profile-card">
          <div className="profile-card__header">
            <div className="profile-avatar">{initials}</div>
            <div className="profile-info">
              <h2 className="profile-name">{user.name}</h2>
              <div className="profile-tags">
                <span className={`profile-tag ${isAdmin ? 'profile-tag--admin' : isSeller ? 'profile-tag--seller' : 'profile-tag--buyer'}`}>
                  {isAdmin ? '⚙️ Admin' : isSeller ? '🪵 Seller' : '🛒 Buyer'}
                </span>
                {user.sellerProfile?.isVerified && (
                  <span className="profile-tag--verified">✓ Verified</span>
                )}
              </div>
            </div>
          </div>

          {/* Info grid — phone + area */}
          <div className="profile-details">
            <div className="profile-detail-cell">
              <div className="profile-detail-label">Phone</div>
              <div className="profile-detail-value">{user.phone}</div>
            </div>
            <div className="profile-detail-cell">
              <div className="profile-detail-label">Area</div>
              <div className="profile-detail-value">
                {(user.neighbourhood || 'Not set').replace('_', ' ')}
              </div>
            </div>
          </div>
          
        </div>

        {/* Buyer upgrade banner */}
        {!isSeller && (
          <div className="upgrade-banner">
            <div>
              <p className="upgrade-banner__text">Start selling charcoal</p>
              <p className="upgrade-banner__subtitle">Upgrade to post listings</p>
            </div>
            <button onClick={handleUpgrade} disabled={loading} className="upgrade-banner__btn">
              {loading ? '...' : 'Upgrade →'}
            </button>
          </div>
        )}

        {/* Seller quick post banner only */}
        {isSeller && (
          <div className="seller-post-banner">
            <div>
              <p className="seller-post-banner__text">Ready to sell?</p>
              <p className="seller-post-banner__subtitle">Post by voice 🎙️ or type</p>
            </div>
            <button onClick={() => navigate('/listings/new')} className="seller-post-banner__btn">
              + Post →
            </button>
          </div>
        )}

        {/* Nav grid  */}
        <div className="nav-grid">
          {navItems.map(({ icon, label, sub, path, badge, action }) => {
            const cardContent = (
              <div className="card nav-card">
                <div className="nav-card__icon">{icon}</div>
                {badge > 0 && <div className="nav-card__badge">{badge}</div>}
                <div className="nav-card__label">{label}</div>
                <div className="nav-card__sub">{sub}</div>
              </div>
            );
            return path ? (
              <Link to={path} key={label} style={{ textDecoration: 'none' }}>
                {cardContent}
              </Link>
            ) : (
              <div key={label} onClick={action === 'upgrade' ? handleUpgrade : undefined}>
                {cardContent}
              </div>
            );
          })}
        </div>

        <p className="dashboard-footer">ZamMarket · UNZA 2026</p>
      </div>
    </div>
  );
}