const STORAGE_KEY = "ryuzen_anime_list";

const STATUS_LABELS = {
  plan: "Quero assistir",
  watching: "Assistindo",
  completed: "Concluído",
  paused: "Pausado",
  dropped: "Dropado",
  favorite: "Favorito"
};

function getAnimeList() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function setAnimeList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  document.dispatchEvent(new CustomEvent("ryuzen:list-updated", { detail: { count: list.length } }));
}

function saveAnimeToList(anime) {
  const list = getAnimeList();
  const existingIndex = list.findIndex((item) => Number(item.id) === Number(anime.id));
  const item = { ...normalizeAnimeListItem(anime), updatedAt: new Date().toISOString() };
  const finalItem = existingIndex >= 0 ? { ...list[existingIndex], ...item } : item;
  if (existingIndex >= 0) list[existingIndex] = finalItem;
  else list.unshift(finalItem);
  setAnimeList(list);
  scheduleAccountSync(() => accountRequest(ACCOUNT_LIST_URL, { method: "POST", body: finalItem }));
  return finalItem;
}

function updateAnimeInList(id, updates) {
  const safeUpdates = normalizeAnimeListItem(updates, false);
  const list = getAnimeList().map((item) => (
    Number(item.id) === Number(id) ? { ...item, ...safeUpdates, updatedAt: new Date().toISOString() } : item
  ));
  setAnimeList(list);
  scheduleAccountSync(() => accountRequest(`${ACCOUNT_LIST_URL}/${Number(id)}`, { method: "PATCH", body: safeUpdates }));
}

function removeAnimeFromList(id) {
  setAnimeList(getAnimeList().filter((item) => Number(item.id) !== Number(id)));
  scheduleAccountSync(() => accountRequest(`${ACCOUNT_LIST_URL}/${Number(id)}`, { method: "DELETE" }));
}

function isAnimeSaved(id) {
  return getAnimeList().some((item) => Number(item.id) === Number(id));
}

function getAnimeById(id) {
  return getAnimeList().find((item) => Number(item.id) === Number(id));
}

function normalizeAnimeListItem(item, requireCoreFields = true) {
  const normalized = {};
  if (requireCoreFields || item.id !== undefined) normalized.id = Number(item.id);
  if (requireCoreFields || item.title !== undefined) normalized.title = String(item.title || "Anime sem título").slice(0, 180);
  if (requireCoreFields || item.image !== undefined) normalized.image = String(item.image || "").slice(0, 500);
  if (requireCoreFields || item.status !== undefined) normalized.status = STATUS_LABELS[item.status] ? item.status : "plan";
  if (requireCoreFields || item.personalScore !== undefined) normalized.personalScore = clampNumber(item.personalScore, 0, 10);
  if (requireCoreFields || item.episodesWatched !== undefined) normalized.episodesWatched = clampNumber(item.episodesWatched, 0, 10000);
  if (requireCoreFields || item.totalEpisodes !== undefined) normalized.totalEpisodes = clampNumber(item.totalEpisodes, 0, 10000);
  if (requireCoreFields || item.notes !== undefined) normalized.notes = String(item.notes || "").slice(0, 1000);
  return normalized;
}

function clampNumber(value, min, max) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Math.min(max, Math.max(min, number));
}

// ---------------------------------------------------------------------------
// Contas públicas: camada opcional de sincronização com /api/account/*.
// O modo convidado (localStorage) continua sendo a fonte usada por getAnimeList()
// em todo o site; quando há sessão autenticada, cada mutação local também é
// espelhada no servidor em segundo plano (melhor esforço, nunca bloqueante),
// e o merge local/servidor roda uma vez por login (ver syncAccountListOnLogin).
const ACCOUNT_LIST_URL = "/api/account/list";
const ryuzenAccountState = { authenticated: false, email: "", csrfToken: "", checked: false, dbUnavailable: false };

function accountFetch(url, { method = "GET", body, headers = {} } = {}) {
  const finalHeaders = { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && ryuzenAccountState.csrfToken) finalHeaders["X-CSRF-Token"] = ryuzenAccountState.csrfToken;
  return fetch(url, { method, headers: finalHeaders, credentials: "same-origin", body: body !== undefined ? JSON.stringify(body) : undefined });
}

// Envolve accountFetch tratando 401 (sessão expirada) de forma graciosa: volta
// o estado do cliente para modo convidado sem apagar a lista local nem lançar erro.
async function accountRequest(url, options) {
  const response = await accountFetch(url, options);
  if (response.status === 401) {
    ryuzenAccountState.authenticated = false;
    ryuzenAccountState.csrfToken = "";
    applyAccountNavState();
  }
  return response;
}

function scheduleAccountSync(action) {
  if (!ryuzenAccountState.authenticated || ryuzenAccountState.dbUnavailable) return;
  action().catch(() => { /* falha de rede/servidor: a lista local permanece intacta e válida. */ });
}

