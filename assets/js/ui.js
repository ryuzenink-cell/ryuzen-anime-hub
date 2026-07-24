const RYZEN_ROUTE_SEGMENTS = [
  "blog/post",
  "vendas-mangas",
  "loja",
  "my-list",
  "conta/entrar",
  "conta/criar",
  "conta/perfil",
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
  store: sitePath("loja/"),
  accountLogin: sitePath("conta/entrar/"),
  accountRegister: sitePath("conta/criar/"),
  accountProfile: sitePath("conta/perfil/"),
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

function imageOf(anime, size = "card") {
  const imageSet = anime?.images?.webp || anime?.images?.jpg || {};
  const imageUrl = size === "large"
    ? (imageSet.large_image_url || imageSet.image_url || anime?.image)
    : (imageSet.image_url || imageSet.small_image_url || imageSet.large_image_url || anime?.image);
  return safeUrl(imageUrl, assetPath("images/logo-placeholder.webp?v=20260724-status-banner-v2"));
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
  if (path.includes("/loja/")) return "store";
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
  document.querySelectorAll("[data-route]").forEach((link) => {
    const route = link.dataset.route;
    const isActive = route === currentRoute || (currentRoute === "blogPost" && route === "blog");
    link.classList.toggle("active", isActive);
  });
}

function publicIcon(name) {
  const icons = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.8 8.6c0 5-8.8 10.4-8.8 10.4S3.2 13.6 3.2 8.6A4.7 4.7 0 0112 6.5a4.7 4.7 0 018.8 2.1z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>'
  };
  return icons[name] || "";
}

function renderHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  header.innerHTML = `
    <header class="site-header public-header">
      <div class="masthead">
        <div class="container masthead-wrap">
          <a class="brand" href="${RYZEN_ROUTES.home}" aria-label="Ryuzen Anime Hub — Início">
            <img src="${assetPath("icons/icon-192.png?v=20260724-status-banner-v2")}" alt="" width="42" height="42">
            <span class="brand-copy"><strong>Ryuzen <span>Anime Hub</span></strong><small>Anime database · Rankings · Editorial</small></span>
          </a>
          <div class="masthead-actions">
            <form class="header-search" data-search-form action="${RYZEN_ROUTES.search}" role="search" aria-label="Buscar animes">
              <span class="header-search-icon" aria-hidden="true">${publicIcon("search")}</span>
              <label class="sr-only" for="header-search-input">Buscar anime</label>
              <input id="header-search-input" name="q" type="search" placeholder="Buscar anime" autocomplete="off">
              <button class="header-search-submit" type="submit">Buscar</button>
            </form>
            <a class="header-icon-link list-header-link" href="${RYZEN_ROUTES.myList}" aria-label="Abrir minha lista">${publicIcon("heart")}<span>Minha lista</span><span class="list-count" data-list-count hidden>0</span></a>
            <div class="account-area" data-account-area></div>
            <button class="menu-toggle" data-menu-toggle type="button" aria-expanded="false" aria-controls="mobile-public-nav" aria-label="Abrir menu">${publicIcon("menu")}</button>
          </div>
        </div>
      </div>
      <div class="nav-strip">
        <nav class="container main-nav" aria-label="Navegação principal">
          <a data-route="home" href="${RYZEN_ROUTES.home}">Início</a>
          <a data-route="search" href="${RYZEN_ROUTES.search}">Buscar Anime</a>
          <a data-route="season" href="${RYZEN_ROUTES.season}">Temporada</a>
          <a data-route="ranking" href="${RYZEN_ROUTES.ranking}">Rankings</a>
          <a data-route="myList" href="${RYZEN_ROUTES.myList}">Minha Lista</a>
          <span class="nav-sep" aria-hidden="true"></span>
          <a data-route="blog" href="${RYZEN_ROUTES.blog}">Editorial</a>
          <a data-route="store" href="${RYZEN_ROUTES.store}">Loja</a>
          <a data-route="mangaSales" href="${RYZEN_ROUTES.mangaSales}">Market Intel</a>
          <span class="nav-sep" aria-hidden="true"></span>
          <a class="nav-external" href="https://www.yorokobistudio.com/" target="_blank" rel="noopener noreferrer">Yorokobi Studio<span aria-hidden="true"> ↗</span></a>
        </nav>
      </div>
    </header>
    <div class="mobile-backdrop" data-menu-backdrop aria-hidden="true"></div>
    <aside class="mobile-drawer" id="mobile-public-nav" data-mobile-drawer aria-hidden="true" aria-label="Menu público">
      <div class="drawer-head"><strong>Ryuzen Anime Hub</strong><button class="menu-toggle" data-menu-close type="button" aria-label="Fechar menu">${publicIcon("close")}</button></div>
      <nav class="drawer-links" aria-label="Navegação mobile">
        <p class="drawer-group-label" id="drawer-group-descobrir">Descobrir</p>
        <div class="drawer-group" role="group" aria-labelledby="drawer-group-descobrir">
          <a data-route="home" href="${RYZEN_ROUTES.home}">Início</a>
          <a data-route="search" href="${RYZEN_ROUTES.search}">Buscar Anime</a>
          <a data-route="season" href="${RYZEN_ROUTES.season}">Temporada</a>
          <a data-route="ranking" href="${RYZEN_ROUTES.ranking}">Rankings</a>
          <a data-route="myList" href="${RYZEN_ROUTES.myList}">Minha Lista</a>
        </div>
        <p class="drawer-group-label" id="drawer-group-editorial">Editorial</p>
        <div class="drawer-group" role="group" aria-labelledby="drawer-group-editorial">
          <a data-route="blog" href="${RYZEN_ROUTES.blog}">Blog / Editorial</a>
          <a data-route="guides" href="${RYZEN_ROUTES.guides}">Guias</a>
          <a data-route="store" href="${RYZEN_ROUTES.store}">Loja Ryuzen</a>
          <a data-route="mangaSales" href="${RYZEN_ROUTES.mangaSales}">Market Intel</a>
        </div>
        <p class="drawer-group-label" id="drawer-group-conta">Conta</p>
        <div class="drawer-group account-area" role="group" aria-labelledby="drawer-group-conta" data-account-area></div>
        <p class="drawer-group-label" id="drawer-group-ryuzen">Ecossistema</p>
        <div class="drawer-group" role="group" aria-labelledby="drawer-group-ryuzen">
          <a class="nav-external" href="https://www.yorokobistudio.com/" target="_blank" rel="noopener noreferrer">Yorokobi Studio<span aria-hidden="true"> ↗</span></a>
        </div>
      </nav>
    </aside>
    <nav class="mobile-bottom-nav" aria-label="Atalhos principais">
      <a data-route="home" href="${RYZEN_ROUTES.home}">${publicIcon("home")}<span>Início</span></a>
      <a data-route="search" href="${RYZEN_ROUTES.search}">${publicIcon("search")}<span>Buscar</span></a>
      <a data-route="season" href="${RYZEN_ROUTES.season}">${publicIcon("calendar")}<span>Temporada</span></a>
      <a data-route="myList" href="${RYZEN_ROUTES.myList}">${publicIcon("heart")}<span>Lista</span></a>
    </nav>`;
  setActiveNav();
}

