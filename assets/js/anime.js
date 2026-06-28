const detailRoot = document.getElementById("animeDetail");
const id = new URLSearchParams(location.search).get("id");

const DETAIL_SEASON_LABELS = { winter: "Inverno", spring: "Primavera", summer: "Verão", fall: "Outono" };

function detailNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("pt-BR") : null;
}

function capitalizeWord(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function formatSeasonYear(data) {
  const season = data.season ? (DETAIL_SEASON_LABELS[String(data.season).toLowerCase()] || capitalizeWord(data.season)) : "";
  const year = data.year || data.aired?.prop?.from?.year || "";
  return [season, year].filter(Boolean).join(" ");
}

function namesOf(list) {
  return (Array.isArray(list) ? list : []).map((item) => item && item.name).filter(Boolean);
}

function detailMetric(value, label) {
  return `<div class="adetail-metric"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function detailFact(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<div class="adetail-fact"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

function detailChipGroup(label, list) {
  const names = namesOf(list);
  if (!names.length) return "";
  return `<div class="adetail-chip-group"><span class="adetail-chip-label">${escapeHtml(label)}</span><div class="adetail-chips">${names.map((name) => `<span class="adetail-chip">${escapeHtml(name)}</span>`).join("")}</div></div>`;
}

function updateMetaDescription(text) {
  const tag = document.querySelector('meta[name="description"]');
  if (!tag || !text) return;
  const clean = String(text).replace(/\s+/g, " ").trim().slice(0, 155);
  if (clean) tag.setAttribute("content", clean);
}

async function loadAnimeDetail() {
  if (!id || !/^\d+$/.test(id)) {
    renderEmpty(detailRoot, "Anime não informado",
      "Abra esta página a partir de uma busca, ranking ou card da home.",
      `<a class="btn primary" href="${RYZEN_ROUTES.search}">Buscar anime</a>`
    );
    return;
  }
  renderAnimeDetailLoading(detailRoot);
  try {
    const { data } = await fetchAnimeDetails(id);
    document.title = `${data.title || "Detalhes do Anime"} | Ryuzen Anime Hub`;
    const saved = getAnimeById(data.mal_id);
    const trailerUrl = safeYouTubeEmbedUrl(data.trailer?.embed_url);
    const malUrl = safeUrl(data.url, "");

    let synopsis = data.synopsis || "";
    let synopsisNotice = "";
    if (data.synopsis) {
      try {
        const translatedSynopsis = await translateTextToPortuguese(data.synopsis);
        if (translatedSynopsis) {
          synopsis = translatedSynopsis;
          synopsisNotice = "Sinopse traduzida automaticamente.";
        }
      } catch (error) {
        console.error("Erro ao traduzir sinopse:", error);
        synopsisNotice = "Sinopse original em inglês. Tradução automática indisponível no momento.";
      }
    }
    updateMetaDescription(synopsis || data.title);

    const seasonYear = formatSeasonYear(data);
    const altTitleEnglish = data.title_english && data.title_english !== data.title ? data.title_english : "";

    const heroBadges = [data.type, data.status, seasonYear].filter(Boolean)
      .map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("");

    const metrics = [
      detailMetric(formatScore(data.score), "Nota"),
      detailMetric(data.rank ? `#${detailNumber(data.rank)}` : "—", "Ranking"),
      detailMetric(data.popularity ? `#${detailNumber(data.popularity)}` : "—", "Popularidade"),
      detailMetric(detailNumber(data.members) || "—", "Membros"),
      detailMetric(detailNumber(data.favorites) || "—", "Favoritos"),
      detailMetric(detailNumber(data.episodes) || "—", "Episódios"),
    ].join("");

    const episodesFact = detailNumber(data.episodes)
      || (String(data.status || "").toLowerCase().includes("not yet") ? "A definir" : "Desconhecido");
    const duration = data.duration && !/unknown/i.test(data.duration) ? data.duration : "";

    const facts = [
      detailFact("Formato", data.type),
      detailFact("Episódios", episodesFact),
      detailFact("Status", data.status),
      detailFact("Exibição", data.aired?.string),
      detailFact("Temporada", seasonYear),
      detailFact("Duração", duration),
      detailFact("Fonte", data.source),
      detailFact("Classificação", data.rating),
      detailFact("Transmissão", data.broadcast?.string),
      detailFact("Estúdios", namesOf(data.studios).join(", ")),
      detailFact("Produtores", namesOf(data.producers).join(", ")),
      detailFact("Licenciadoras", namesOf(data.licensors).join(", ")),
      detailFact("Avaliações", data.scored_by ? `${detailNumber(data.scored_by)} votos` : ""),
    ].join("");

    const chips = [
      detailChipGroup("Gêneros", data.genres),
      detailChipGroup("Temas", data.themes),
      detailChipGroup("Demografia", data.demographics),
    ].join("");

    const heroActions = [
      `<a class="btn primary" href="#minha-lista">${saved ? "Atualizar na lista" : "Organizar na lista"}</a>`,
      `<a class="btn ghost" href="${RYZEN_ROUTES.search}">Voltar à busca</a>`,
      trailerUrl ? `<a class="btn ghost" href="#trailer">Ver trailer</a>` : "",
    ].join("");

    const usefulLinks = [
      malUrl ? `<a class="adetail-link" href="${escapeHtml(malUrl)}" target="_blank" rel="noopener noreferrer">Abrir no MyAnimeList<span aria-hidden="true">↗</span></a>` : "",
      `<a class="adetail-link" href="${RYZEN_ROUTES.search}">Voltar à busca</a>`,
      `<a class="adetail-link" href="${RYZEN_ROUTES.ranking}">Ver rankings</a>`,
      `<a class="adetail-link" href="${RYZEN_ROUTES.season}">Animes da temporada</a>`,
      `<a class="adetail-link" href="${RYZEN_ROUTES.blog}">Explorar editorial</a>`,
    ].join("");

    const synopsisHtml = synopsis
      ? `<p>${escapeHtml(synopsis)}</p>${synopsisNotice ? `<small>${escapeHtml(synopsisNotice)}</small>` : ""}`
      : `<p class="adetail-empty">Sinopse ainda não disponível para este título.</p>`;

    detailRoot.innerHTML = `
      <div class="detail-backdrop" aria-hidden="true"><img src="${escapeHtml(imageOf(data, "large"))}" alt="" decoding="async"></div>
      <div class="anime-detail">
        <aside class="adetail-aside">
          <div class="adetail-poster"><img src="${escapeHtml(imageOf(data, "large"))}" width="360" height="540" loading="eager" fetchpriority="high" alt="Capa de ${escapeHtml(data.title)}"></div>
          <div class="adetail-actions">${heroActions}</div>
        </aside>
        <div class="adetail-right">
          <div class="adetail-head">
            <p class="eyebrow">Detalhes do anime</p>
            <h1>${escapeHtml(data.title)}</h1>
            ${(data.title_japanese || altTitleEnglish) ? `<div class="adetail-titles">${data.title_japanese ? `<span lang="ja">${escapeHtml(data.title_japanese)}</span>` : ""}${altTitleEnglish ? `<span>${escapeHtml(altTitleEnglish)}</span>` : ""}</div>` : ""}
            ${heroBadges ? `<div class="adetail-badges">${heroBadges}</div>` : ""}
            <div class="adetail-metrics">${metrics}</div>
          </div>
          <div class="adetail-body">
          <div class="adetail-main">
            <section class="adetail-section">
              <h2>Sinopse</h2>
              <div class="adetail-synopsis">${synopsisHtml}</div>
            </section>
            ${chips ? `<section class="adetail-section"><h2>Gêneros e temas</h2><div class="adetail-chip-groups">${chips}</div></section>` : ""}
            ${facts ? `<section class="adetail-section"><h2>Ficha técnica</h2><dl class="adetail-facts">${facts}</dl></section>` : ""}
            ${trailerUrl ? `<section class="adetail-section" id="trailer"><h2>Trailer</h2><iframe class="trailer-frame" src="${escapeHtml(trailerUrl)}" title="Trailer de ${escapeHtml(data.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></section>` : ""}
            <section class="adetail-section">
              <h2>Recomendações Ryuzen</h2>
              <div class="state"><p>Em breve, esta área vai sugerir animes parecidos com base em gênero, temporada e perfil da sua lista.</p></div>
            </section>
          </div>
          <aside class="adetail-side">
            <section class="adetail-section" id="minha-lista">
              <h2>Minha lista</h2>
              <form id="saveForm" class="adetail-form">
                <label>Status
                  <select name="status">
                    ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${saved?.status === value ? "selected" : ""}>${label}</option>`).join("")}
                  </select>
                </label>
                <div class="adetail-form-row">
                  <label>Minha nota
                    <input class="field" name="personalScore" type="number" min="0" max="10" step="0.5" value="${saved?.personalScore ?? ""}" placeholder="0 a 10">
                  </label>
                  <label>Episódios assistidos
                    <input class="field" name="episodesWatched" type="number" min="0" value="${saved?.episodesWatched ?? ""}" placeholder="0">
                  </label>
                </div>
                <label>Notas
                  <textarea name="notes" placeholder="Observações pessoais">${escapeHtml(saved?.notes || "")}</textarea>
                </label>
                <div class="adetail-form-actions">
                  <button class="btn primary" type="submit">${saved ? "Atualizar minha lista" : "Adicionar à minha lista"}</button>
                  <a class="btn ghost" href="${RYZEN_ROUTES.myList}">Abrir minha lista</a>
                </div>
              </form>
            </section>
            <section class="adetail-section">
              <h2>Links úteis</h2>
              <nav class="adetail-links" aria-label="Links úteis deste anime">${usefulLinks}</nav>
            </section>
          </aside>
          </div>
        </div>
      </div>`;
    document.getElementById("saveForm").addEventListener("submit", (event) => saveDetail(event, data));
  } catch (error) {
    renderDetailError(error);
  }
}