function parseListTimestamp(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

// Mescla a lista local (convidado) com a lista do servidor ao logar.
// Regra: item só existe em um lado -> mantido; em conflito, o updated_at mais
// recente vence; item local sem updatedAt válido é tratado como o mais antigo
// (nunca sobrescreve o servidor arbitrariamente). Retorna também quais itens
// locais precisam ser enviados ao servidor (toUpload) — operação idempotente.
function mergeAnimeListItems(localItems = [], remoteItems = []) {
  const remoteById = new Map(remoteItems.map((item) => [Number(item.id), item]));
  const localById = new Map(localItems.map((item) => [Number(item.id), item]));
  const merged = new Map(remoteById);
  const toUpload = [];
  localById.forEach((local, id) => {
    const remote = remoteById.get(id);
    if (!remote) { merged.set(id, local); toUpload.push(local); return; }
    const localTime = parseListTimestamp(local.updatedAt);
    const remoteTime = parseListTimestamp(remote.updatedAt);
    if (localTime !== null && (remoteTime === null || localTime > remoteTime)) {
      merged.set(id, local);
      toUpload.push(local);
    }
  });
  return { items: [...merged.values()], toUpload };
}

let accountSyncInFlight = false;
async function syncAccountListOnLogin() {
  if (!ryuzenAccountState.authenticated || accountSyncInFlight) return;
  const syncedFlagKey = `ryuzen_account_synced_${ryuzenAccountState.email}`;
  if (sessionStorage.getItem(syncedFlagKey) === "1") return;
  accountSyncInFlight = true;
  document.dispatchEvent(new CustomEvent("ryuzen:account-sync-start"));
  try {
    const remoteResponse = await accountRequest(ACCOUNT_LIST_URL);
    if (!remoteResponse.ok) return;
    const remoteData = await remoteResponse.json().catch(() => ({ items: [] }));
    const { items, toUpload } = mergeAnimeListItems(getAnimeList(), remoteData.items || []);
    for (const item of toUpload) {
      try { await accountRequest(ACCOUNT_LIST_URL, { method: "POST", body: item }); } catch { /* item continua salvo localmente; tentaremos de novo no próximo login. */ }
    }
    let finalItems = items;
    try {
      const finalResponse = await accountRequest(ACCOUNT_LIST_URL);
      if (finalResponse.ok) finalItems = (await finalResponse.json()).items || items;
    } catch { /* mantém o resultado do merge calculado localmente. */ }
    setAnimeList(finalItems);
    sessionStorage.setItem(syncedFlagKey, "1");
  } finally {
    accountSyncInFlight = false;
    document.dispatchEvent(new CustomEvent("ryuzen:account-sync-end"));
  }
}

function applyAccountNavState() {
  document.querySelectorAll("[data-account-area]").forEach((area) => {
    if (ryuzenAccountState.authenticated) {
      const email = typeof escapeHtml === "function" ? escapeHtml(ryuzenAccountState.email) : ryuzenAccountState.email;
      area.innerHTML = `<span class="account-email" data-account-email title="${email}">${email}</span><button type="button" class="btn ghost account-logout-btn" data-account-logout>Sair</button>`;
    } else {
      const loginRoute = typeof RYZEN_ROUTES !== "undefined" ? RYZEN_ROUTES.accountLogin : "/conta/entrar/";
      const registerRoute = typeof RYZEN_ROUTES !== "undefined" ? RYZEN_ROUTES.accountRegister : "/conta/criar/";
      area.innerHTML = `<a class="btn ghost" href="${loginRoute}">Entrar</a><a class="btn primary" href="${registerRoute}">Criar conta</a>`;
    }
  });
  document.querySelectorAll("[data-account-logout]").forEach((button) => {
    button.addEventListener("click", async () => { await logoutRyuzenAccount(); window.location.reload(); });
  });
}

async function logoutRyuzenAccount() {
  try { await accountFetch("/api/account/logout", { method: "POST" }); } catch { /* trata como deslogado no cliente mesmo se a rede falhar. */ }
  sessionStorage.removeItem(`ryuzen_account_synced_${ryuzenAccountState.email}`);
  ryuzenAccountState.authenticated = false;
  ryuzenAccountState.email = "";
  ryuzenAccountState.csrfToken = "";
  applyAccountNavState();
  document.dispatchEvent(new CustomEvent("ryuzen:account-state", { detail: { ...ryuzenAccountState } }));
}

async function refreshAccountSession() {
  try {
    const response = await fetch("/api/account/session", { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (response.status === 503) {
      ryuzenAccountState.dbUnavailable = true;
      ryuzenAccountState.authenticated = false;
      ryuzenAccountState.checked = true;
      applyAccountNavState();
      return ryuzenAccountState;
    }
    ryuzenAccountState.dbUnavailable = false;
    const data = await response.json().catch(() => ({}));
    const wasAuthenticated = ryuzenAccountState.authenticated;
    ryuzenAccountState.authenticated = Boolean(data.authenticated);
    ryuzenAccountState.email = data.user?.email || "";
    ryuzenAccountState.csrfToken = data.csrfToken || "";
    ryuzenAccountState.checked = true;
    applyAccountNavState();
    document.dispatchEvent(new CustomEvent("ryuzen:account-state", { detail: { ...ryuzenAccountState } }));
    if (ryuzenAccountState.authenticated && !wasAuthenticated) syncAccountListOnLogin();
  } catch {
    ryuzenAccountState.checked = true;
  }
  return ryuzenAccountState;
}

if (typeof window !== "undefined") {
  window.ryuzenAccountState = ryuzenAccountState;
  window.ryuzenLogoutAccount = logoutRyuzenAccount;
  window.ryuzenRefreshAccountSession = refreshAccountSession;
  refreshAccountSession();
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { mergeAnimeListItems, normalizeAnimeListItem };
}
