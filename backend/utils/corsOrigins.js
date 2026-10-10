// ── Allowed browser origins ────────────────────────────────
// Local dev origins are always allowed. Hosted frontends are added
// with FRONTEND_URL (comma-separated for several, e.g. Vercel
// production + preview URLs). Trailing slashes are ignored.

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

const normalise = (url) => url.trim().replace(/\/+$/, '');

const getAllowedOrigins = (env = process.env) => {
  const configured = (env.FRONTEND_URL || '')
    .split(',')
    .map(normalise)
    .filter(Boolean);
  return [...new Set([...DEV_ORIGINS, ...configured])];
};

module.exports = { getAllowedOrigins };