// Aviso de instabilidade do provedor de dados (Jikan/MyAnimeList): aparece e some
// sozinho conforme assets/js/api.js reporta sucesso/falha das chamadas de descoberta
// via sessionStorage + CustomEvent("ryuzen:discovery-status"). Persiste entre páginas
// dentro da mesma aba/sessão porque o site é multi-página (sem estado de SPA).
// Mesma chave de sessionStorage usada em assets/js/api.js (SERVICE_STATUS_STORAGE_KEY) —
// nome diferente aqui de propósito: api.js e ui.js são scripts globais (não-módulo) na
// mesma página, e declarar o mesmo identificador `const` duas vezes quebraria o script inteiro.
const UI_SERVICE_STATUS_KEY = "ryuzen:discoveryStatus";
const SERVICE_STATUS_POLL_MS = 60000;
let serviceStatusPollTimer = null;

function renderServiceStatusBanner() {
  const header = document.querySelector("[data-header]");
  if (!header || document.getElementById("ryuzen-status-banner")) return;
  const banner = document.createElement("div");
  banner.id = "ryuzen-status-banner";
  banner.className = "service-status-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.hidden = true;
  banner.innerHTML = `<div class="container service-status-inner"><span class="service-status-icon" aria-hidden="true">!</span><p>A busca de animes está instável porque o provedor de dados (Jikan/MyAnimeList) não está respondendo a algumas consultas no momento. Isso não depende do Ryuzen Anime Hub — o aviso some sozinho assim que o provedor normalizar.</p></div>`;
  header.insertAdjacentElement("afterend", banner);
}

function setServiceStatusVisible(healthy) {
  const banner = document.getElementById("ryuzen-status-banner");
  if (!banner) return;
  banner.hidden = healthy;
  if (healthy) stopServiceStatusPolling();
  else startServiceStatusPolling();
}

function startServiceStatusPolling() {
  if (serviceStatusPollTimer) return;
  serviceStatusPollTimer = window.setInterval(() => {
    if (document.visibilityState === "visible" && typeof checkDiscoveryHealthNow === "function") checkDiscoveryHealthNow();
  }, SERVICE_STATUS_POLL_MS);
}

function stopServiceStatusPolling() {
  if (!serviceStatusPollTimer) return;
  window.clearInterval(serviceStatusPollTimer);
  serviceStatusPollTimer = null;
}

