const API_BASE_URL = "https://api.jikan.moe/v4";

// Cache mais longo: anime não muda toda hora.
const API_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const API_STALE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Menos agressivo com a API.
const API_REQUEST_DELAY_MS = 1000;
const API_MAX_RETRIES = 2;
const API_TIMEOUT_MS = 12000;

const apiCache = new Map();
let apiQueue = Promise.resolve();
let lastRequestAt = 0;

async function requestJikan(path, params = {}, options = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const cacheKey = url.toString();
  const ttlMs = options.ttlMs || API_CACHE_TTL_MS;

  const memoryCached = apiCache.get(cacheKey);
  if (memoryCached && memoryCached.expiresAt > Date.now()) {
    return memoryCached.value || memoryCached.promise;
  }

  const localCached = readLocalCache(cacheKey);
  if (localCached) {
    apiCache.set(cacheKey, {
      value: localCached.value,
      expiresAt: localCached.expiresAt
    });

    return localCached.value;
  }

  const promise = enqueueJikanRequest(() => fetchWithRetry(url));

  apiCache.set(cacheKey, {
    promise,
    expiresAt: Date.now() + ttlMs
  });

  try {
    const value = await promise;

    apiCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMs
    });

    saveLocalCache(cacheKey, value, ttlMs);

    return value;
  } catch (error) {
    apiCache.delete(cacheKey);

    if (typeof notifyApiInstability === "function") {
      notifyApiInstability(error.message);
    }

    const staleCache = readLocalCache(cacheKey, true);

    if (staleCache) {
      console.warn("Usando cache antigo por instabilidade da API:", cacheKey);
      return staleCache.value;
    }

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

async function fetchWithRetry(url) {
  let lastError = null;

  for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url.toString(), API_TIMEOUT_MS);

      if (response.ok) {
        return response.json();
      }

      if (!shouldRetry(response.status)) {
        throw new Error(getApiErrorMessage(response.status));
      }

      lastError = new Error(getApiErrorMessage(response.status));

      if (attempt < API_MAX_RETRIES) {
        await wait(getRetryDelay(response, attempt));
      }
    } catch (error) {
      lastError = error;

      const canRetryNetworkError =
        error.name === "AbortError" ||
        error.name === "TypeError";

      if (!canRetryNetworkError || attempt >= API_MAX_RETRIES) {
        break;
      }

      await wait(getRetryDelay(null, attempt));
    }
  }

  throw lastError || new Error("Não foi possível carregar os dados agora.");
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetry(status) {
  return status === 429 || status >= 500;
}

function getRetryDelay(response, attempt) {
  const retryAfter = response?.headers?.get("Retry-After");
  const retryAfterMs = Number(retryAfter) * 1000;

  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return retryAfterMs;
  }

  return 1500 * (attempt + 1);
}

function getApiErrorMessage(status) {
  if (status === 429) {
    return "A API recebeu muitas chamadas ao mesmo tempo. Aguarde alguns segundos e tente novamente.";
  }

  if (status === 504) {
    return "A fonte de dados demorou demais para responder. Tente novamente em alguns segundos.";
  }

  if (status === 404) {
    return "Não encontramos esses dados na API.";
  }

  return "Não foi possível carregar os dados agora. Tente novamente em alguns instantes.";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStorageKey(cacheKey) {
  return `ryuzen:jikan:${cacheKey}`;
}

function readLocalCache(cacheKey, allowStale = false) {
  try {
    const raw = localStorage.getItem(getStorageKey(cacheKey));
    if (!raw) return null;

    const cached = JSON.parse(raw);
    const now = Date.now();

    if (cached.expiresAt > now) {
      return cached;
    }

    if (allowStale && cached.staleUntil > now) {
      return cached;
    }

    localStorage.removeItem(getStorageKey(cacheKey));
    return null;
  } catch {
    return null;
  }
}

function saveLocalCache(cacheKey, value, ttlMs) {
  try {
    const payload = {
      value,
      expiresAt: Date.now() + ttlMs,
      staleUntil: Date.now() + API_STALE_CACHE_TTL_MS
    };

    const serialized = JSON.stringify(payload);

    // Evita estourar o localStorage com respostas gigantes.
    if (serialized.length < 250000) {
      localStorage.setItem(getStorageKey(cacheKey), serialized);
    }
  } catch {
    // Se o navegador bloquear ou encher o localStorage, o site continua funcionando.
  }
}

async function fetchTopAnime(page = 1) {
  return requestJikan("/top/anime", {
    page,
    limit: 10
  });
}

async function fetchSeasonNow(page = 1) {
  return requestJikan("/seasons/now", {
    page,
    limit: 10
  });
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
  return requestJikan(`/anime/${id}/full`, {}, {
    ttlMs: 7 * 24 * 60 * 60 * 1000
  });
}

async function fetchPopularAnime(page = 1) {
  return requestJikan("/top/anime", {
    page,
    limit: 10,
    filter: "bypopularity"
  });
}

async function fetchTopMovies(page = 1) {
  return requestJikan("/top/anime", {
    page,
    limit: 10,
    type: "movie"
  });
}

async function fetchAiringAnime(page = 1) {
  return requestJikan("/top/anime", {
    page,
    limit: 10,
    filter: "airing"
  });
}