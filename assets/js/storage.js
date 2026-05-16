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
}

function saveAnimeToList(anime) {
  const list = getAnimeList();
  const existingIndex = list.findIndex((item) => Number(item.id) === Number(anime.id));
  const item = { ...anime, updatedAt: new Date().toISOString() };
  if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...item };
  else list.unshift(item);
  setAnimeList(list);
  return item;
}

function updateAnimeInList(id, updates) {
  const list = getAnimeList().map((item) => (
    Number(item.id) === Number(id) ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
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
