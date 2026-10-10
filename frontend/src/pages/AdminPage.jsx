import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const TABS = ['Overview', 'Users', 'Listings'];

export default function AdminPage() {
  const navigate  = useNavigate();
  const { user }  = useSelector((s) => s.auth);
  const [tab, setTab]         = useState('Overview');
  const [stats, setStats]     = useState(null);
  const [users, setUsers]     = useState([]);
  const [listings, setListing] = useState([]);
  // Which request the current users/listings belong to; loading is derived
  const [loadedKey, setLoadedKey] = useState('');
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [msg, setMsg]         = useState('');

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  // Load stats on mount
  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => setStats(data.stats)).catch(() => {});
  }, []);

  // Load users or listings when the tab or filters change
  const requestKey = `${tab}|${roleFilter}|${search}`;
  const loading = (tab === 'Users' || tab === 'Listings') && loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const done = () => { if (!cancelled) setLoadedKey(requestKey); };
    if (tab === 'Users') {
      api.get('/admin/users', { params: { role: roleFilter || undefined, search: search || undefined } })
        .then(({ data }) => { if (!cancelled) setUsers(data.users); })
        .catch(() => {})
        .finally(done);
    }
    if (tab === 'Listings') {
      api.get('/admin/listings')
        .then(({ data }) => { if (!cancelled) setListing(data.listings); })
        .catch(() => {})
        .finally(done);
    }
    return () => { cancelled = true; };
  }, [tab, roleFilter, search, requestKey]);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const verifySeller = async (id, name) => {
    if (!window.confirm(`Verify ${name} as a trusted seller?`)) return;
    await api.put(`/admin/users/${id}/verify`);
    showMsg(`✓ ${name} verified`);
    setUsers((prev) => prev.map((u) => u._id === id ? { ...u, sellerProfile: { ...u.sellerProfile, isVerified: true } } : u));
  };

  const suspendUser = async (id, name, isActive) => {
    if (!window.confirm(`${isActive ? 'Suspend' : 'Reactivate'} ${name}?`)) return;
    await api.put(`/admin/users/${id}/suspend`);
    showMsg(`${isActive ? '⛔ Suspended' : '✓ Reactivated'}: ${name}`);
    setUsers((prev) => prev.map((u) => u._id === id ? { ...u, isActive: !u.isActive } : u));
  };

  const changeRole = async (id, name, currentRole) => {
    const newRole = currentRole === 'buyer' ? 'seller' : 'buyer';
    if (!window.confirm(`Change ${name} from ${currentRole} to ${newRole}?`)) return;
    await api.put(`/admin/users/${id}/role`, { role: newRole });
    showMsg(`✓ ${name} is now a ${newRole}`);
    setUsers((prev) => prev.map((u) => u._id === id ? { ...u, role: newRole } : u));
  };

  const removeListing = async (id, title) => {
    if (!window.confirm(`Remove listing "${title}"? This cannot be undone.`)) return;
    await api.delete(`/admin/listings/${id}`);
    showMsg(`🗑 Listing removed`);
    setListing((prev) => prev.filter((l) => l._id !== id));
  };

  const statCards = stats ? [
    { label: 'Total Users',    value: stats.users.total,       icon: '👤', color: 'var(--coal)' },
    { label: 'Sellers',        value: stats.users.sellers,      icon: '🪵', color: 'var(--green)' },
    { label: 'Buyers',         value: stats.users.buyers,       icon: '🛒', color: 'var(--ember)' },
    { label: 'Active Listings',value: stats.listings.active,    icon: '📦', color: 'var(--green)' },
    { label: 'Sold Listings',  value: stats.listings.sold,      icon: '✅', color: '#BA7517' },
    { label: 'Conversations',  value: stats.conversations,      icon: '💬', color: '#185FA5' },
    { label: 'Trust Events',   value: stats.trustEvents,        icon: '🔗', color: 'var(--green)' },
    { label: 'Total Listings', value: stats.listings.total,     icon: '📊', color: 'var(--ash)' },
  ] : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Nav */}
      <nav style={{ background: 'var(--coal)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/dashboard')}
            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>←</button>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: 'white', fontSize: 18 }}>
            ⚙️ Admin Panel
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>ZamMarket 2026</span>
      </nav>

      {/* Flash message */}
      {msg && (
        <div style={{ background: 'var(--green)', color: 'white', padding: '10px 1.5rem', fontSize: 13, fontWeight: 500 }}>
          {msg}
        </div>
      )}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '7px 18px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 500, background: tab === t ? 'var(--coal)' : 'white', color: tab === t ? 'white' : 'var(--ash)', border: tab === t ? 'none' : '1px solid var(--border)' }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'Overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {statCards.map(({ label, value, icon, color }) => (
                <div key={label} className="card" style={{ textAlign: 'center', padding: '1.25rem 1rem' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color }}>{value ?? '...'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ash)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            {!stats && <p style={{ textAlign: 'center', color: 'var(--ash)', marginTop: '2rem' }}>Loading stats...</p>}
          </>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'Users' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
              <input type="text" placeholder="Search by name or phone..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }} />
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                style={{ width: 'auto' }}>
                <option value="">All roles</option>
                <option value="buyer">Buyers</option>
                <option value="seller">Sellers</option>
              </select>
            </div>

            {loading && <p style={{ color: 'var(--ash)', textAlign: 'center', padding: '2rem' }}>Loading users...</p>}

            {!loading && users.map((u) => (
              <div key={u._id} className="card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: u.role === 'seller' ? 'var(--green)' : 'var(--ember)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                  {u.name?.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{u.name}</span>
                    <span style={{ fontSize: 10, background: u.role === 'seller' ? 'var(--green-light)' : 'var(--ember-light)', color: u.role === 'seller' ? 'var(--green)' : 'var(--ember-dark)', padding: '1px 8px', borderRadius: 20 }}>
                      {u.role}
                    </span>
                    {u.sellerProfile?.isVerified && <span style={{ fontSize: 10, background: 'var(--green-light)', color: 'var(--green)', padding: '1px 8px', borderRadius: 20 }}>✓ Verified</span>}
                    {!u.isActive && <span style={{ fontSize: 10, background: '#FCEBEB', color: '#A32D2D', padding: '1px 8px', borderRadius: 20 }}>⛔ Suspended</span>}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ash)', margin: '2px 0 0' }}>
                    {u.phone} · {(u.neighbourhood || '').replace('_', ' ')}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {u.role === 'seller' && !u.sellerProfile?.isVerified && (
                    <button onClick={() => verifySeller(u._id, u.name)}
                      style={{ padding: '5px 10px', background: 'var(--green-light)', color: 'var(--green)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                      Verify
                    </button>
                  )}
                  <button onClick={() => changeRole(u._id, u.name, u.role)}
                    style={{ padding: '5px 10px', background: 'var(--cream)', color: 'var(--coal)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
                    {u.role === 'buyer' ? '→ Seller' : '→ Buyer'}
                  </button>
                  <button onClick={() => suspendUser(u._id, u.name, u.isActive)}
                    style={{ padding: '5px 10px', background: u.isActive ? '#FCEBEB' : 'var(--green-light)', color: u.isActive ? '#A32D2D' : 'var(--green)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
                    {u.isActive ? 'Suspend' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))}

            {!loading && users.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--ash)', padding: '2rem' }}>No users found.</p>
            )}
          </>
        )}

        {/* ── LISTINGS TAB ── */}
        {tab === 'Listings' && (
          <>
            {loading && <p style={{ color: 'var(--ash)', textAlign: 'center', padding: '2rem' }}>Loading listings...</p>}

            {!loading && listings.map((l) => (
              <div key={l._id} className="card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Image */}
                <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--coal)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {l.image?.url
                    ? <img src={l.image.url} alt={l.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 22 }}>🪵</span>}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--ash)', margin: '2px 0 0' }}>
                    K{l.pricePerBag}/{l.unit} · {l.seller?.name} · {(l.neighbourhood || '').replace('_', ' ')}
                  </p>
                </div>

                {/* Status + Remove */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: l.status === 'active' ? 'var(--green-light)' : '#F0EFE8', color: l.status === 'active' ? 'var(--green)' : 'var(--ash)' }}>
                    {l.status}
                  </span>
                  <button onClick={() => removeListing(l._id, l.title)}
                    style={{ padding: '5px 10px', background: '#FCEBEB', color: '#A32D2D', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {!loading && listings.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--ash)', padding: '2rem' }}>No listings found.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}