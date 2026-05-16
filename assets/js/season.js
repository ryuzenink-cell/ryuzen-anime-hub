let seasonData = [];
const seasonRoot = document.getElementById("seasonGrid");
const typeFilter = document.getElementById("typeFilter");
const sortFilter = document.getElementById("sortFilter");

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
  seasonRoot.innerHTML = `<div class="anime-grid">${items.map(createAnimeCard).join("")}</div>`;
}

typeFilter.addEventListener("change", renderSeason);
sortFilter.addEventListener("change", renderSeason);
loadSeason();
