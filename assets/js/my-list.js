const listRoot = document.getElementById("myList");
const countersRoot = document.getElementById("listCounters");
const filterButtons = document.querySelectorAll("[data-status-filter]");
let activeFilter = "all";
const myListSearch = document.getElementById("myListSearch");
let listQuery = "";
myListSearch?.addEventListener("input", () => { listQuery = myListSearch.value.toLocaleLowerCase("pt-BR").trim(); renderMyList(); });

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.statusFilter;
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderMyList();
  });
});

function renderCounters(list) {
  const count = (status) => list.filter((item) => item.status === status).length;
  countersRoot.innerHTML = `
    <div class="stat"><strong>${list.length}</strong><span>Total</span></div>
    <div class="stat"><strong>${count("watching")}</strong><span>Assistindo</span></div>
    <div class="stat"><strong>${count("completed")}</strong><span>Concluídos</span></div>
    <div class="stat"><strong>${count("favorite")}</strong><span>Favoritos</span></div>`;
}

function renderMyList() {
  const list = getAnimeList();
  renderCounters(list);
  const statusFiltered = activeFilter === "all" ? list : list.filter((item) => item.status === activeFilter);
  const filtered = listQuery ? statusFiltered.filter((item) => item.title.toLocaleLowerCase("pt-BR").includes(listQuery)) : statusFiltered;
  if (!filtered.length) {
    renderEmpty(listRoot, "Sua lista está vazia por aqui", "Busque animes e salve seus favoritos para acompanhar tudo no navegador.", `<a class="btn primary" href="${RYZEN_ROUTES.search}">Buscar animes</a>`);
    return;
  }
  listRoot.innerHTML = `<div class="ranking-list">${filtered.map(createListItem).join("")}</div>`;
  bindListActions();
}

function createListItem(item) {
  const total = Number(item.totalEpisodes) || 0;
  const watched = Number(item.episodesWatched) || 0;
  const progress = total ? Math.min(100, Math.round((watched / total) * 100)) : 0;
  const image = escapeHtml(safeUrl(item.image, assetPath("images/logo-placeholder.webp?v=20260724-status-banner-v2")));
  const title = escapeHtml(item.title);
  return `
    <article class="list-item" data-id="${item.id}">
      <img src="${image}" alt="Capa de ${title}">
      <div>
        <h3>${title}</h3>
        <div class="meta-line">
          <span class="badge ${item.status === "favorite" ? "fav" : ""}">${STATUS_LABELS[item.status] || "Quero assistir"}</span>
          <span>Nota pessoal: ${item.personalScore || "-"}</span>
          <span>Eps: ${item.episodesWatched || 0}/${item.totalEpisodes || "?"}</span>
        </div>
        ${total ? `<progress class="list-progress" value="${progress}" max="100" aria-label="Progresso: ${progress}%"></progress>` : ""}
        <div class="list-actions">
          <select data-edit="status">${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>`).join("")}</select>
          <input class="field" data-edit="personalScore" type="number" min="0" max="10" step="0.5" value="${item.personalScore || ""}" placeholder="Nota">
          <input class="field" data-edit="episodesWatched" type="number" min="0" value="${item.episodesWatched || ""}" placeholder="Episódios">
          <button class="btn danger" data-remove>Remover</button>
        </div>
      </div>
    </article>`;
}

function bindListActions() {
  document.querySelectorAll("[data-id]").forEach((row) => {
    const id = row.dataset.id;
    row.querySelectorAll("[data-edit]").forEach((field) => {
      field.addEventListener("change", () => {
        updateAnimeInList(id, { [field.dataset.edit]: field.value });
        renderMyList();
      });
    });
    row.querySelector("[data-remove]").addEventListener("click", () => {
      removeAnimeFromList(id);
      if (window.ryuzenPublicToast) window.ryuzenPublicToast("Anime removido da sua lista.");
      renderMyList();
    });
  });
}

document.addEventListener("ryuzen:list-updated", renderMyList);

const deviceNote = document.getElementById("deviceNote");
const accountSyncNote = document.getElementById("accountSyncNote");
function setAccountNote(message) {
  if (!accountSyncNote) return;
  if (!message) { accountSyncNote.classList.add("hidden"); accountSyncNote.innerHTML = ""; return; }
  accountSyncNote.classList.remove("hidden");
  accountSyncNote.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 4.2L2.7 17.4A2 2 0 004.4 20h15.2a2 2 0 001.7-2.6L13.7 4.2a2 2 0 00-3.4 0z"/></svg><p>${message}</p>`;
}
function reflectAccountState(state) {
  if (!state) return;
  if (state.dbUnavailable) {
    setAccountNote("O sistema de contas está temporariamente indisponível. Sua lista continua funcionando normalmente neste dispositivo.");
    if (deviceNote) deviceNote.classList.remove("hidden");
    return;
  }
  if (state.authenticated) {
    setAccountNote(`Sua lista está sincronizada com a conta <strong>${escapeHtml(state.email)}</strong>.`);
    if (deviceNote) deviceNote.classList.add("hidden");
  } else if (state.checked) {
    setAccountNote("");
    if (deviceNote) deviceNote.classList.remove("hidden");
  }
}
document.addEventListener("ryuzen:account-state", (event) => reflectAccountState(event.detail));
document.addEventListener("ryuzen:account-sync-start", () => setAccountNote("Sincronizando sua lista com sua conta..."));
document.addEventListener("ryuzen:account-sync-end", () => reflectAccountState(window.ryuzenAccountState));
if (window.ryuzenAccountState?.checked) reflectAccountState(window.ryuzenAccountState);

renderMyList();
