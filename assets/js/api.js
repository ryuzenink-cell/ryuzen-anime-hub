const API_BASE_URL = "https://api.jikan.moe/v4";
const API_CACHE_TTL_MS = 5 * 60 * 1000;
const API_REQUEST_DELAY_MS = 1200;
const API_MAX_RETRIES = 4;

const apiCache = new Map();
let apiQueue = Promise.resolve();
let lastRequestAt = 0;

async function requestJikan(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  const cacheKey = url.toString();
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value || cached.promise;
  }

  const promise = enqueueJikanRequest(() => fetchWithRetry(url));
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

function enqueueJikanRequest(task) {
  const run = apiQueue.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < API_REQUEST_DELAY_MS) {
      await wait(API_REQUEST_DELAY_MS - elapsed);
    }
    lastRequestAt = Date.now();
    return task();
  });

  apiQueue = run.catch(() => {});
  return run;
}

async function fetchWithRetry(url, attempt = 0) {
  try {
    const response = await fetch(url.toString());
    if (response.ok) return response.json();

    if (shouldRetry(response.status) && attempt < API_MAX_RETRIES) {
      await wait(getRetryDelay(response, attempt));
      return fetchWithRetry(url, attempt + 1);
    }

    throw new Error(getApiErrorMessage(response.status));
  } catch (error) {
    if (attempt < API_MAX_RETRIES && error.name === "TypeError") {
      await wait(getRetryDelay(null, attempt));
      return fetchWithRetry(url, attempt + 1);
    }
    throw error;
  }
}

function shouldRetry(status) {
  return status === 429 || status >= 500;
}

function getRetryDelay(response, attempt) {
  const retryAfter = response?.headers?.get("Retry-After");
  const retryAfterMs = Number(retryAfter) * 1000;
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) return retryAfterMs;
  return 1500 * (attempt + 1);
}

function getApiErrorMessage(status) {
  if (status === 429) {
    return "A API limitou muitas chamadas ao mesmo tempo. Aguarde alguns segundos e tente novamente.";
  }
  if (status === 404) {
    return "Não encontramos esses dados na API.";
  }
  return "Não foi possível carregar os dados agora. Tente novamente em alguns instantes.";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTopAnime(page = 1) {
  return requestJikan("/top/anime", { page, limit: 12 });
}

async function fetchSeasonNow(page = 1) {
  return requestJikan("/seasons/now", { page, limit: 12 });
}

async function searchAnime(query, page = 1) {
  return requestJikan("/anime", {
    q: query,
    page,
    limit: 8,
    sfw: true,
    order_by: "popularity",
    sort: "asc"
  });
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
