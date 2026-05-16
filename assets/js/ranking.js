const rankingRoot = document.getElementById("rankingList");
const rankingTabs = document.querySelectorAll("[data-ranking]");
const loaders = {
  top: fetchTopAnime,
  popular: fetchPopularAnime,
  movies: fetchTopMovies,
  airing: fetchAiringAnime
};

rankingTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    rankingTabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    loadRanking(tab.dataset.ranking);
  });
});

async function loadRanking(type = "top") {
  renderLoading(rankingRoot, 6);
  try {
    const { data } = await loaders[type]();
    rankingRoot.innerHTML = `<div class="ranking-list">${data.map((anime, index) => createRankingRow(anime, index + 1)).join("")}</div>`;
  } catch (error) {
    renderError(rankingRoot, error.message);
  }
}

loadRanking();
