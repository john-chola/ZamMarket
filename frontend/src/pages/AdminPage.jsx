import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { describeError } from '../utils/api';
import './AdminPage.css';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'verify', label: 'Verify' },
  { key: 'integrity', label: 'Integrity' },
  { key: 'users', label: 'Users' },
  { key: 'listings', label: 'Listings' },
  { key: 'activity', label: 'Activity' },
];

const ACTION_LABELS = {
  VERIFY_SELLER: 'verified seller',
  SUSPEND_USER: 'suspended',
  REACTIVATE_USER: 'reactivated',
  CHANGE_ROLE: 'changed role of',
  REMOVE_LISTING: 'removed listing',
};

const area = (n) => (n || '').replace('_', ' ');
const when = (d) => new Date(d).toLocaleString('en-ZM', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Fetch `path` whenever `key` changes; loading is derived, so no setState runs inside the effect body
function useAdminData(path, params, key) {
  const [state, setState] = useState({ key: null, data: null });
  const [nonce, setNonce] = useState(0);
  const fullKey = `${key}#${nonce}`;
  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    api.get(path, { params })
      .then(({ data }) => { if (!cancelled) setState({ key: fullKey, data }); })
      .catch((err) => {
        if (!cancelled) {
          setState({ key: fullKey, data: null });
          toast.error(describeError(err, 'Could not load admin data'));
        }
      });
    return () => { cancelled = true; };
    // params are folded into `key` by the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, fullKey]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data: state.key === fullKey ? state.data : null, loading: !!path && state.key !== fullKey, reload };
}

/* ── Confirmation dialog (optionally asks for a reason) ─── */
function ConfirmDialog({ dialog, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!dialog) return null;
  const blocked = dialog.needsReason && !reason.trim();
  const confirm = async () => {
    setBusy(true);
    try {
      await dialog.onConfirm(reason.trim());
      onClose();
    } catch (err) {
      toast.error(describeError(err, 'Action failed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="adm-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="adm-dialog-title"
        onClick={(e) => e.stopPropagation()}>
        <h3 id="adm-dialog-title" className="adm-dialog__title">{dialog.title}</h3>
        <p className="adm-dialog__text">{dialog.message}</p>
        {dialog.needsReason && (
          <>
            <label className="adm-label" htmlFor="adm-reason">Reason (recorded in the activity log)</label>
            <textarea id="adm-reason" className="adm-textarea" rows={3} maxLength={300} autoFocus
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={dialog.reasonHint || 'Why are you doing this?'} />
          </>
        )}
        <div className="adm-dialog__actions">
          <button className="adm-btn adm-btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`adm-btn ${dialog.danger ? 'adm-btn--danger' : 'adm-btn--primary'}`}
            onClick={confirm} disabled={busy || blocked}>
            {busy ? 'Working…' : dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className="adm-stat">
      <span className={`adm-stat__value ${tone ? `adm-tone-${tone}` : ''}`}>{value ?? '—'}</span>
      <span className="adm-stat__label">{label}</span>
    </div>
  );
}

function Empty({ icon, text }) {
  return <div className="adm-empty"><span aria-hidden="true">{icon}</span><p>{text}</p></div>;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const [tab, setTab] = useState('overview');
  const [dialog, setDialog] = useState(null);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [listingStatus, setListingStatus] = useState('');

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  // Debounce typing in the search boxes
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const stats = useAdminData('/admin/stats', undefined, 'stats');
  const integrity = useAdminData('/admin/trust-integrity', undefined, 'integrity');
  const pending = useAdminData(tab === 'verify' || tab === 'overview' ? '/admin/sellers/pending' : null, undefined, 'pending');
  const activity = useAdminData(tab === 'activity' || tab === 'overview' ? '/admin/activity' : null,
    { limit: tab === 'overview' ? 5 : 100 }, `activity-${tab === 'overview' ? 5 : 100}`);
  const userParams = { role: roleFilter || undefined, status: statusFilter || undefined, search: query || undefined };
  const users = useAdminData(tab === 'users' ? '/admin/users' : null, userParams, `users|${roleFilter}|${statusFilter}|${query}`);
  const listingParams = { status: listingStatus || undefined, search: query || undefined };
  const listings = useAdminData(tab === 'listings' ? '/admin/listings' : null, listingParams, `listings|${listingStatus}|${query}`);

  const s = stats.data?.stats;
  const pendingCount = s?.sellers?.pendingVerification ?? pending.data?.sellers?.length ?? 0;
  const invalid = integrity.data?.invalid || [];

  const refreshAll = () => { stats.reload(); integrity.reload(); pending.reload(); activity.reload(); users.reload(); listings.reload(); };
  const switchTab = (key) => { setTab(key); setSearch(''); setQuery(''); };

  // ── Actions ───────────────────────────────────────────
  const verify = (u) => setDialog({
    title: `Verify ${u.name}?`,
    message: 'The seller gets a Verified badge and +15 on their trust score. This is recorded on their trust chain and cannot be undone.',
    confirmLabel: 'Verify seller',
    onConfirm: async () => {
      await api.put(`/admin/users/${u._id}/verify`);
      toast.success(`${u.name} verified`);
      refreshAll();
    },
  });

  const toggleSuspend = (u) => setDialog(u.isActive ? {
    title: `Suspend ${u.name}?`,
    message: u.role === 'seller'
      ? 'They will be logged out and all their active listings will be paused.'
      : 'They will be logged out and cannot sign in until reactivated.',
    needsReason: true,
    reasonHint: 'e.g. Several buyers reported short-weight bags',
    danger: true,
    confirmLabel: 'Suspend',
    onConfirm: async (reason) => {
      await api.put(`/admin/users/${u._id}/suspend`, { reason });
      toast.success(`${u.name} suspended`);
      refreshAll();
    },
  } : {
    title: `Reactivate ${u.name}?`,
    message: 'They can sign in again. Paused listings stay paused until the seller reactivates them.',
    confirmLabel: 'Reactivate',
    onConfirm: async () => {
      await api.put(`/admin/users/${u._id}/suspend`);
      toast.success(`${u.name} reactivated`);
      refreshAll();
    },
  });

  const changeRole = (u) => {
    const to = u.role === 'buyer' ? 'seller' : 'buyer';
    setDialog({
      title: `Make ${u.name} a ${to}?`,
      message: to === 'seller' ? 'They will be able to post listings.' : 'They will no longer be able to post listings.',
      confirmLabel: `Make ${to}`,
      onConfirm: async () => {
        await api.put(`/admin/users/${u._id}/role`, { role: to });
        toast.success(`${u.name} is now a ${to}`);
        refreshAll();
      },
    });
  };

  const removeListing = (l) => setDialog({
    title: 'Remove this listing?',
    message: `"${l.title}" by ${l.seller?.name || 'unknown seller'} will be deleted with its photo. This cannot be undone.`,
    needsReason: true,
    reasonHint: 'e.g. Not charcoal / misleading price',
    danger: true,
    confirmLabel: 'Remove listing',
    onConfirm: async (reason) => {
      await api.delete(`/admin/listings/${l._id}`, { data: { reason } });
      toast.success('Listing removed');
      refreshAll();
    },
  });

  // ── Rendering helpers ─────────────────────────────────
  const userRow = (u) => {
    const isAdmin = u.role === 'admin';
    return (
      <div key={u._id} className="adm-row">
        <div className={`adm-avatar adm-avatar--${u.role}`}>{u.name?.charAt(0).toUpperCase()}</div>
        <div className="adm-row__body">
          <div className="adm-row__title">
            {u.name}
            <span className={`adm-chip adm-chip--${u.role}`}>{u.role}</span>
            {u.sellerProfile?.isVerified && <span className="adm-chip adm-chip--good">✓ Verified</span>}
            {!u.isActive && <span className="adm-chip adm-chip--bad">Suspended</span>}
          </div>
          <p className="adm-row__meta">{u.phone} · {area(u.neighbourhood)} · joined {new Date(u.createdAt).toLocaleDateString('en-ZM')}</p>
        </div>
        {!isAdmin && (
          <div className="adm-row__actions">
            {u.role === 'seller' && u.isActive && !u.sellerProfile?.isVerified && (
              <button className="adm-btn adm-btn--small adm-btn--primary" onClick={() => verify(u)}>Verify</button>
            )}
            <button className="adm-btn adm-btn--small adm-btn--ghost" onClick={() => changeRole(u)}>
              Make {u.role === 'buyer' ? 'seller' : 'buyer'}
            </button>
            <button className={`adm-btn adm-btn--small ${u.isActive ? 'adm-btn--danger-soft' : 'adm-btn--ghost'}`}
              onClick={() => toggleSuspend(u)}>
              {u.isActive ? 'Suspend' : 'Reactivate'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const activityList = (entries) => (
    <ul className="adm-activity">
      {entries.map((e) => (
        <li key={e._id} className="adm-activity__item">
          <span className="adm-activity__time">{when(e.createdAt)}</span>
          <span><strong>{e.adminName || 'Admin'}</strong> {ACTION_LABELS[e.action] || e.action} <strong>{e.targetName}</strong></span>
          {e.detail && <span className="adm-activity__detail">“{e.detail}”</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="adm-page">
      <nav className="adm-nav">
        <button className="adm-nav__back" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">←</button>
        <span className="adm-nav__title">Admin</span>
        <span className="adm-nav__user">{user?.name}</span>
      </nav>

      <div className="adm-tabs" role="tablist">
        {TABS.map((t) => {
          const badge = t.key === 'verify' ? pendingCount : t.key === 'integrity' ? invalid.length : 0;
          return (
            <button key={t.key} role="tab" aria-selected={tab === t.key}
              className={`adm-tab ${tab === t.key ? 'adm-tab--active' : ''}`} onClick={() => switchTab(t.key)}>
              {t.label}
              {badge > 0 && <span className={`adm-badge ${t.key === 'integrity' ? 'adm-badge--bad' : ''}`}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <main className="adm-content">
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <section className="adm-section">
              <h2 className="adm-h2">Needs attention</h2>
              <div className="adm-attention">
                <button className={`adm-alert ${invalid.length ? 'adm-alert--bad' : 'adm-alert--good'}`} onClick={() => switchTab('integrity')}>
                  <span className="adm-alert__value">{integrity.loading ? '…' : invalid.length}</span>
                  <span className="adm-alert__label">{invalid.length === 1 ? 'trust record failed verification' : 'trust records failed verification'}</span>
                </button>
                <button className={`adm-alert ${pendingCount ? 'adm-alert--warn' : 'adm-alert--good'}`} onClick={() => switchTab('verify')}>
                  <span className="adm-alert__value">{stats.loading ? '…' : pendingCount}</span>
                  <span className="adm-alert__label">{pendingCount === 1 ? 'seller awaiting verification' : 'sellers awaiting verification'}</span>
                </button>
                <button className="adm-alert" onClick={() => { setStatusFilter('suspended'); switchTab('users'); }}>
                  <span className="adm-alert__value">{s?.users?.suspended ?? '…'}</span>
                  <span className="adm-alert__label">{s?.users?.suspended === 1 ? 'suspended account' : 'suspended accounts'}</span>
                </button>
              </div>
            </section>

            <section className="adm-section">
              <h2 className="adm-h2">Marketplace</h2>
              <div className="adm-stats">
                <Stat value={s?.users?.total} label="Users" />
                <Stat value={s?.users?.sellers} label="Sellers" />
                <Stat value={s?.users?.buyers} label="Buyers" />
                <Stat value={s?.users?.newThisWeek} label="New this week" tone="ember" />
                <Stat value={s?.listings?.active} label="Active listings" tone="green" />
                <Stat value={s?.listings?.sold} label="Sold" />
                <Stat value={s?.conversations} label="Conversations" />
                <Stat value={s?.trustEvents} label="Trust events" />
              </div>
            </section>

            <section className="adm-section">
              <div className="adm-section__head">
                <h2 className="adm-h2">Recent admin activity</h2>
                <button className="adm-link" onClick={() => switchTab('activity')}>See all</button>
              </div>
              {activity.data?.entries?.length
                ? activityList(activity.data.entries)
                : !activity.loading && <Empty icon="📋" text="No admin actions yet." />}
            </section>
          </>
        )}

        {/* ── VERIFY ── */}
        {tab === 'verify' && (
          <section className="adm-section">
            <p className="adm-intro">Sellers waiting for verification, oldest first. Check their trust record and listings before verifying.</p>
            {pending.loading && <p className="adm-loading">Loading sellers…</p>}
            {!pending.loading && pending.data?.sellers?.length === 0 && <Empty icon="✅" text="No sellers are waiting for verification." />}
            <div className="adm-cards">
              {pending.data?.sellers?.map((p) => (
                <div key={p._id} className="adm-card">
                  <div className="adm-card__head">
                    <div className="adm-avatar adm-avatar--seller">{p.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <p className="adm-card__name">{p.name}</p>
                      <p className="adm-row__meta">{p.businessName || 'No business name'} · {area(p.neighbourhood)}</p>
                    </div>
                  </div>
                  <div className="adm-mini-stats">
                    <Stat value={p.trustScore} label="Trust" tone={p.trustScore >= 70 ? 'green' : 'ember'} />
                    <Stat value={p.listings} label="Listings" />
                    <Stat value={p.ratingCount ? `${p.rating}★` : '—'} label={`${p.ratingCount} rating${p.ratingCount === 1 ? '' : 's'}`} />
                  </div>
                  <p className="adm-row__meta">Joined {new Date(p.createdAt).toLocaleDateString('en-ZM')}</p>
                  <div className="adm-card__actions">
                    <Link className="adm-btn adm-btn--ghost" to={`/trust/${p._id}`}>Trust record</Link>
                    <button className="adm-btn adm-btn--primary" onClick={() => verify(p)}>Verify</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── INTEGRITY ── */}
        {tab === 'integrity' && (
          <section className="adm-section">
            <div className="adm-section__head">
              <p className="adm-intro">
                Every seller&apos;s trust chain is re-hashed and checked against the hash stored on their account.
                {integrity.data && ` Checked ${integrity.data.checked} sellers and ${integrity.data.blocks} blocks at ${when(integrity.data.checkedAt)}.`}
              </p>
              <button className="adm-btn adm-btn--ghost" onClick={integrity.reload} disabled={integrity.loading}>
                {integrity.loading ? 'Checking…' : 'Run check again'}
              </button>
            </div>
            {!integrity.loading && integrity.data && invalid.length === 0 && (
              <div className="adm-banner adm-banner--good">🔗 All trust records are intact.</div>
            )}
            {invalid.length > 0 && (
              <>
                <div className="adm-banner adm-banner--bad">
                  ⚠️ {invalid.length} seller{invalid.length > 1 ? 's have' : ' has'} a trust record that was altered after it was written.
                  Their scores should not be relied on until investigated.
                </div>
                {invalid.map((i) => (
                  <div key={i._id} className="adm-row adm-row--bad">
                    <div className="adm-avatar adm-avatar--bad">!</div>
                    <div className="adm-row__body">
                      <div className="adm-row__title">
                        {i.name}
                        {!i.isActive && <span className="adm-chip adm-chip--bad">Suspended</span>}
                      </div>
                      <p className="adm-row__meta">
                        {area(i.neighbourhood)} · {i.blocks} block{i.blocks === 1 ? '' : 's'} · stored score {i.storedScore ?? '—'}, chain gives {i.chainScore}
                      </p>
                    </div>
                    <div className="adm-row__actions">
                      <Link className="adm-btn adm-btn--small adm-btn--ghost" to={`/trust/${i._id}`}>Open record</Link>
                      {i.isActive && (
                        <button className="adm-btn adm-btn--small adm-btn--danger-soft"
                          onClick={() => toggleSuspend({ _id: i._id, name: i.name, role: 'seller', isActive: true })}>
                          Suspend
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <section className="adm-section">
            <div className="adm-filters">
              <input type="text" className="adm-search" placeholder="Search name or phone…" aria-label="Search users"
                value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
                <option value="">All roles</option>
                <option value="seller">Sellers</option>
                <option value="buyer">Buyers</option>
                <option value="admin">Admins</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            {users.loading && <p className="adm-loading">Loading users…</p>}
            {!users.loading && users.data?.users?.length === 0 && <Empty icon="👤" text="No users match these filters." />}
            {!users.loading && users.data?.users?.map(userRow)}
            {!users.loading && users.data?.pagination?.total > (users.data?.users?.length || 0) && (
              <p className="adm-loading">Showing {users.data.users.length} of {users.data.pagination.total}. Narrow the search to find others.</p>
            )}
          </section>
        )}

        {/* ── LISTINGS ── */}
        {tab === 'listings' && (
          <section className="adm-section">
            <div className="adm-filters">
              <input type="text" className="adm-search" placeholder="Search listing titles…" aria-label="Search listings"
                value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={listingStatus} onChange={(e) => setListingStatus(e.target.value)} aria-label="Filter by status">
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            {listings.loading && <p className="adm-loading">Loading listings…</p>}
            {!listings.loading && listings.data?.listings?.length === 0 && <Empty icon="📦" text="No listings match these filters." />}
            {!listings.loading && listings.data?.listings?.map((l) => (
              <div key={l._id} className="adm-row">
                <div className="adm-thumb">
                  {l.image?.url ? <img src={l.image.url} alt="" /> : <span aria-hidden="true">🪵</span>}
                </div>
                <div className="adm-row__body">
                  <div className="adm-row__title">
                    <span className="adm-ellipsis">{l.title}</span>
                    <span className={`adm-chip adm-chip--${l.status}`}>{l.status}</span>
                  </div>
                  <p className="adm-row__meta">K{l.pricePerBag}/{l.unit} · {l.quantityAvailable} left · {l.seller?.name} · {area(l.neighbourhood)}</p>
                </div>
                <div className="adm-row__actions">
                  <Link className="adm-btn adm-btn--small adm-btn--ghost" to={`/listings/${l._id}`}>View</Link>
                  <button className="adm-btn adm-btn--small adm-btn--danger-soft" onClick={() => removeListing(l)}>Remove</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── ACTIVITY ── */}
        {tab === 'activity' && (
          <section className="adm-section">
            <p className="adm-intro">Every verification, suspension, role change and removal, newest first.</p>
            {activity.loading && <p className="adm-loading">Loading activity…</p>}
            {!activity.loading && activity.data?.entries?.length === 0 && <Empty icon="📋" text="No admin actions yet." />}
            {activity.data?.entries?.length > 0 && activityList(activity.data.entries)}
          </section>
        )}
      </main>

      <ConfirmDialog key={dialog?.title || 'none'} dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
