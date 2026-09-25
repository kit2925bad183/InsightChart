// InsightChart service worker — makes the app installable and fast to reopen.
//
// Deliberately conservative, because pages and API responses contain student data behind a
// sign-in and the app is used on shared college computers:
//   • never caches pages or /api responses — those always come from the network;
//   • caches only Next's content-hashed build files (/_next/static/…) and the app icons,
//     which contain no data and never change once published;
//   • when the network is down, shows a static "you're offline" page instead of an error.

const VERSION = "v1";
const STATIC_CACHE = `insightchart-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("insightchart-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Every deployment has new file names, so old ones pile up; keep the newest few hundred.
const MAX_ENTRIES = 400;
async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_ENTRIES;
  for (let i = 0; i < extra; i++) if (!PRECACHE.includes(new URL(keys[i].url).pathname)) await cache.delete(keys[i]);
}

const isStaticAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: always the network (fresh data, current sign-in); offline page if unreachable.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Immutable build files and icons: cache first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") {
          await cache.put(req, res.clone());
          trim(cache);
        }
        return res;
      })
    );
  }
  // Everything else (API, uploads, images) goes straight to the network untouched.
});