// Estado de erro amigável e específico da ficha — nunca expõe a mensagem técnica crua da API.
function renderDetailError(error) {
  const status = Number(error?.status);
  const notFound = status === 404 || error?.code === "DISCOVERY_NOT_FOUND";
  const busy = status === 429 || status === 503 || status === 504;
  const title = notFound ? "Anime não encontrado" : "Não conseguimos carregar os detalhes";
  const message = notFound
    ? "Não localizamos este anime no catálogo. O link pode estar incorreto ou a obra pode ter sido removida."
    : busy
      ? "A fonte de dados está temporariamente ocupada. Aguarde alguns instantes e tente novamente."
      : "Algo impediu o carregamento deste anime. Verifique sua conexão e tente novamente.";
  const retryButton = notFound ? "" : `<button class="btn primary" type="button" data-detail-retry>Tentar novamente</button>`;
  detailRoot.innerHTML = `
    <div class="state adetail-error">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <div class="adetail-error-actions">
        ${retryButton}
        <a class="btn${notFound ? " primary" : ""}" href="${RYZEN_ROUTES.search}">Buscar anime</a>
        <a class="btn ghost" href="${RYZEN_ROUTES.home}">Voltar ao início</a>
      </div>
    </div>`;
  detailRoot.querySelector("[data-detail-retry]")?.addEventListener("click", loadAnimeDetail);
}

function saveDetail(event, anime) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  saveAnimeToList({
    id: anime.mal_id,
    title: anime.title,
    image: imageOf(anime, "large"),
    status: form.get("status"),
    personalScore: form.get("personalScore"),
    episodesWatched: form.get("episodesWatched"),
    totalEpisodes: anime.episodes,
    notes: form.get("notes")
  });
  const button = event.currentTarget.querySelector("button[type=submit]");
  if (button) button.textContent = "Salvo na minha lista";
  if (window.ryuzenPublicToast) window.ryuzenPublicToast("Anime salvo na sua lista.");
}

loadAnimeDetail();
