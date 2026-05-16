function imageOf(anime) {
  const imageUrl = anime?.images?.webp?.large_image_url || anime?.images?.jpg?.large_image_url || anime?.image;
  return safeUrl(imageUrl, "assets/images/logo-placeholder.svg");
}

function yearOf(anime) {
  return anime.year || anime.aired?.prop?.from?.year || "Ano indef.";
}

function formatScore(score) {
  return score ? Number(score).toFixed(2) : "S/N";
}

function setActiveNav() {
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const href = link.getAttribute("href");
    link.classList.toggle("active", href === current || (current === "" && href === "index.html"));
  });
}

function renderHeader() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  header.innerHTML = `
    <header class="site-header">
      <div class="container nav-wrap">
        <a class="brand" href="index.html" aria-label="Ryuzen Anime Hub">
          <img src="assets/images/logo-placeholder.svg" alt="" width="38" height="38">
          <strong>Ryuzen <span>Anime Hub</span></strong>
        </a>
        <nav class="main-nav" aria-label="Navegação principal">
          <a href="index.html">Home</a>
          <a href="search.html">Busca</a>
          <a href="season.html">Temporada</a>
          <a href="ranking.html">Ranking</a>
          <a href="my-list.html">Minha lista</a>
          <a href="guides.html">Guias</a>
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

function createSearchBar({ value = "", placeholder = "Busque por título, franquia ou temporada", action = "search.html" } = {}) {
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
      if (query) location.href = `search.html?q=${encodeURIComponent(query)}`;
    });
  });
}

function createGenreTags(genres = []) {
  return `<div class="tags">${genres.slice(0, 3).map((genre) => `<span class="tag">${escapeHtml(genre.name)}</span>`).join("")}</div>`;
}

function createAnimeCard(anime) {
  const animeId = Number(anime.mal_id);
  const title = escapeHtml(anime.title);
  return `
    <article class="anime-card">
      <a href="anime.html?id=${animeId}" aria-label="Ver detalhes de ${title}">
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
        <a class="btn ghost" href="anime.html?id=${animeId}">Ver detalhes</a>
      </div>
    </article>`;
}

function createRankingRow(anime, position) {
  const animeId = Number(anime.mal_id);
  const title = escapeHtml(anime.title);
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
      <a class="btn" href="anime.html?id=${animeId}">Ver detalhes</a>
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
  try {
    const url = new URL(String(value), window.location.href);
    const isAllowedProtocol = ["http:", "https:"].includes(url.protocol);
    const isLocalAsset = url.origin === window.location.origin || String(value).startsWith("assets/");
    if (isAllowedProtocol || isLocalAsset) return url.href;
  } catch {
    if (String(value).startsWith("assets/")) return value;
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

renderHeader();
renderFooter();
bindSearchForms();