function initServiceStatusBanner() {
  renderServiceStatusBanner();
  let initialHealthy = true;
  try {
    const stored = sessionStorage.getItem(UI_SERVICE_STATUS_KEY);
    if (stored) initialHealthy = Boolean(JSON.parse(stored).healthy);
  } catch {
    // sessionStorage indisponível — assume saudável até a primeira checagem desta aba.
  }
  setServiceStatusVisible(initialHealthy);
  window.addEventListener("ryuzen:discovery-status", (event) => setServiceStatusVisible(Boolean(event.detail?.healthy)));
  document.addEventListener("visibilitychange", () => {
    const banner = document.getElementById("ryuzen-status-banner");
    if (document.visibilityState === "visible" && banner && !banner.hidden && typeof checkDiscoveryHealthNow === "function") {
      checkDiscoveryHealthNow();
    }
  });
}

// Mantém --ryuzen-header-h sincronizado com a altura real do header em camadas.
// Os banners laterais fixos usam essa variável para nunca invadir a navbar.
function syncHeaderHeight() {
  const header = document.querySelector(".public-header");
  if (!header) return;
  const apply = () => {
    const height = Math.round(header.getBoundingClientRect().height);
    if (height > 0) document.documentElement.style.setProperty("--ryuzen-header-h", `${height}px`);
  };
  apply();
  window.addEventListener("load", apply);
  window.addEventListener("resize", () => window.requestAnimationFrame(apply), { passive: true });
}

