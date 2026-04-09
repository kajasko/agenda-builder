/* ═══════════════════════════════════════════
   Agenda Builder — Service Worker
   Cache-first app shell for full offline use.
   Hosted at: /agenda-builder/
═══════════════════════════════════════════ */

const CACHE_NAME = 'agenda-builder-v3';
const BASE       = '/agenda-builder';
const APP_SHELL  = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon.png',
  BASE + '/sw.js',
];

/* ── Install: pre-cache the app shell ─────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
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
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first for app shell,
          network-first for everything else ─ */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;

  const isAppShell = APP_SHELL.some(p =>
    url.pathname === p ||
    url.pathname === p.replace(/\/$/, '') ||
    url.pathname === p + 'index.html'
  );

  if (isAppShell) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          fetch(event.request).then(response => {
            if (response && response.status === 200)
              caches.open(CACHE_NAME).then(c => c.put(event.request, response));
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request).then(response => {
          if (response && response.status === 200)
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          return response;
        });
      })
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
