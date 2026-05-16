const listRoot = document.getElementById("myList");
const countersRoot = document.getElementById("listCounters");
const filterButtons = document.querySelectorAll("[data-status-filter]");
let activeFilter = "all";

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
  const filtered = activeFilter === "all" ? list : list.filter((item) => item.status === activeFilter);
  if (!filtered.length) {
    renderEmpty(listRoot, "Sua lista está vazia por aqui", "Busque animes e salve seus favoritos para acompanhar tudo no navegador.", `<a class="btn primary" href="${RYZEN_ROUTES.search}">Buscar animes</a>`);
    return;
  }
  listRoot.innerHTML = `<div class="ranking-list">${filtered.map(createListItem).join("")}</div>`;
  bindListActions();
}

function createListItem(item) {
  const image = escapeHtml(safeUrl(item.image, assetPath("images/logo-placeholder.svg")));
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
      renderMyList();
    });
  });
}

renderMyList();
