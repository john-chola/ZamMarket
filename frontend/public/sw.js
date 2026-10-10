// ZamMarket Service Worker — Sprint 3
// Offline-first PWA: cache listings, enable offline create + message queue

// Bump the version whenever caching rules change: old caches are deleted on activate
const CACHE_NAME    = 'zammarket-v2';
const API_CACHE     = 'zammarket-api-v2';

// App shell cached on install. Vite's hashed JS/CSS files are cached
// the first time they load (see cacheFirstStatic).
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// Never cached: auth responses and admin data
const NO_CACHE_API = ['/api/auth/', '/api/admin/'];

// ── Install: cache static shell ────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache what we can — ignore failures (fonts may be blocked)
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url).catch(() => null))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: offline-first strategy ─────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET requests (POST/PUT handled by background sync)
  if (request.method !== 'GET') return;

  // Skip browser-extension and chrome-extension requests
  if (!url.protocol.startsWith('http')) return;

  // API requests (same origin in dev, the hosted API in production)
  // — network first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    if (NO_CACHE_API.some((p) => url.pathname.startsWith(p))) return;
    e.respondWith(networkFirstAPI(request));
    return;
  }

  // Page navigations — network first so a new deploy is picked up,
  // falling back to the cached app shell when offline
  if (request.mode === 'navigate') {
    e.respondWith(networkFirstPage(request));
    return;
  }

  // Only cache our own static files
  if (url.origin !== self.location.origin) return;

  // Static assets — cache first, fall back to network
  e.respondWith(cacheFirstStatic(request));
});

// Network first with cache fallback (for API)
async function networkFirstAPI(request) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline — serve from cache
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return empty listings array for browse page
    if (request.url.includes('/api/listings')) {
      return new Response(
        JSON.stringify({
          status: 'success',
          listings: [],
          pagination: { total: 0, page: 1, pages: 0, hasMore: false },
          offline: true,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ status: 'error', message: 'You are offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Network first for HTML pages, cached shell when offline
async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    const fallback = await caches.match('/index.html');
    return fallback || new Response('Offline', { status: 503 });
  }
}

// Cache first (for static files)
async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return cached index.html for navigation (SPA fallback)
    const fallback = await caches.match('/index.html');
    return fallback || new Response('Offline', { status: 503 });
  }
}

// ── Background sync: flush offline queue ──────────────────
self.addEventListener('sync', (e) => {
  if (e.tag === 'zammarket-sync-messages') {
    e.waitUntil(syncOfflineMessages());
  }
});

async function syncOfflineMessages() {
  // Notify all open clients to flush their IndexedDB queue
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage({ type: 'FLUSH_QUEUE' }));
}