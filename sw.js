/* ============================================================================
   Compose Pro Camera — Offline-First Service Worker (sw.js)
   Compatible with GitHub Pages (root or /repo-subpath/) & Vercel
   ============================================================================ */

const CACHE_VERSION = 'compose-pro-v2';
const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 1. Install: Pre-cache the core HTML shell and manifest immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 2. Activate: Purge outdated cache versions and take immediate control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((oldKey) => caches.delete(oldKey))
      ))
      .then(() => self.clients.claim())
  );
});

// 3. Fetch:
//    - Bypass non-GET requests (e.g., Google Apps Script Drive POST uploads & pings)
//    - Network-First with Cached Shell fallback for page navigations
//    - Cache-First with background refresh for same-origin static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept POST requests (such as Google Apps Script Drive uploads/pings)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin API calls (e.g., script.google.com / CDNs)
  if (url.origin !== self.location.origin) return;

  // Navigation requests (opening or refreshing the PWA)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          }
          return networkRes;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_VERSION);
          return (
            (await cache.match(request, { ignoreSearch: true })) ||
            (await cache.match('./index.html')) ||
            (await cache.match('./'))
          );
        })
    );
    return;
  }

  // Same-origin static files
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedRes) => {
      const networkFetch = fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const copy = networkRes.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return networkRes;
        })
        .catch(() => null);

      return cachedRes || networkFetch;
    })
  );
});