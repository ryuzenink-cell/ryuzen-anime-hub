const homeSearch = document.getElementById("homeSearch");
if (homeSearch) {
  homeSearch.innerHTML = createSearchBar();
  bindSearchForms();
}

async function loadHomeSection(targetId, loader, limit = 5) {
  const target = document.getElementById(targetId);
  renderLoading(target, limit);
  try {
    const { data } = await loader();
    target.innerHTML = `<div class="anime-grid">${data.slice(0, limit).map(createAnimeCard).join("")}</div>`;
  } catch (error) {
    renderError(target, error.message);
  }
}

async function loadSpotlight() {
  const target = document.getElementById("heroSpotlight");
  try {
    const { data } = await fetchTopAnime(1);
    target.innerHTML = `
      <div class="spotlight-list">
        ${data.slice(0, 4).map((anime, index) => `
          <a class="spotlight-item" href="${routeWithQuery(RYZEN_ROUTES.anime, { id: Number(anime.mal_id) })}">
            <img src="${escapeHtml(imageOf(anime))}" alt="Capa de ${escapeHtml(anime.title)}" width="54" height="76" loading="lazy" decoding="async">
            <div>
              <strong>#${index + 1} ${escapeHtml(anime.title)}</strong>
              <div class="meta-line"><span class="badge score">Nota ${formatScore(anime.score)}</span><span>${escapeHtml(anime.type || "Anime")}</span></div>
            </div>
          </a>
        `).join("")}
      </div>`;
  } catch (error) {
    renderError(target, error.message);
  }
}

loadSpotlight();
loadHomeSection("seasonNow", fetchSeasonNow, 5);
loadHomeSection("topAnime", fetchTopAnime, 5);
loadHomeSection("popularAnime", fetchPopularAnime, 5);
