/* SPEECK.AI service worker — installability + app-shell caching.
 * The practice core needs the network (LLM/TTS), so we cache the shell + static
 * assets and fall back to an offline page for navigations; API and cross-origin
 * calls (Supabase, TTS) always go to the network. */
const CACHE = 'speeck-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase / external APIs
  if (url.pathname.startsWith('/api/')) return;      // never cache API responses

  // Page navigations: network-first, fall back to cache then the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match(OFFLINE))),
    );
    return;
  }

  // Static assets: cache-first, then network (and populate the cache).
  const isAsset = url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icons/')
    || /\.(?:png|jpg|jpeg|svg|webp|gif|ico|woff2?|css|js|mp4|json)$/.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached)),
    );
  }
});
