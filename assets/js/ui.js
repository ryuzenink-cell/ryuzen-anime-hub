const RYZEN_ROUTE_SEGMENTS = [
  "blog/post",
  "vendas-mangas",
  "my-list",
  "anime",
  "search",
  "season",
  "ranking",
  "guides",
  "blog",
];

const RYZEN_BASE_PATH = (() => {
  const path = window.location.pathname;
  for (const segment of RYZEN_ROUTE_SEGMENTS) {
    const marker = `/${segment}/`;
    const index = path.indexOf(marker);
    if (index !== -1) return path.slice(0, index + 1);
  }
  return path.endsWith("/") ? path : path.replace(/[^/]*$/, "");
})();

const RYZEN_ROUTES = {
  home: sitePath(""),
  search: sitePath("search/"),
  anime: sitePath("anime/"),
  season: sitePath("season/"),
  ranking: sitePath("ranking/"),
  mangaSales: sitePath("vendas-mangas/"),
  blog: sitePath("blog/"),
  blogPost: sitePath("blog/post/"),
  myList: sitePath("my-list/"),
  guides: sitePath("guides/"),
};

function sitePath(path = "") {
  const cleanPath = String(path).replace(/^\/+/, "");
  if (window.location.protocol === "file:") {
    return new URL(cleanPath, window.location.href.replace(/(?:index\.html)?(?:[#?].*)?$/, "")).href;
  }
  const base = RYZEN_BASE_PATH.endsWith("/") ? RYZEN_BASE_PATH : `${RYZEN_BASE_PATH}/`;
  return `${base}${cleanPath}`.replace(/([^:])\/\/{2,}/g, "$1/");
}

function routeWithQuery(route, params = {}) {
  const url = new URL(route, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
}

function assetPath(path = "") {
  return sitePath(`assets/${String(path).replace(/^\/+/, "")}`);
}

function dataPath(path = "") {
  return sitePath(`data/${String(path).replace(/^\/+/, "")}`);
}

function imageOf(anime) {
  const imageUrl = anime?.images?.webp?.large_image_url || anime?.images?.jpg?.large_image_url || anime?.image;
  return safeUrl(imageUrl, assetPath("images/logo-placeholder.png"));
}

function yearOf(anime) {
  return anime.year || anime.aired?.prop?.from?.year || "Ano indef.";
}

function formatScore(score) {
  return score ? Number(score).toFixed(2) : "S/N";
}

function getCurrentRouteKey() {
  const path = location.pathname.replace(/\/index\.html$/, "/");
  if (path.includes("/blog/post/")) return "blogPost";
  if (path.includes("/vendas-mangas/")) return "mangaSales";
  if (path.includes("/my-list/")) return "myList";
  if (path.includes("/anime/")) return "anime";
  if (path.includes("/search/")) return "search";
  if (path.includes("/season/")) return "season";
  if (path.includes("/ranking/")) return "ranking";
  if (path.includes("/guides/")) return "guides";
  if (path.includes("/blog/")) return "blog";
  return "home";
}

function setActiveNav() {
  const currentRoute = getCurrentRouteKey();
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const route = link.dataset.route;
    const isActive = route === currentRoute || (currentRoute === "blogPost" && route === "blog");
    link.classList.toggle("active", isActive);
  });
}

function renderHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  header.innerHTML = `
    <header class="site-header">
      <div class="container nav-wrap">
        <a class="brand" href="${RYZEN_ROUTES.home}" aria-label="Ryuzen Anime Hub">
          <img src="${assetPath("images/logo-placeholder.png")}" alt="" width="38" height="38">
          <strong>Ryuzen <span>Anime Hub</span></strong>
        </a>
        <nav class="main-nav" aria-label="Navegação principal">
          <a data-route="home" href="${RYZEN_ROUTES.home}">Home</a>
          <a data-route="search" href="${RYZEN_ROUTES.search}">Busca</a>
          <a data-route="season" href="${RYZEN_ROUTES.season}">Temporada</a>
          <a data-route="ranking" href="${RYZEN_ROUTES.ranking}">Ranking</a>
          <a data-route="mangaSales" href="${RYZEN_ROUTES.mangaSales}">Mangás</a>
          <a data-route="blog" href="${RYZEN_ROUTES.blog}">Blog</a>
          <a data-route="myList" href="${RYZEN_ROUTES.myList}">Minha lista</a>
          <a data-route="guides" href="${RYZEN_ROUTES.guides}">Guias</a>
        </nav>
      </div>
    </header>`;
  setActiveNav();
}

function renderFooter() {
  const footer = document.querySelector("[data-footer]");
  if (!footer) return;
  footer.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <strong>Ryuzen Anime Hub</strong>
          <p>Central brasileira para descobrir, acompanhar e organizar animes.</p>
        </div>
        <p>Produto experimental da Ryuzen para anime.ryuzen.ink.</p>
      </div>
    </footer>`;
}

function createSearchBar({ value = "", placeholder = "Busque por título, franquia ou temporada", action = RYZEN_ROUTES.search } = {}) {
  return `
    <form class="search-box" data-search-form action="${escapeHtml(action)}">
      <label class="sr-only" for="global-search">Buscar anime</label>
      <input id="global-search" name="q" type="search" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off">
      <button class="btn primary" type="submit">Buscar</button>
    </form>`;
}

function bindSearchForms() {
  document.querySelectorAll("[data-search-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input[name='q']");
      const query = input.value.trim();
      if (query) location.href = routeWithQuery(RYZEN_ROUTES.search, { q: query });
    });
  });
}

function createGenreTags(genres = []) {
  return `<div class="tags">${genres.slice(0, 3).map((genre) => `<span class="tag">${escapeHtml(genre.name)}</span>`).join("")}</div>`;
}

function createAnimeCard(anime) {
  const animeId = Number(anime.mal_id);
  const title = escapeHtml(anime.title);
  const animeUrl = routeWithQuery(RYZEN_ROUTES.anime, { id: animeId });
  return `
    <article class="anime-card">
      <a href="${animeUrl}" aria-label="Ver detalhes de ${title}">
        <img class="poster" src="${escapeHtml(imageOf(anime))}" alt="Capa de ${title}" loading="lazy">
      </a>
      <div class="anime-card-body">
        <h3 class="anime-title">${title}</h3>
        <div class="meta-line">
          <span class="badge score">Nota ${formatScore(anime.score)}</span>
          <span>${escapeHtml(anime.type || "Anime")}</span>
          <span>${escapeHtml(yearOf(anime))}</span>
        </div>
        <div class="meta-line">
          <span>${escapeHtml(anime.episodes || "?")} eps</span>
          <span>${escapeHtml(anime.status || "Status indef.")}</span>
        </div>
        ${createGenreTags(anime.genres)}
        <a class="btn ghost" href="${animeUrl}">Ver detalhes</a>
      </div>
    </article>`;
}

function createRankingRow(anime, position) {
  const animeId = Number(anime.mal_id);
  const title = escapeHtml(anime.title);
  const animeUrl = routeWithQuery(RYZEN_ROUTES.anime, { id: animeId });
  return `
    <article class="ranking-row">
      <div class="ranking-pos">#${escapeHtml(position)}</div>
      <img class="ranking-thumb" src="${escapeHtml(imageOf(anime))}" alt="Capa de ${title}" loading="lazy">
      <div>
        <h3>${title}</h3>
        <div class="meta-line">
          <span class="badge score">Nota ${formatScore(anime.score)}</span>
          <span>${escapeHtml(anime.type || "Anime")}</span>
          <span>${escapeHtml(anime.episodes || "?")} eps</span>
          <span>${escapeHtml(yearOf(anime))}</span>
        </div>
      </div>
      <a class="btn" href="${animeUrl}">Ver detalhes</a>
    </article>`;
}

function renderLoading(target, count = 5) {
  target.innerHTML = `<div class="skeleton-grid">${Array.from({ length: count }, () => `<div class="skeleton"></div>`).join("")}</div>`;
}

function renderEmpty(target, title, text, button = "") {
  target.innerHTML = `<div class="state"><h2>${title}</h2><p>${text}</p>${button}</div>`;
}

function renderError(target, message) {
  target.innerHTML = `<div class="state"><h2>Algo saiu do roteiro</h2><p>${message}</p></div>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function safeUrl(value, fallback = "#") {
  if (!value) return fallback;
  const rawValue = String(value).trim();
  if (rawValue.startsWith("assets/")) return assetPath(rawValue.replace(/^assets\//, ""));
  if (rawValue.startsWith("/assets/")) return sitePath(rawValue.replace(/^\//, ""));
  try {
    const url = new URL(rawValue, window.location.href);
    const isAllowedProtocol = ["http:", "https:"].includes(url.protocol);
    const isSameOrigin = url.origin === window.location.origin;
    if (isAllowedProtocol || isSameOrigin) return url.href;
  } catch {
    return fallback;
  }
  return fallback;
}

function safeYouTubeEmbedUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    const allowedHosts = ["www.youtube.com", "www.youtube-nocookie.com"];
    if (url.protocol === "https:" && allowedHosts.includes(url.hostname) && url.pathname.startsWith("/embed/")) {
      return url.href;
    }
  } catch {
    return "";
  }
  return "";
}

function renderAnimeDetailLoading(root) {
  root.innerHTML = `
    <section class="detail-layout anime-detail-loading">
      <aside>
        <div class="skeleton skeleton-cover"></div>
      </aside>

      <article>
        <div class="skeleton skeleton-eyebrow"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-subtitle"></div>

        <div class="stats-grid">
          <div class="stat skeleton-stat">
            <div class="skeleton skeleton-stat-number"></div>
            <div class="skeleton skeleton-stat-label"></div>
          </div>
          <div class="stat skeleton-stat">
            <div class="skeleton skeleton-stat-number"></div>
            <div class="skeleton skeleton-stat-label"></div>
          </div>
          <div class="stat skeleton-stat">
            <div class="skeleton skeleton-stat-number"></div>
            <div class="skeleton skeleton-stat-label"></div>
          </div>
          <div class="stat skeleton-stat">
            <div class="skeleton skeleton-stat-number"></div>
            <div class="skeleton skeleton-stat-label"></div>
          </div>
        </div>

        <div class="skeleton-text-block">
          <div class="skeleton skeleton-line long"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line medium"></div>
          <div class="skeleton skeleton-line short"></div>
        </div>

        <div class="skeleton-tags">
          <div class="skeleton skeleton-pill"></div>
          <div class="skeleton skeleton-pill"></div>
          <div class="skeleton skeleton-pill"></div>
          <div class="skeleton skeleton-pill"></div>
        </div>
      </article>
    </section>
  `;
}

function renderPromoSidebars() {
  const allowedRoutes = [
    "home",
    "search",
    "season",
    "ranking",
    "mangaSales",
    "blog",
    "blogPost",
    "myList",
    "guides"
  ];

  const currentRoute = getCurrentRouteKey();

  if (!allowedRoutes.includes(currentRoute)) return;

  const existing = document.querySelector(".promo-sidebars");
  if (existing) existing.remove();

  const wrapper = document.createElement("aside");
  wrapper.className = "promo-sidebars";
  wrapper.setAttribute("aria-label", "Banners promocionais Ryuzen");

  /*wrapper.innerHTML = `
    <a class="promo-rail promo-rail-left" href="${RYZEN_ROUTES.blog}" aria-label="Ler o blog do Ryuzen Anime Hub">
      <span class="promo-kicker">Ryuzen Blog</span>
      <strong>Guias, listas e análises de anime</strong>
      <span>Leia agora</span>
    </a>

    <a class="promo-rail promo-rail-right" href="${RYZEN_ROUTES.guides}" aria-label="Abrir guias do Ryuzen Anime Hub">
      <span class="promo-kicker">Guias Ryuzen</span>
      <strong>Descubra novas obras para assistir</strong>
      <span>Explorar</span>
    </a>
  `;*/

  wrapper.innerHTML = `
  <a class="promo-rail promo-rail-image promo-rail-left" href="${RYZEN_ROUTES.blog}">
    <img src="${assetPath("images/banners/banner-left.png")}" alt="Leia o blog do Ryuzen Anime Hub">
  </a>

  <a class="promo-rail promo-rail-image promo-rail-right" href="${RYZEN_ROUTES.guides}">
    <img src="${assetPath("images/banners/banner-right.png")}" alt="Guias do Ryuzen Anime Hub">
  </a>
`;

  document.body.appendChild(wrapper);
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function registerRyuzenServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(sitePath("service-worker.js"), { scope: sitePath("") })
      .catch((error) => console.warn("Service Worker não registrado:", error));
  });
}

function setupInstallAppButton() {
  const header = document.querySelector(".nav-wrap");
  if (!header || isStandaloneApp()) return;

  let deferredInstallPrompt = null;
  const button = document.createElement("button");
  button.className = "btn install-app-btn hidden";
  button.type = "button";
  button.textContent = "Instalar app";
  button.setAttribute("aria-label", "Instalar Ryuzen Anime Hub como aplicativo");
  header.appendChild(button);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    button.classList.remove("hidden");
  });

  button.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    button.classList.add("hidden");
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    button.classList.add("hidden");
    deferredInstallPrompt = null;
  });
}

registerRyuzenServiceWorker();
renderHeader();
setupInstallAppButton();
renderFooter();
renderPromoSidebars();
bindSearchForms();
