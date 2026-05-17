const CACHE_VERSION = "v1.0.2";
const STATIC_CACHE = `ryuzen-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ryuzen-runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/assets/css/global.css",
  "/assets/css/layout.css",
  "/assets/css/components.css",
  "/assets/css/pages.css",
  "/assets/css/responsive.css",
  "/assets/js/api.js",
  "/assets/js/storage.js",
  "/assets/js/ui.js",
  "/assets/js/home.js",
  "/assets/js/analytics.js",
  "/assets/images/logo-placeholder.svg",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("ryuzen-") && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

    if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.endsWith("/data/site-status.json")) {
    event.respondWith(fetch(request));
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(fetch(request));
});

async function networkFirstNavigation(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match("/offline.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const freshPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || freshPromise;
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return ["style", "script", "image", "font"].includes(request.destination)
    || url.pathname.endsWith(".json")
    || url.pathname.endsWith(".webmanifest")
    || url.pathname.startsWith("/data/");
}
