const JIKAN_BASE_URL = "https://api.jikan.moe/v4";
const FRESH_CACHE_SECONDS = 300;
const STALE_CACHE_SECONDS = 86400;
const UPSTREAM_TIMEOUT_MS = 4500;
const UPSTREAM_RETRY_DELAY_MS = 650;
const PUBLIC_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": `public, max-age=60, s-maxage=${FRESH_CACHE_SECONDS}, stale-while-revalidate=${STALE_CACHE_SECONDS}`,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

class DiscoveryRequestError extends Error {
  constructor(message, status = 400, code = "DISCOVERY_BAD_REQUEST") {
    super(message);
    this.name = "DiscoveryRequestError";
    this.status = status;
    this.code = code;
  }
}

class UpstreamError extends Error {
  constructor(message, status = 503, code = "DISCOVERY_UPSTREAM_UNAVAILABLE", { retryable = true } = {}) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export async function onRequestGet(context) {
  try {
    const requestUrl = new URL(context.request.url);
    const operation = buildOperation(requestUrl.searchParams);
    const cache = globalThis.caches?.default;
    const cacheKeys = makeCacheKeys(requestUrl.origin, operation.cacheToken);

    if (cache) {
      const fresh = await cache.match(cacheKeys.fresh);
      if (fresh) return copyPublicResponse(fresh, { cacheStatus: "HIT" });
    }

    try {
      const payload = await fetchFromJikan(operation.url);
      const response = jsonResponse(payload, 200, { "X-Discovery-Cache": "MISS" });

      if (cache) {
        const store = Promise.all([
          cache.put(cacheKeys.fresh, response.clone()),
          cache.put(cacheKeys.stale, jsonResponse(payload, 200, {
            "Cache-Control": `public, max-age=${STALE_CACHE_SECONDS}`,
            "X-Discovery-Cache": "STALE-SEED",
          })),
        ]);
        if (typeof context.waitUntil === "function") context.waitUntil(store);
        else await store;
      }
      return response;
    } catch (error) {
      if (cache) {
        const stale = await cache.match(cacheKeys.stale);
        if (stale) {
          return copyPublicResponse(stale, {
            cacheStatus: "STALE",
            warning: "110 - Response is stale because the anime provider is temporarily unavailable",
          });
        }
      }
      if (error instanceof UpstreamError) {
        if (error.retryable === false) {
          return errorResponse(error.message, error.status, error.code);
        }
        // Some third-party providers may reject or throttle requests originating at edge runtimes.
        // Redirecting only to the already validated provider URL lets the browser reuse the public
        // CORS-enabled API instead of leaving discovery unusable with a permanent 503.
        return browserProviderFallback(operation.url, error);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof DiscoveryRequestError) return errorResponse(error.message, error.status, error.code);
    console.error("Falha na API pública de descoberta:", error?.message || "erro desconhecido");
    return errorResponse("Não foi possível carregar animes agora. Tente novamente em instantes.", 503, "DISCOVERY_UNAVAILABLE");
  }
}

function buildOperation(params) {
  const operation = String(params.get("operation") || "").trim();
  const page = readInteger(params.get("page"), 1, 1, 20);
  let path = "";
  const query = new URLSearchParams();

  switch (operation) {
    case "search": {
      const term = String(params.get("q") || "").replace(/\s+/g, " ").trim();
      if (term.length < 2) throw new DiscoveryRequestError("Digite pelo menos dois caracteres para pesquisar.");
      if (term.length > 80) throw new DiscoveryRequestError("A pesquisa deve ter no máximo 80 caracteres.");
      path = "/anime";
      query.set("q", term);
      query.set("page", String(page));
      query.set("limit", "12");
      query.set("sfw", "true");
      break;
    }
    case "top":
      path = "/top/anime";
      query.set("page", String(page));
      query.set("limit", "12");
      break;
    case "popular":
      path = "/top/anime";
      query.set("page", String(page));
      query.set("limit", "12");
      query.set("filter", "bypopularity");
      break;
    case "movies":
      path = "/top/anime";
      query.set("page", String(page));
      query.set("limit", "12");
      query.set("type", "movie");
      break;
    case "airing":
      path = "/top/anime";
      query.set("page", String(page));
      query.set("limit", "12");
      query.set("filter", "airing");
      break;
    case "season_now":
      path = "/seasons/now";
      query.set("page", String(page));
      query.set("limit", "12");
      break;
    case "season_upcoming":
      path = "/seasons/upcoming";
      query.set("page", String(page));
      query.set("limit", "24");
      break;
    case "upcoming":
      path = "/anime";
      query.set("page", String(page));
      query.set("limit", "24");
      query.set("status", "upcoming");
      query.set("order_by", "start_date");
      query.set("sort", "asc");
      query.set("sfw", "true");
      break;
    case "details": {
      const id = readPositiveId(params.get("id"));
      if (!id) throw new DiscoveryRequestError("Anime inválido.");
      path = `/anime/${id}/full`;
      break;
    }
    default:
      throw new DiscoveryRequestError("Operação de descoberta inválida.");
  }

  const url = new URL(`${JIKAN_BASE_URL}${path}`);
  url.search = query.toString();
  return { url, cacheToken: `${operation}?${query.toString()}${operation === "details" ? path : ""}` };
}

async function fetchFromJikan(url, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
        "User-Agent": "RyuzenAnimeHub/1.0 (+https://anime.ryuzen.ink)",
      },
      signal: controller.signal,
    });
    if (response.ok) {
      const payload = await response.json().catch(() => null);
      if (!payload || typeof payload !== "object" || !Array.isArray(payload.data) && !payload.data) {
        throw new UpstreamError("A fonte de animes retornou uma resposta inválida.");
      }
      return payload;
    }
    if (response.status === 429) {
      const retryDelay = readRetryAfter(response);
      if (attempt < 1 && retryDelay > 0 && retryDelay <= 2000) {
        await delay(retryDelay);
        return fetchFromJikan(url, attempt + 1);
      }
      throw new UpstreamError("A pesquisa está temporariamente ocupada. Tente novamente em instantes.", 503, "DISCOVERY_RATE_LIMITED");
    }
    if (response.status >= 500) {
      const detail = await response.clone().json().catch(() => null);
      const providerDown =
        detail?.type === "BadResponseException" && /MyAnimeList/i.test(String(detail?.message || ""));
      if (providerDown) {
        // Jikan already confirmed MyAnimeList itself is unreachable: retrying or redirecting the
        // browser to the same URL cannot succeed, so fail fast with an accurate message instead of
        // wasting the retry delay and an extra round trip on a guaranteed repeat failure.
        throw new UpstreamError(
          "O provedor de dados de animes (MyAnimeList) está indisponível no momento. Tente novamente em alguns minutos.",
          503,
          "DISCOVERY_PROVIDER_DOWN",
          { retryable: false },
        );
      }
      if (attempt < 1) {
        await delay(UPSTREAM_RETRY_DELAY_MS);
        return fetchFromJikan(url, attempt + 1);
      }
    }
    if (response.status === 404) throw new UpstreamError("Anime não encontrado.", 404, "DISCOVERY_NOT_FOUND");
    throw new UpstreamError("A fonte de animes está temporariamente indisponível.");
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    // A TypeError (falha de conexão) costuma ser instantânea, então vale tentar de novo.
    // Já um AbortError já consumiu o orçamento inteiro de UPSTREAM_TIMEOUT_MS; tentar de novo
    // dobraria essa espera e arrisca estourar o timeout do fetch no cliente antes mesmo de
    // chegarmos ao fallback de redirect para o navegador — por isso falha direto nesse caso.
    if (error?.name === "TypeError" && attempt < 1) {
      await delay(UPSTREAM_RETRY_DELAY_MS);
      return fetchFromJikan(url, attempt + 1);
    }
    if (error?.name === "AbortError") throw new UpstreamError("A fonte de animes demorou demais para responder.", 504, "DISCOVERY_TIMEOUT");
    throw new UpstreamError("A fonte de animes está temporariamente indisponível.");
  } finally {
    clearTimeout(timeout);
  }
}

