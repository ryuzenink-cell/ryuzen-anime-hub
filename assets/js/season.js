let seasonData = [];
const seasonRoot = document.getElementById("seasonGrid");
const typeFilter = document.getElementById("typeFilter");
const sortFilter = document.getElementById("sortFilter");
const seasonCount = document.getElementById("seasonCount");

async function loadSeason() {
  renderLoading(seasonRoot, 8);
  try {
    const { data } = await fetchSeasonNow(1);
    seasonData = data;
    renderSeason();
  } catch (error) {
    renderError(seasonRoot, error.message);
  }
}

function renderSeason() {
  const type = typeFilter.value;
  const sort = sortFilter.value;
  let items = [...seasonData].filter((anime) => type === "all" || anime.type === type);
  items.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "popularity") return (a.popularity || 99999) - (b.popularity || 99999);
    return (b.score || 0) - (a.score || 0);
  });
  seasonCount.textContent = `${items.length} título${items.length === 1 ? "" : "s"} encontrado${items.length === 1 ? "" : "s"}.`;
  seasonRoot.innerHTML = items.length ? `<div class="anime-grid">${items.map(createAnimeCard).join("")}</div>` : `<div class="state"><h2>Nenhum título neste filtro</h2><p>Tente outro tipo de anime para explorar a temporada.</p></div>`;
}

typeFilter.addEventListener("change", renderSeason);
sortFilter.addEventListener("change", renderSeason);
loadSeason();