function renderFooter() {
  const footer = document.querySelector("[data-footer]");
  if (!footer) return;
  footer.innerHTML = `
    <footer class="site-footer public-footer">
      <div class="container">
        <div class="footer-premium-grid">
          <div class="footer-brand">
            <a class="brand" href="${RYZEN_ROUTES.home}"><img src="${assetPath("icons/icon-192.png?v=20260724-status-banner-v2")}" alt="" width="42" height="42"><span class="brand-copy"><strong>Ryuzen <span>Anime Hub</span></strong><small>Discovery</small></span></a>
            <p>Descubra, acompanhe e organize seus animes favoritos em português.</p>
          </div>
          <nav class="footer-links" aria-label="Descobrir">
            <h2>Descobrir</h2>
            <a href="${RYZEN_ROUTES.search}">Buscar Anime</a>
            <a href="${RYZEN_ROUTES.season}">Temporada</a>
            <a href="${RYZEN_ROUTES.ranking}">Rankings</a>
            <a href="${RYZEN_ROUTES.myList}">Minha Lista</a>
          </nav>
          <nav class="footer-links" aria-label="Editorial">
            <h2>Editorial</h2>
            <a href="${RYZEN_ROUTES.blog}">Blog</a>
            <a href="${RYZEN_ROUTES.guides}">Guias</a>
            <a href="${RYZEN_ROUTES.store}">Loja</a>
            <a href="${RYZEN_ROUTES.mangaSales}">Market Intel</a>
          </nav>
          <nav class="footer-links" aria-label="Ecossistema">
            <h2>Ecossistema</h2>
            <a href="${RYZEN_ROUTES.home}">Início</a>
            <a href="https://www.yorokobistudio.com/" target="_blank" rel="noopener noreferrer">Yorokobi Studio</a>
          </nav>
        </div>
        <div class="footer-bottom"><span>© 2026 Ryuzen Anime Hub. Todos os direitos reservados.</span><span>Dados de animes fornecidos pela Jikan API / MyAnimeList.</span></div>
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

function contextualBadge(anime) {
  const status = String(anime.status || "").toLowerCase();
  if (status.includes("airing") || status.includes("exibição")) return "Em exibição";
  if (String(anime.type || "").toLowerCase() === "movie") return "Filme";
  if ((anime.popularity || 99999) <= 100) return "Popular";
  return "Anime";
}

function createAnimeCard(anime) {
  const animeId = Number(anime.mal_id);
  const title = escapeHtml(anime.title);
  const poster = escapeHtml(imageOf(anime));
  const animeUrl = routeWithQuery(RYZEN_ROUTES.anime, { id: animeId });
  return `
    <article class="anime-card">
      <div class="poster-wrap">
        <a href="${animeUrl}" aria-label="Ver detalhes de ${title}">
          <img class="poster" src="${poster}" alt="Capa de ${title}" width="240" height="360" loading="lazy" decoding="async">
          <span class="poster-gradient" aria-hidden="true"></span>
          <span class="badge card-badge">${escapeHtml(contextualBadge(anime))}</span>
        </a>
        <button class="card-save" data-quick-save="${animeId}" data-title="${title}" data-image="${poster}" data-episodes="${escapeHtml(anime.episodes || "")}" type="button" aria-label="Adicionar à minha lista" aria-pressed="false">${publicIcon("heart")}</button>
      </div>
      <div class="anime-card-body">
        <h3 class="anime-title"><a href="${animeUrl}">${title}</a></h3>
        <div class="meta-line">
          <span class="badge score">★ ${formatScore(anime.score)}</span>
          <span>${escapeHtml(anime.type || "Anime")}</span>
          <span>${escapeHtml(yearOf(anime))}</span>
        </div>
        <div class="meta-line">
          <span>${escapeHtml(anime.episodes || "?")} eps</span>
          <span>${escapeHtml(anime.status || "Status indef.")}</span>
        </div>
        ${createGenreTags(anime.genres)}
        <div class="card-actions"><a class="btn ghost" href="${animeUrl}">Ver detalhes</a></div>
      </div>
    </article>`;
}

function createRankingRow(anime, position) {
  const animeId = Number(anime.mal_id);
  const title = escapeHtml(anime.title);
  const poster = escapeHtml(imageOf(anime));
  const animeUrl = routeWithQuery(RYZEN_ROUTES.anime, { id: animeId });
  return `
    <article class="ranking-row ${position <= 3 ? "top-three" : ""}">
      <div class="ranking-pos">#${escapeHtml(position)}</div>
      <img class="ranking-thumb" src="${poster}" alt="Capa de ${title}" width="58" height="82" loading="lazy" decoding="async">
      <div>
        <h3><a href="${animeUrl}">${title}</a></h3>
        <div class="meta-line">
          <span class="badge score">★ ${formatScore(anime.score)}</span>
          <span>${escapeHtml(anime.type || "Anime")}</span>
          <span>${escapeHtml(anime.episodes || "?")} eps</span>
          <span>${escapeHtml(yearOf(anime))}</span>
        </div>
      </div>
      <div class="ranking-actions">
        <button class="btn ghost quick-save-mini" data-quick-save="${animeId}" data-title="${title}" data-image="${poster}" data-episodes="${escapeHtml(anime.episodes || "")}" type="button" aria-label="Adicionar à minha lista" aria-pressed="false">${publicIcon("heart")}</button>
        <a class="btn" href="${animeUrl}">Detalhes</a>
      </div>
    </article>`;
}

function renderLoading(target, count = 5) {
  target.innerHTML = `<div class="skeleton-grid" aria-label="Carregando conteúdo">${Array.from({ length: count }, () => `<div class="skeleton skeleton-card" aria-hidden="true"></div>`).join("")}</div>`;
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

  // The blog landing layout deliberately uses the full-width editorial canvas.
  // Do not append fixed promo rails there; they previously covered the hero or
  // left a false gutter after being hidden via CSS. Articles remain eligible.
  if (document.body.dataset.publicLayout === "blog-index") return;

  if (!allowedRoutes.includes(currentRoute)) return;

  const existing = document.querySelector(".promo-sidebars");
  if (existing) existing.remove();

  const wrapper = document.createElement("aside");
  const promoContext = (currentRoute === "blog" && document.querySelector(".blog-article")) ? "blogPost" : currentRoute;
  wrapper.className = `promo-sidebars promo-context-${promoContext}`;
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
  <a class="promo-rail promo-rail-image promo-rail-left" data-banner-placement="blog_sidebar_left" href="${RYZEN_ROUTES.blog}">
    <img src="${assetPath("images/banners/banner-left.webp?v=20260724-status-banner-v2")}" alt="Leia o blog do Ryuzen Anime Hub">
  </a>

  <a class="promo-rail promo-rail-image promo-rail-right" data-banner-placement="blog_sidebar_right" href="${RYZEN_ROUTES.guides}">
    <img src="${assetPath("images/banners/banner-right.webp?v=20260724-status-banner-v2")}" alt="Guias do Ryuzen Anime Hub">
  </a>
`;

  document.body.appendChild(wrapper);
  loadConfiguredBanners(wrapper);
}

async function loadConfiguredBanners(wrapper) {
  try {
    const response = await fetch(sitePath("api/banners"), { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    (data.banners || []).forEach((banner) => {
      const slot = wrapper.querySelector(`[data-banner-placement="${banner.placement}"]`);
      if (!slot) return;
      const image = slot.querySelector("img");
      const src = safeUrl(banner.image_url, "");
      const href = safeUrl(banner.target_url, "");
      if (!src || !href || !banner.alt_text) return;
      slot.href = href;
      image.src = src;
      image.alt = banner.alt_text;
    });
  } catch { /* O banner padrão permanece como fallback. */ }
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
  const header = document.querySelector(".masthead-actions");
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
initServiceStatusBanner();
syncHeaderHeight();
setupInstallAppButton();
renderFooter();
renderPromoSidebars();
bindSearchForms();
