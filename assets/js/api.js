const API_BASE_URL = "/api/discovery";
const API_CACHE_TTL_MS = 5 * 60 * 1000;
const API_REQUEST_TIMEOUT_MS = 10000;
const API_NETWORK_RETRIES = 1;

const apiCache = new Map();

async function requestDiscovery(operation, params = {}) {
  const url = new URL(API_BASE_URL, window.location.origin);
  url.searchParams.set("operation", operation);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  const cacheKey = url.toString();
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value || cached.promise;

  const promise = fetchWithRetry(url);
  apiCache.set(cacheKey, { promise, expiresAt: Date.now() + API_CACHE_TTL_MS });
  try {
    const value = await promise;
    apiCache.set(cacheKey, { value, expiresAt: Date.now() + API_CACHE_TTL_MS });
    return value;
  } catch (error) {
    apiCache.delete(cacheKey);
    throw error;
  }
}

async function fetchWithRetry(url, attempt = 0) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    throw new Error(payload.error || getApiErrorMessage(response.status));
  } catch (error) {
    if (error.name === "AbortError") throw new Error("A pesquisa demorou demais para responder. Tente novamente.");
    if (attempt < API_NETWORK_RETRIES && error.name === "TypeError") {
      await wait(700 * (attempt + 1));
      return fetchWithRetry(url, attempt + 1);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function getApiErrorMessage(status) {
  if (status === 429 || status === 503) return "A pesquisa está temporariamente ocupada. Tente novamente em alguns instantes.";
  if (status === 404) return "Não encontramos esses dados na pesquisa.";
  return "Não foi possível carregar os dados agora. Tente novamente em alguns instantes.";
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchTopAnime(page = 1) {
  return requestDiscovery("top", { page });
}

async function fetchSeasonNow(page = 1) {
  return requestDiscovery("season_now", { page });
}

async function fetchSeasonUpcoming(page = 1) {
  return requestDiscovery("season_upcoming", { page });
}

async function fetchUpcomingAnime(page = 1) {
  return requestDiscovery("upcoming", { page });
}

async function searchAnime(query, page = 1) {
  return requestDiscovery("search", { q: query, page });
}

async function fetchAnimeDetails(id) {
  return requestDiscovery("details", { id });
}

async function fetchPopularAnime(page = 1) {
  return requestDiscovery("popular", { page });
}

async function fetchTopMovies(page = 1) {
  return requestDiscovery("movies", { page });
}

async function fetchAiringAnime(page = 1) {
  return requestDiscovery("airing", { page });
}
