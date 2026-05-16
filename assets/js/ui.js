function imageOf(anime) {
  return anime?.images?.webp?.large_image_url || anime?.images?.jpg?.large_image_url || anime?.image || "assets/images/logo-placeholder.svg";
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
    <form class="search-box" data-search-form action="${action}">
      <label class="sr-only" for="global-search">Buscar anime</label>
      <input id="global-search" name="q" type="search" value="${escapeHtml(value)}" placeholder="${placeholder}" autocomplete="off">
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
  return `
    <article class="anime-card">
      <a href="anime.html?id=${anime.mal_id}" aria-label="Ver detalhes de ${escapeHtml(anime.title)}">
        <img class="poster" src="${imageOf(anime)}" alt="Capa de ${escapeHtml(anime.title)}" loading="lazy">
      </a>
      <div class="anime-card-body">
        <h3 class="anime-title">${escapeHtml(anime.title)}</h3>
        <div class="meta-line">
          <span class="badge score">Nota ${formatScore(anime.score)}</span>
          <span>${escapeHtml(anime.type || "Anime")}</span>
          <span>${yearOf(anime)}</span>
        </div>
        <div class="meta-line">
          <span>${anime.episodes || "?"} eps</span>
          <span>${escapeHtml(anime.status || "Status indef.")}</span>
        </div>
        ${createGenreTags(anime.genres)}
        <a class="btn ghost" href="anime.html?id=${anime.mal_id}">Ver detalhes</a>
      </div>
    </article>`;
}

function createRankingRow(anime, position) {
  return `
    <article class="ranking-row">
      <div class="ranking-pos">#${position}</div>
      <img class="ranking-thumb" src="${imageOf(anime)}" alt="Capa de ${escapeHtml(anime.title)}" loading="lazy">
      <div>
        <h3>${escapeHtml(anime.title)}</h3>
        <div class="meta-line">
          <span class="badge score">Nota ${formatScore(anime.score)}</span>
          <span>${escapeHtml(anime.type || "Anime")}</span>
          <span>${anime.episodes || "?"} eps</span>
          <span>${yearOf(anime)}</span>
        </div>
      </div>
      <a class="btn" href="anime.html?id=${anime.mal_id}">Ver detalhes</a>
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

renderHeader();
renderFooter();
bindSearchForms();
