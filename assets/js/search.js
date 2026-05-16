let currentPage = 1;
let currentQuery = new URLSearchParams(location.search).get("q") || "";
const searchInput = document.getElementById("searchInput");
const results = document.getElementById("searchResults");
const moreButton = document.getElementById("loadMore");

searchInput.value = currentQuery;

document.getElementById("searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  currentQuery = searchInput.value.trim();
  currentPage = 1;
  if (!currentQuery) {
    renderEmpty(results, "Digite um termo de busca", "Procure pelo nome de um anime, franquia ou filme.");
    moreButton.classList.add("hidden");
    return;
  }
  history.replaceState(null, "", routeWithQuery(RYZEN_ROUTES.search, { q: currentQuery }));
  runSearch();
});

moreButton.addEventListener("click", () => {
  currentPage += 1;
  runSearch(true);
});

async function runSearch(append = false) {
  if (!append) renderLoading(results, 6);
  try {
    const { data, pagination } = await searchAnime(currentQuery, currentPage);
    if (!data.length && !append) {
      renderEmpty(results, "Nenhum anime encontrado", "Tente buscar por outro título ou por uma franquia mais conhecida.");
      moreButton.classList.add("hidden");
      return;
    }
    const markup = data.map(createAnimeCard).join("");
    if (append) results.querySelector(".anime-grid").insertAdjacentHTML("beforeend", markup);
    else results.innerHTML = `<div class="anime-grid">${markup}</div>`;
    moreButton.classList.toggle("hidden", !pagination?.has_next_page);
  } catch (error) {
    renderError(results, error.message);
    moreButton.classList.add("hidden");
  }
}

if (currentQuery) runSearch();
else renderEmpty(results, "Comece sua busca", "Encontre animes por título e abra detalhes completos com dados da Jikan API.");
