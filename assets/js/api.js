const API_BASE_URL = "https://api.jikan.moe/v4";

async function requestJikan(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Não foi possível carregar os dados agora. Tente novamente em alguns instantes.");
  }
  return response.json();
}

async function fetchTopAnime(page = 1) {
  return requestJikan("/top/anime", { page, limit: 12 });
}

async function fetchSeasonNow(page = 1) {
  return requestJikan("/seasons/now", { page, limit: 12 });
}

async function searchAnime(query, page = 1) {
  return requestJikan("/anime", { q: query, page, limit: 12, sfw: true });
}

async function fetchAnimeDetails(id) {
  return requestJikan(`/anime/${id}/full`);
}

async function fetchPopularAnime(page = 1) {
  return requestJikan("/top/anime", { page, limit: 12, filter: "bypopularity" });
}

async function fetchTopMovies(page = 1) {
  return requestJikan("/top/anime", { page, limit: 12, type: "movie" });
}

async function fetchAiringAnime(page = 1) {
  return requestJikan("/top/anime", { page, limit: 12, filter: "airing" });
}
