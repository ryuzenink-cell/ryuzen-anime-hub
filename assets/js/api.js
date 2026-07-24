const API_BASE_URL = "/api/discovery";
const DIRECT_JIKAN_BASE_URL = "https://api.jikan.moe/v4";
const API_CACHE_TTL_MS = 5 * 60 * 1000;
const API_REQUEST_TIMEOUT_MS = 11000;
const DIRECT_REQUEST_TIMEOUT_MS = 12000;
const DIRECT_MIN_INTERVAL_MS = 450;
const RETRYABLE_PROXY_STATUSES = new Set([429, 500, 502, 503, 504]);

const apiCache = new Map();
let directQueue = Promise.resolve();
let nextDirectRequestAt = 0;

class DiscoveryClientError extends Error {
  constructor(message, status = 0, code = "DISCOVERY_CLIENT_ERROR") {
    super(message);
    this.name = "DiscoveryClientError";
    this.status = status;
    this.code = code;
  }
}

async function requestDiscovery(operation, params = {}) {
  const normalizedParams = normalizeDiscoveryParams(operation, params);
  const cacheKey = `${operation}:${new URLSearchParams(normalizedParams).toString()}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value || cached.promise;

  const promise = requestWithProviderFallback(operation, normalizedParams);
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

async function requestWithProviderFallback(operation, params) {
  const proxyUrl = makeProxyUrl(operation, params);
  try {
    return await fetchJson(proxyUrl, API_REQUEST_TIMEOUT_MS);
  } catch (error) {
    const responseAlreadyCameFromJikan = Boolean(error?.responseUrl) && new URL(error.responseUrl).origin === new URL(DIRECT_JIKAN_BASE_URL).origin;
    // Fallback quando: (a) o proxy edge teve falha transitória conhecida; ou
    // (b) a rota same-origin /api/discovery não existe/não respondeu o JSON da descoberta
    // (ex.: hospedagem estática ou servidor local sem Pages Functions). Sem isso, a descoberta
    // ficaria quebrada fora do ambiente edge mesmo com a Jikan pública disponível.
    const shouldFallback = error instanceof DiscoveryClientError
      && (RETRYABLE_PROXY_STATUSES.has(error.status) || error.proxyUnavailable === true);
    if (!shouldFallback || responseAlreadyCameFromJikan) throw error;
    // A Jikan é pública e já era consumida pelo navegador; o fallback restaura a descoberta sem abrir proxy livre.
    return enqueueDirectJikanRequest(operation, params);
  }
}

function makeProxyUrl(operation, params) {
  const url = new URL(API_BASE_URL, window.location.origin);
  url.searchParams.set("operation", operation);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url;
}

function makeDirectJikanUrl(operation, params) {
  let path = "";
  const query = new URLSearchParams();
  switch (operation) {
    case "search":
      path = "/anime";
      query.set("q", params.q);
      query.set("page", String(params.page));
      query.set("limit", "12");
      query.set("sfw", "true");
      break;
    case "top":
      path = "/top/anime";
      query.set("page", String(params.page));
      query.set("limit", "12");
      break;
    case "popular":
      path = "/top/anime";
      query.set("page", String(params.page));
      query.set("limit", "12");
      query.set("filter", "bypopularity");
      break;
    case "movies":
      path = "/top/anime";
      query.set("page", String(params.page));
      query.set("limit", "12");
      query.set("type", "movie");
      break;
    case "airing":
      path = "/top/anime";
      query.set("page", String(params.page));
      query.set("limit", "12");
      query.set("filter", "airing");
      break;
    case "season_now":
      path = "/seasons/now";
      query.set("page", String(params.page));
      query.set("limit", "12");
      break;
    case "season_upcoming":
      path = "/seasons/upcoming";
      query.set("page", String(params.page));
      query.set("limit", "24");
      break;
    case "upcoming":
      path = "/anime";
      query.set("page", String(params.page));
      query.set("limit", "24");
      query.set("status", "upcoming");
      query.set("order_by", "start_date");
      query.set("sort", "asc");
      query.set("sfw", "true");
      break;
    case "details":
      path = `/anime/${params.id}/full`;
      break;
    default:
      throw new DiscoveryClientError("Operação de descoberta inválida.", 400, "DISCOVERY_BAD_REQUEST");
  }
  const url = new URL(`${DIRECT_JIKAN_BASE_URL}${path}`);
  url.search = query.toString();
  return url;
}

function normalizeDiscoveryParams(operation, params) {
  const page = clampInteger(params.page, 1, 1, 20);
  if (operation === "details") {
    const id = String(params.id || "").trim();
    if (!/^\d+$/.test(id) || Number(id) <= 0) throw new DiscoveryClientError("Anime inválido.", 400, "DISCOVERY_BAD_REQUEST");
    return { id };
  }
  if (operation === "search") {
    const q = String(params.q || "").replace(/\s+/g, " ").trim();
    if (q.length < 2) throw new DiscoveryClientError("Digite pelo menos dois caracteres para pesquisar.", 400, "DISCOVERY_BAD_REQUEST");
    if (q.length > 80) throw new DiscoveryClientError("A pesquisa deve ter no máximo 80 caracteres.", 400, "DISCOVERY_BAD_REQUEST");
    return { q, page };
  }
  if (!["top", "popular", "movies", "airing", "season_now", "season_upcoming", "upcoming"].includes(operation)) {
    throw new DiscoveryClientError("Operação de descoberta inválida.", 400, "DISCOVERY_BAD_REQUEST");
  }
  return { page };
}

function enqueueDirectJikanRequest(operation, params) {
  const run = async () => {
    const waitMs = Math.max(0, nextDirectRequestAt - Date.now());
    if (waitMs) await wait(waitMs);
    nextDirectRequestAt = Date.now() + DIRECT_MIN_INTERVAL_MS;
    return fetchJson(makeDirectJikanUrl(operation, params), DIRECT_REQUEST_TIMEOUT_MS);
  };
  const pending = directQueue.then(run, run);
  directQueue = pending.catch(() => undefined);
  return pending;
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    let parsedJson = true;
    const payload = await response.json().catch(() => { parsedJson = false; return {}; });
    if (response.ok && parsedJson && payload && typeof payload === "object" && payload.data !== undefined) return payload;
    const responseError = new DiscoveryClientError(payload.error || getApiErrorMessage(response.status), response.status, payload.code || "DISCOVERY_PROVIDER_ERROR");
    responseError.responseUrl = response.url || url.toString();
    // O proxy de descoberta sempre devolve JSON com `data` (sucesso) ou `code` (erro tratado).
    // Uma resposta sem esse formato indica que a rota same-origin não está disponível.
    responseError.proxyUnavailable = !parsedJson || (payload.code === undefined && payload.data === undefined);
    throw responseError;
  } catch (error) {
    if (error?.name === "AbortError") throw new DiscoveryClientError("A pesquisa demorou demais para responder. Tente novamente.", 504, "DISCOVERY_TIMEOUT");
    if (error instanceof DiscoveryClientError) throw error;
    throw new DiscoveryClientError("Não foi possível conectar à fonte de animes agora. Tente novamente em instantes.", 503, "DISCOVERY_NETWORK_ERROR");
  } finally {
    window.clearTimeout(timeout);
  }
}

function getApiErrorMessage(status) {
  if (status === 429 || status === 503) return "A pesquisa está temporariamente ocupada. Tente novamente em alguns instantes.";
  if (status === 404) return "Não encontramos esses dados na pesquisa.";
  return "Não foi possível carregar os dados agora. Tente novamente em alguns instantes.";
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchTopAnime(page = 1) { return requestDiscovery("top", { page }); }
async function fetchSeasonNow(page = 1) { return requestDiscovery("season_now", { page }); }
async function fetchSeasonUpcoming(page = 1) { return requestDiscovery("season_upcoming", { page }); }
async function fetchUpcomingAnime(page = 1) { return requestDiscovery("upcoming", { page }); }
async function searchAnime(query, page = 1) { return requestDiscovery("search", { q: query, page }); }
async function fetchAnimeDetails(id) { return requestDiscovery("details", { id }); }
async function fetchPopularAnime(page = 1) { return requestDiscovery("popular", { page }); }
async function fetchTopMovies(page = 1) { return requestDiscovery("movies", { page }); }
async function fetchAiringAnime(page = 1) { return requestDiscovery("airing", { page }); }
