import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { onRequestGet as getDiscovery } from "../functions/api/discovery.js";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const read = (file) => readFileSync(resolve(root, file), "utf8");
const PUBLIC_VERSION = "20260724-status-banner-v1";

const clientApi = read("assets/js/api.js");
const serviceWorker = read("service-worker.js");
const ui = read("assets/js/ui.js");
const publicPages = [
  "index.html", "search/index.html", "anime/index.html", "season/index.html", "ranking/index.html",
  "guides/index.html", "guides/proximos-animes/index.html", "my-list/index.html", "loja/index.html",
];
expect(clientApi.includes('const API_BASE_URL = "/api/discovery"'), "O cliente público deve tentar a API same-origin /api/discovery.");
expect(clientApi.includes('const DIRECT_JIKAN_BASE_URL = "https://api.jikan.moe/v4"'), "O cliente deve possuir fallback direto controlado para a Jikan quando o proxy edge falhar.");
expect(clientApi.includes("RETRYABLE_PROXY_STATUSES") && clientApi.includes("enqueueDirectJikanRequest"), "O fallback direto deve ocorrer apenas em falhas transitórias do proxy e respeitar fila/rate-limit.");
expect(serviceWorker.includes('v2.3.0-status-banner'), "O service worker deve invalidar caches após a correção resiliente da descoberta pública.");
expect(serviceWorker.includes('/assets/js/api.js?v=20260724-status-banner-v1'), "O service worker deve pré-cachear a versão nova do cliente da API.");
expect(serviceWorker.includes('url.pathname.startsWith("/api/")'), "Respostas de API não devem ser servidas pelo cache offline do service worker.");
expect(ui.includes("images/banners/banner-left.webp") && ui.includes("images/banners/banner-right.webp"), "Banners laterais devem utilizar imagens WebP otimizadas.");
expect(!ui.includes("images/banners/banner-left.png") && !ui.includes("images/banners/banner-right.png"), "Banners PNG pesados não devem retornar ao layout público.");
expect(ui.includes("icons/icon-192.png?v=20260724-status-banner-v1"), "A marca no cabeçalho deve reutilizar ícone otimizado e versionado.");
expect(existsSync(resolve(root, "assets/images/banners/banner-left.webp")) && statSync(resolve(root, "assets/images/banners/banner-left.webp")).size < 400000, "Banner esquerdo deve permanecer otimizado abaixo de 400 KB.");
expect(existsSync(resolve(root, "assets/images/banners/banner-right.webp")) && statSync(resolve(root, "assets/images/banners/banner-right.webp")).size < 400000, "Banner direito deve permanecer otimizado abaixo de 400 KB.");
expect(!existsSync(resolve(root, "assets/images/banners/banner-left.png")) && !existsSync(resolve(root, "assets/images/banners/banner-right.png")), "Banners PNG redundantes não devem permanecer no pacote.");
expect(statSync(resolve(root, "assets/icons/apple-touch-icon.png")).size < 100000, "Apple touch icon deve permanecer otimizado.");
for (const page of publicPages) {
  const html = read(page);
  expect(html.includes("https://api.jikan.moe"), `${page}: CSP deve permitir o fallback direto controlado à Jikan.`);
  expect(html.includes("https://static.cloudflareinsights.com"), `${page}: CSP deve permitir o beacon de Web Analytics injetado pelo Cloudflare Pages.`);
  if (html.includes("assets/js/api.js")) expect(html.includes(`api.js?v=${PUBLIC_VERSION}`), `${page}: deve carregar api.js versionado com ${PUBLIC_VERSION}.`);
}
const publicSharedAssetPattern = /(?:\.\.?\/|\/)?assets\/(?:css\/(?:global|layout|components|pages|responsive|public-ui)\.css|js\/(?:api|storage|ui|home|home-store|store|search|anime|season|ranking|my-list|guides|upcoming-guide|manga-sales|blog-core|blog|blog-post|analytics|public-ui)\.js)(?:\?v=([A-Za-z0-9._-]+))?/g;
for (const page of findPublicHtmlFiles(root)) {
  const html = readFileSync(page, "utf8");
  const relativePage = page.replace(`${root}/`, "");
  for (const match of html.matchAll(publicSharedAssetPattern)) {
    expect(match[1] === PUBLIC_VERSION, `${relativePage}: asset público compartilhado sem versão única ${PUBLIC_VERSION}.`);
  }
  if (html.includes("data-header")) {
    expect(html.includes('class="public-site'), `${relativePage}: página com cabeçalho público deve usar a classe public-site.`);
    expect(html.includes(`public-ui.js?v=${PUBLIC_VERSION}`), `${relativePage}: página com cabeçalho público deve carregar public-ui.js versionado.`);
  }
}

function findPublicHtmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (["admin", "node_modules", ".git", "dist"].includes(entry.name)) return [];
      return findPublicHtmlFiles(full);
    }
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

