/* ==========================================================================
   Service worker.

   Strategy per request type:
     • app shell (html/css/js)  — stale-while-revalidate, so launches are
       instant and updates land on the next visit
     • model weights (Hugging Face / CDN) — cache-first with a long life;
       these files are content-addressed and never change in place
     • everything else — network with a cache fallback

   Bump CACHE_VERSION on every release.
   ========================================================================== */

const CACHE_VERSION = 'tor-v3';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const MODEL_CACHE = 'tor-models-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './css/base.css',
  './css/components.css',
  './css/views.css',
  './js/app.js',
  './js/core/utils.js',
  './js/core/db.js',
  './js/core/store.js',
  './js/data/nutrients.js',
  './js/data/foods.js',
  './js/data/dishes.js',
  './js/data/food-db.js',
  './js/data/exercise.js',
  './js/domain/targets.js',
  './js/domain/analysis.js',
  './js/vision/image.js',
  './js/vision/capabilities.js',
  './js/vision/model-engine.js',
  './js/vision/heuristic-engine.js',
  './js/vision/learning.js',
  './js/vision/portion.js',
  './js/vision/index.js',
  './js/ui/icons.js',
  './js/ui/components.js',
  './js/ui/sheet.js',
  './js/ui/toast.js',
  './js/ui/thumbs.js',
  './js/ui/undo.js',
  './js/ui/reminders.js',
  './js/ui/onboarding.js',
  './js/ui/views/dashboard.js',
  './js/ui/views/analyze.js',
  './js/ui/views/training.js',
  './js/ui/views/micro.js',
  './js/ui/views/history.js',
  './js/ui/views/settings.js',
];

const MODEL_HOSTS = [
  'huggingface.co', 'cdn-lfs.huggingface.co', 'cdn-lfs-us-1.hf.co',
  'cas-bridge.xethub.hf.co', 'cdn.jsdelivr.net', 'unpkg.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll fails the whole install if a single file 404s — add individually
    // so one missing asset can never brick the offline experience.
    await Promise.all(SHELL.map((url) => cache.add(url).catch((e) => {
      console.warn('[sw] skipped', url, e.message);
    })));
    // No skipWaiting here on purpose: a new version must not swap itself in
    // while the user is mid-edit. The page offers a "refresh" toast and sends
    // SKIP_WAITING only when they accept.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('tor-') && k !== SHELL_CACHE && k !== RUNTIME_CACHE && k !== MODEL_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Model weights and the runtime library: immutable, cache aggressively so
  // photo analysis keeps working with no network at all.
  if (MODEL_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
    event.respondWith(cacheFirst(request, MODEL_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigations always resolve to the shell so the app opens offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
    return res;
  } catch {
    return hit || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);

  const network = fetch(request).then((res) => {
    if (res.ok) {
      const isAsset = request.url.includes('/js/') || request.url.includes('/css/');
      caches.open(isAsset ? SHELL_CACHE : RUNTIME_CACHE).then((c) => c.put(request, res.clone()));
    }
    return res;
  }).catch(() => null);

  if (hit) {
    network.catch(() => {});
    return hit;
  }
  const fresh = await network;
  if (fresh) return fresh;
  const runtimeHit = await caches.match(request);
  return runtimeHit || Response.error();
}

/* ---------------- notifications ---------------- */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow(target);
  })());
});
