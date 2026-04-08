/* ═══════════════════════════════════════════
   Agenda Builder — Service Worker
   Cache-first app shell for full offline use.
═══════════════════════════════════════════ */

const CACHE_NAME   = 'agenda-builder-v1';
const APP_SHELL    = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
];

/* ── Install: pre-cache the app shell ─────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

/* ── Activate: delete stale caches ──────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key  => caches.delete(key))
      )
    ).then(() => self.clients.claim())   // take control of all open tabs
  );
});

/* ── Fetch: cache-first for app shell,
          network-first for everything else ─ */
self.addEventListener('fetch', event => {
  // Only handle GET requests; skip non-http(s) schemes (chrome-extension, etc.)
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;

  const isAppShell = APP_SHELL.some(path => url.pathname === path || url.pathname === path + 'index.html');

  if (isAppShell) {
    /* Cache-first: serve shell instantly, update cache in background */
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          // Refresh cache in background (stale-while-revalidate)
          fetch(event.request).then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
            }
          }).catch(() => {/* offline — that's fine */});
          return cached;
        }
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
  } else {
    /* Network-first for CDN resources (fonts, SortableJS), fall back to cache */
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