function makeCacheKeys(origin, token) {
  const safeToken = encodeURIComponent(token);
  return {
    fresh: new Request(`${origin}/api/discovery-cache/fresh/${safeToken}`, { method: "GET" }),
    stale: new Request(`${origin}/api/discovery-cache/stale/${safeToken}`, { method: "GET" }),
  };
}

function copyPublicResponse(source, { cacheStatus, warning = "" } = {}) {
  const headers = new Headers(PUBLIC_HEADERS);
  if (cacheStatus) headers.set("X-Discovery-Cache", cacheStatus);
  if (warning) headers.set("Warning", warning);
  return new Response(source.body, { status: source.status, headers });
}


function browserProviderFallback(providerUrl, error) {
  const headers = new Headers({
    Location: providerUrl.toString(),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Discovery-Cache": "BROWSER-FALLBACK",
    "X-Discovery-Fallback-Reason": error.code || "DISCOVERY_UPSTREAM_UNAVAILABLE",
  });
  return new Response(null, { status: 307, headers });
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...PUBLIC_HEADERS, ...extraHeaders } });
}

function errorResponse(message, status, code) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: {
      ...PUBLIC_HEADERS,
      "Cache-Control": "no-store",
      ...(status >= 500 ? { "Retry-After": "20" } : {}),
    },
  });
}

function readInteger(value, fallback, min, max) {
  const number = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function readPositiveId(value) {
  const raw = String(value || "").trim();
  if (!/^\d+$/.test(raw)) return 0;
  const number = Number.parseInt(raw, 10);
  return Number.isSafeInteger(number) && number > 0 && number <= 999999999 ? number : 0;
}

function readRetryAfter(response) {
  const seconds = Number(response.headers.get("Retry-After") || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
