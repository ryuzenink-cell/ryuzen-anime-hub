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
  if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...item };
  else list.unshift(item);
  setAnimeList(list);
  return item;
}

function updateAnimeInList(id, updates) {
  const safeUpdates = normalizeAnimeListItem(updates, false);
  const list = getAnimeList().map((item) => (
    Number(item.id) === Number(id) ? { ...item, ...safeUpdates, updatedAt: new Date().toISOString() } : item
  ));
  setAnimeList(list);
}

function removeAnimeFromList(id) {
  setAnimeList(getAnimeList().filter((item) => Number(item.id) !== Number(id)));
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