const memoryCache = new Map();
const previousCaches = globalThis.caches;
const previousFetch = globalThis.fetch;
globalThis.caches = {
  default: {
    async match(request) {
      const stored = memoryCache.get(request.url);
      return stored ? stored.clone() : undefined;
    },
    async put(request, response) {
      memoryCache.set(request.url, response.clone());
    },
  },
};
let upstreamCalls = [];
let upstreamFailure = false;
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  upstreamCalls.push(url.toString());
  if (upstreamFailure) return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
  if (url.pathname.includes("/full")) return new Response(JSON.stringify({ data: { mal_id: 1, title: "Kokoro" } }), { status: 200, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ data: [{ mal_id: 1, title: "Kokoro" }], pagination: { has_next_page: false } }), { status: 200, headers: { "Content-Type": "application/json" } });
};

function context(search) {
  const pending = [];
  return {
    request: new Request(`https://anime.ryuzen.ink/api/discovery?${search}`),
    waitUntil(promise) { pending.push(promise); },
    pending,
  };
}

try {
  const firstContext = context("operation=search&q=Kokoro&page=1");
  const first = await getDiscovery(firstContext);
  await Promise.all(firstContext.pending);
  const firstData = await first.json();
  expect(first.status === 200 && firstData.data?.[0]?.title === "Kokoro", "A busca pública deve repassar dados válidos do provedor.");
  expect(first.headers.get("X-Discovery-Cache") === "MISS", "A primeira chamada deve indicar cache MISS.");
  expect(upstreamCalls[0]?.includes("/v4/anime?q=Kokoro") && upstreamCalls[0]?.includes("sfw=true"), "A busca deve montar somente a consulta Jikan permitida.");

  const second = await getDiscovery(context("operation=search&q=Kokoro&page=1"));
  expect(second.status === 200 && second.headers.get("X-Discovery-Cache") === "HIT", "Consultas repetidas devem usar cache fresco.");
  expect(upstreamCalls.length === 1, "Cache fresco deve evitar nova chamada upstream.");

  for (const key of [...memoryCache.keys()]) if (key.includes("/fresh/")) memoryCache.delete(key);
  upstreamFailure = true;
  const stale = await getDiscovery(context("operation=search&q=Kokoro&page=1"));
  expect(stale.status === 200 && stale.headers.get("X-Discovery-Cache") === "STALE", "Falha temporária upstream deve reutilizar cache stale.");
  expect(stale.headers.has("Warning"), "Resposta stale deve informar degradação controlada.");

  const proxyFallback = await getDiscovery(context("operation=top&page=1"));
  expect(proxyFallback.status === 307, "Sem cache e com falha upstream, o proxy deve redirecionar de forma segura para o provedor público em vez de retornar 503.");
  expect(proxyFallback.headers.get("Location")?.startsWith("https://api.jikan.moe/v4/top/anime?"), "Fallback do proxy deve apontar somente para URL Jikan validada internamente.");
  expect(proxyFallback.headers.get("X-Discovery-Cache") === "BROWSER-FALLBACK", "Fallback do proxy deve ser identificável para diagnóstico.");

  const callsBeforeInvalid = upstreamCalls.length;
  const invalid = await getDiscovery(context("operation=search&q=a"));
  const invalidBody = await invalid.json();
  expect(invalid.status === 400 && invalidBody.code === "DISCOVERY_BAD_REQUEST", "Busca curta deve ser rejeitada com erro seguro.");
  const invalidId = await getDiscovery(context("operation=details&id=-10"));
  expect(invalidId.status === 400, "ID de anime inválido não deve ser normalizado silenciosamente.");
  expect(upstreamCalls.length === callsBeforeInvalid, "Entrada inválida não deve alcançar o provedor externo.");
} finally {
  if (previousCaches === undefined) delete globalThis.caches; else globalThis.caches = previousCaches;
  globalThis.fetch = previousFetch;
}

// Executa o cliente em sandbox: uma Function antiga/indisponível não pode derrubar a UI pública.
const browserCalls = [];
const browserSandbox = {
  URL, URLSearchParams, AbortController, Map, Set, Error, Promise, Date, Number, String, Object, Math,
  window: {
    location: { origin: "https://anime.ryuzen.ink" },
    setTimeout,
    clearTimeout,
  },
  fetch: async (input) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    browserCalls.push(url.toString());
    if (url.origin === "https://anime.ryuzen.ink") {
      return new Response(JSON.stringify({ error: "edge unavailable", code: "DISCOVERY_UPSTREAM_UNAVAILABLE" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ data: [{ mal_id: 20, title: "Naruto" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  },
  Response,
};
vm.createContext(browserSandbox);
vm.runInContext(clientApi, browserSandbox);
const browserFallbackData = await vm.runInContext("fetchTopAnime(1)", browserSandbox);
expect(browserFallbackData.data?.[0]?.title === "Naruto", "O cliente deve concluir a consulta diretamente na Jikan quando /api/discovery responder 503.");
expect(browserCalls[0]?.startsWith("https://anime.ryuzen.ink/api/discovery") && browserCalls[1]?.startsWith("https://api.jikan.moe/v4/top/anime"), "O cliente deve usar proxy primeiro e fallback Jikan validado somente após falha transitória.");

if (failures.length) {
  console.error("\nFalha na validação da descoberta pública:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Descoberta pública validada: proxy same-origin, cache/fallback, validação de entrada e versionamento ativos.");
