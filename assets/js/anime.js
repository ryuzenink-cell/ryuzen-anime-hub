const detailRoot = document.getElementById("animeDetail");
const id = new URLSearchParams(location.search).get("id");

async function loadAnimeDetail() {
  if (!id) {
    renderEmpty(detailRoot, "Anime não informado", "Abra esta página a partir de uma busca, ranking ou card da home.", `<a class="btn primary" href="search.html">Buscar anime</a>`);
    return;
  }
  renderLoading(detailRoot, 2);
  try {
    const { data } = await fetchAnimeDetails(id);
    document.title = `${data.title} | Ryuzen Anime Hub`;
    const saved = getAnimeById(data.mal_id);
    detailRoot.innerHTML = `
      <section class="detail-layout">
        <aside>
          <img class="detail-cover" src="${imageOf(data)}" alt="Capa de ${escapeHtml(data.title)}">
        </aside>
        <article>
          <p class="eyebrow">Detalhes do anime</p>
          <h1>${escapeHtml(data.title)}</h1>
          ${data.title_japanese ? `<p>${escapeHtml(data.title_japanese)}</p>` : ""}
          <div class="stats-grid">
            <div class="stat"><strong>${formatScore(data.score)}</strong><span>Nota</span></div>
            <div class="stat"><strong>#${data.rank || "-"}</strong><span>Ranking</span></div>
            <div class="stat"><strong>#${data.popularity || "-"}</strong><span>Popularidade</span></div>
            <div class="stat"><strong>${data.episodes || "?"}</strong><span>Episódios</span></div>
          </div>
          <p>${escapeHtml(data.synopsis || "Sinopse indisponível no momento.")}</p>
          <div class="tags">${[data.type, data.status, data.season, data.year].filter(Boolean).map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("")}</div>
          <h2>Gêneros e estúdios</h2>
          ${createGenreTags(data.genres)}
          <p>${data.studios?.length ? `Estúdios: ${data.studios.map((studio) => escapeHtml(studio.name)).join(", ")}` : "Estúdios não informados."}</p>
          <div class="panel">
            <h2>Minha lista</h2>
            <form id="saveForm" class="form-grid">
              <label>Status
                <select name="status">
                  ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${saved?.status === value ? "selected" : ""}>${label}</option>`).join("")}
                </select>
              </label>
              <label>Minha nota
                <input class="field" name="personalScore" type="number" min="0" max="10" step="0.5" value="${saved?.personalScore || ""}" placeholder="0 a 10">
              </label>
              <label>Episódios assistidos
                <input class="field" name="episodesWatched" type="number" min="0" value="${saved?.episodesWatched || ""}" placeholder="0">
              </label>
              <label>Notas
                <textarea name="notes" placeholder="Observações pessoais">${escapeHtml(saved?.notes || "")}</textarea>
              </label>
              <button class="btn primary" type="submit">${saved ? "Atualizar minha lista" : "Adicionar à minha lista"}</button>
              <a class="btn" href="my-list.html">Abrir minha lista</a>
            </form>
          </div>
          ${data.trailer?.embed_url ? `<h2>Trailer</h2><iframe class="trailer-frame" src="${data.trailer.embed_url}" title="Trailer de ${escapeHtml(data.title)}" allowfullscreen></iframe>` : ""}
          <section class="section">
            <h2>Recomendações Ryuzen</h2>
            <div class="state"><p>Em breve, esta área vai sugerir animes parecidos com base em gênero, temporada e perfil da sua lista.</p></div>
          </section>
        </article>
      </section>`;
    document.getElementById("saveForm").addEventListener("submit", (event) => saveDetail(event, data));
  } catch (error) {
    renderError(detailRoot, error.message);
  }
}

function saveDetail(event, anime) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  saveAnimeToList({
    id: anime.mal_id,
    title: anime.title,
    image: imageOf(anime),
    status: form.get("status"),
    personalScore: form.get("personalScore"),
    episodesWatched: form.get("episodesWatched"),
    totalEpisodes: anime.episodes,
    notes: form.get("notes")
  });
  event.currentTarget.querySelector("button").textContent = "Salvo na minha lista";
}

loadAnimeDetail();
