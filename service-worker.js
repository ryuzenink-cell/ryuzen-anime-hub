const CACHE_VERSION = "v1.1.0-editorial-cms";
const STATIC_CACHE = `ryuzen-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ryuzen-runtime-${CACHE_VERSION}`;

const NAVIGATION_FALLBACKS = [
  { prefix: "/blog/post/", asset: "/blog/post/index.html" },
  { prefix: "/guides/proximos-animes/", asset: "/guides/proximos-animes/index.html" },
  { prefix: "/vendas-mangas/", asset: "/vendas-mangas/index.html" },
  { prefix: "/my-list/", asset: "/my-list/index.html" },
  { prefix: "/search/", asset: "/search/index.html" },
  { prefix: "/anime/", asset: "/anime/index.html" },
  { prefix: "/season/", asset: "/season/index.html" },
  { prefix: "/ranking/", asset: "/ranking/index.html" },
  { prefix: "/guides/", asset: "/guides/index.html" },
  { prefix: "/blog/", asset: "/blog/index.html" },
  { prefix: "/", asset: "/index.html" },
];

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/404.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/search/",
  "/search/index.html",
  "/anime/",
  "/anime/index.html",
  "/season/",
  "/season/index.html",
  "/ranking/",
  "/ranking/index.html",
  "/guides/",
  "/guides/index.html",
  "/guides/proximos-animes/",
  "/guides/proximos-animes/index.html",
  "/blog/",
  "/blog/index.html",
  "/blog/post/",
  "/blog/post/index.html",
  "/my-list/",
  "/my-list/index.html",
  "/vendas-mangas/",
  "/vendas-mangas/index.html",
  "/assets/css/global.css",
  "/assets/css/layout.css",
  "/assets/css/components.css",
  "/assets/css/pages.css",
  "/assets/css/responsive.css",
  "/assets/js/api.js",
  "/assets/js/storage.js",
  "/assets/js/ui.js",
  "/assets/js/home.js",
  "/assets/js/search.js",
  "/assets/js/anime.js",
  "/assets/js/season.js",
  "/assets/js/ranking.js",
  "/assets/js/my-list.js",
  "/assets/js/guides.js",
  "/assets/js/upcoming-guide.js",
  "/assets/js/manga-sales.js",
  "/assets/js/blog-core.js",
  "/assets/js/blog.js",
  "/assets/js/blog-post.js",
  "/assets/css/admin-blog.css",
  "/assets/js/admin-auth.js",
  "/assets/js/admin-blog-list.js",
  "/assets/js/admin-blog-editor.js",
  "/assets/js/analytics.js",
  "/assets/images/logo-placeholder.png",
  "/assets/images/banners/banner-left.png",
  "/assets/images/banners/banner-right.png",
  "/favicon.ico",
  "/assets/icons/icon-16.png",
  "/assets/icons/icon-32.png",
  "/assets/icons/icon-48.png",
  "/assets/icons/apple-touch-icon.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/data/blog-posts.json",
  "/data/manga-market-index.json",
  "/data/site-status.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheStaticAssets()
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

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(fetch(request));
});

async function precacheStaticAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(STATIC_ASSETS.map(async (asset) => {
    try {
      const request = new Request(asset, { cache: "reload" });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response);
    } catch (error) {
      console.warn(`Não foi possível pré-cachear ${asset}.`, error);
    }
  }));
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(request, fresh.clone());
      return fresh;
    }

    const fallback = await navigationFallback(request);
    return fallback || fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    const fallback = await navigationFallback(request);
    return fallback || caches.match("/offline.html");
  }
}

async function navigationFallback(request) {
  const url = new URL(request.url);
  const normalizedPath = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  const cleanBlogPostAsset = getCleanBlogPostFallback(normalizedPath);
  const match = cleanBlogPostAsset
    ? { asset: cleanBlogPostAsset }
    : NAVIGATION_FALLBACKS.find((route) => normalizedPath.startsWith(route.prefix));
  if (!match) return caches.match("/404.html");

  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(match.asset);
  if (cached) return cached;

  try {
    const response = await fetch(match.asset, { cache: "reload" });
    if (response.ok) {
      await cache.put(match.asset, response.clone());
      return response;
    }
  } catch {
    return null;
  }

  return null;
}

function getCleanBlogPostFallback(pathname = "") {
  if (/^\/blog\/\d{4}\/\d{2}\/[^/.][^/]*\/$/.test(pathname)) {
    return "/blog/post/index.html";
  }
  return "";
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
    || url.pathname.endsWith(".md")
    || url.pathname.endsWith(".webmanifest")
    || url.pathname.startsWith("/data/");
}
