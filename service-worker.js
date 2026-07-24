const CACHE_VERSION = "v2.2.0-discovery-fix";
const STATIC_CACHE = `ryuzen-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `ryuzen-runtime-${CACHE_VERSION}`;

const NAVIGATION_FALLBACKS = [
  { prefix: "/blog/post/", asset: "/blog/post/index.html" },
  { prefix: "/conta/entrar/", asset: "/conta/entrar/index.html" },
  { prefix: "/conta/criar/", asset: "/conta/criar/index.html" },
  { prefix: "/conta/perfil/", asset: "/conta/perfil/index.html" },
  { prefix: "/guides/proximos-animes/", asset: "/guides/proximos-animes/index.html" },
  { prefix: "/vendas-mangas/", asset: "/vendas-mangas/index.html" },
  { prefix: "/my-list/", asset: "/my-list/index.html" },
  { prefix: "/search/", asset: "/search/index.html" },
  { prefix: "/anime/", asset: "/anime/index.html" },
  { prefix: "/season/", asset: "/season/index.html" },
  { prefix: "/ranking/", asset: "/ranking/index.html" },
  { prefix: "/guides/", asset: "/guides/index.html" },
  { prefix: "/blog/", asset: "/blog/index.html" },
  { prefix: "/loja/", asset: "/loja/index.html" },
  { prefix: "/", asset: "/index.html" },
];

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/404.html",
  "/offline.html",
  "/manifest.webmanifest?v=20260724-discovery-fix-v1",
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
  "/loja/",
  "/loja/index.html",
  "/blog/post/",
  "/blog/post/index.html",
  "/my-list/",
  "/my-list/index.html",
  "/vendas-mangas/",
  "/vendas-mangas/index.html",
  "/conta/entrar/",
  "/conta/entrar/index.html",
  "/conta/criar/",
  "/conta/criar/index.html",
  "/conta/perfil/",
  "/conta/perfil/index.html",
  "/assets/css/global.css?v=20260724-discovery-fix-v1",
  "/assets/css/layout.css?v=20260724-discovery-fix-v1",
  "/assets/css/components.css?v=20260724-discovery-fix-v1",
  "/assets/css/pages.css?v=20260724-discovery-fix-v1",
  "/assets/css/responsive.css?v=20260724-discovery-fix-v1",
  "/assets/css/public-ui.css?v=20260724-discovery-fix-v1",
  "/assets/js/api.js?v=20260724-discovery-fix-v1",
  "/assets/js/storage.js?v=20260724-discovery-fix-v1",
  "/assets/js/ui.js?v=20260724-discovery-fix-v1",
  "/assets/js/home.js?v=20260724-discovery-fix-v1",
  "/assets/js/home-store.js?v=20260724-discovery-fix-v1",
  "/assets/js/store.js?v=20260724-discovery-fix-v1",
  "/assets/js/analytics.js?v=20260724-discovery-fix-v1",
  "/assets/js/public-ui.js?v=20260724-discovery-fix-v1",
  "/assets/js/search.js?v=20260724-discovery-fix-v1",
  "/assets/js/anime.js?v=20260724-discovery-fix-v1",
  "/assets/js/season.js?v=20260724-discovery-fix-v1",
  "/assets/js/ranking.js?v=20260724-discovery-fix-v1",
  "/assets/js/my-list.js?v=20260724-discovery-fix-v1",
  "/assets/js/guides.js?v=20260724-discovery-fix-v1",
  "/assets/js/upcoming-guide.js?v=20260724-discovery-fix-v1",
  "/assets/js/manga-sales.js?v=20260724-discovery-fix-v1",
  "/assets/js/blog-core.js?v=20260724-discovery-fix-v1",
  "/assets/js/blog.js?v=20260724-discovery-fix-v1",
  "/assets/js/blog-post.js?v=20260724-discovery-fix-v1",
  "/assets/js/account-login.js?v=20260724-discovery-fix-v1",
  "/assets/js/account-register.js?v=20260724-discovery-fix-v1",
  "/assets/js/account-profile.js?v=20260724-discovery-fix-v1",
  "/assets/images/logo-placeholder.webp?v=20260724-discovery-fix-v1",
  "/assets/images/banners/banner-left.webp?v=20260724-discovery-fix-v1",
  "/assets/images/banners/banner-right.webp?v=20260724-discovery-fix-v1",
  "/favicon.ico?v=20260724-discovery-fix-v1",
  "/assets/icons/icon-16.png?v=20260724-discovery-fix-v1",
  "/assets/icons/icon-32.png?v=20260724-discovery-fix-v1",
  "/assets/icons/icon-48.png?v=20260724-discovery-fix-v1",
  "/assets/icons/apple-touch-icon.png?v=20260724-discovery-fix-v1",
  "/assets/icons/icon-192.png?v=20260724-discovery-fix-v1",
  "/assets/icons/icon-512.png?v=20260724-discovery-fix-v1",
  "/data/blog-posts.json",
  "/data/manga-market-index.json",
  "/data/site-status.json",
  "/data/avatars.json",
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

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/") || /^\/assets\/(?:js|css)\/admin-/.test(url.pathname)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // Artigos dinâmicos e sitemap do D1 devem refletir publicação/arquivamento imediatamente.
  // Não oferecer fallback estático de /blog/ para um slug dinâmico inexistente ou arquivado.
  if (url.pathname.startsWith("/blog/p/") || url.pathname === "/sitemap-blog-dynamic.xml") {
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
