const upcomingRoot = document.getElementById("upcomingGrid");
const upcomingSearch = document.getElementById("upcomingSearch");
const upcomingTypeFilter = document.getElementById("upcomingTypeFilter");
const upcomingSortFilter = document.getElementById("upcomingSortFilter");
const upcomingCount = document.getElementById("upcomingCount");
const upcomingLastUpdated = document.getElementById("upcomingLastUpdated");
const loadMoreUpcomingButton = document.getElementById("loadMoreUpcoming");

let upcomingItems = [];
let upcomingPage = 1;
let upcomingHasNextPage = false;
let upcomingSourceLabel = "Jikan";

async function loadUpcomingAnime({ reset = false } = {}) {
  if (reset) {
    upcomingItems = [];
    upcomingPage = 1;
    renderLoading(upcomingRoot, 8);
    loadMoreUpcomingButton.hidden = true;
  } else {
    loadMoreUpcomingButton.disabled = true;
    loadMoreUpcomingButton.textContent = "Carregando...";
  }

  try {
    const response = await fetchUpcomingAnime(upcomingPage);
    upcomingSourceLabel = "Jikan /anime?status=upcoming";
    addUpcomingItems(response.data || []);
    upcomingHasNextPage = Boolean(response.pagination?.has_next_page);
    renderUpcomingAnime();
  } catch (error) {
    if (upcomingItems.length > 0) {
      renderUpcomingAnime();
      renderInlineUpcomingWarning(error.message);
      return;
    }

    try {
      const fallback = await fetchSeasonUpcoming(1);
      upcomingSourceLabel = "Jikan /seasons/upcoming";
      addUpcomingItems(fallback.data || []);
      upcomingHasNextPage = Boolean(fallback.pagination?.has_next_page);
      renderUpcomingAnime();
    } catch (fallbackError) {
      renderError(upcomingRoot, fallbackError.message);
      upcomingCount.textContent = "0 títulos";
      upcomingLastUpdated.textContent = "Não foi possível atualizar a lista agora.";
      loadMoreUpcomingButton.hidden = true;
    }
  } finally {
    loadMoreUpcomingButton.disabled = false;
    loadMoreUpcomingButton.textContent = "Carregar mais";
  }
}

function addUpcomingItems(items) {
  const knownIds = new Set(upcomingItems.map((anime) => anime.mal_id));
  const uniqueItems = items.filter((anime) => anime?.mal_id && !knownIds.has(anime.mal_id));
  upcomingItems = [...upcomingItems, ...uniqueItems];
}

function renderUpcomingAnime() {
  const query = upcomingSearch.value.trim().toLowerCase();
  const type = upcomingTypeFilter.value;
  const sort = upcomingSortFilter.value;

  let items = upcomingItems.filter((anime) => {
    const titleMatch = [anime.title, anime.title_english, anime.title_japanese]
      .filter(Boolean)
      .some((title) => title.toLowerCase().includes(query));
    const typeMatch = type === "all" || anime.type === type;
    return titleMatch && typeMatch;
  });

  items.sort((a, b) => {
    if (sort === "title") return String(a.title || "").localeCompare(String(b.title || ""));
    if (sort === "popularity") return (a.popularity || 999999) - (b.popularity || 999999);
    return getReleaseTimestamp(a) - getReleaseTimestamp(b);
  });

  upcomingCount.textContent = `${items.length} ${items.length === 1 ? "título" : "títulos"}`;
  upcomingLastUpdated.textContent = `Atualizado em ${formatDateTime(new Date())}. Fonte: ${upcomingSourceLabel}.`;
  loadMoreUpcomingButton.hidden = !upcomingHasNextPage || upcomingSourceLabel.includes("/seasons/upcoming");

  if (!items.length) {
    renderEmpty(upcomingRoot, "Nenhum anime encontrado", "Tente limpar a busca ou mudar o tipo selecionado.");
    return;
  }

  upcomingRoot.innerHTML = `<div class="upcoming-grid">${items.map(createUpcomingCard).join("")}</div>`;
}

function createUpcomingCard(anime) {
  const animeId = Number(anime.mal_id);
  const title = escapeHtml(anime.title || "Título não informado");
  const animeUrl = routeWithQuery(RYZEN_ROUTES.anime, { id: animeId });
  const release = getReleaseLabel(anime);
  const season = getSeasonLabel(anime);
  const broadcast = getBroadcastLabel(anime);
  const status = escapeHtml(anime.status || "Status indefinido");

  return `
    <article class="upcoming-card">
      <a href="${animeUrl}" aria-label="Ver detalhes de ${title}">
        <img class="upcoming-poster" src="${escapeHtml(imageOf(anime))}" alt="Capa de ${title}" loading="lazy">
      </a>
      <div class="upcoming-card-body">
        <div class="blog-card-topline">
          <span class="badge warn">${escapeHtml(release)}</span>
          <span>${escapeHtml(anime.type || "Anime")}</span>
        </div>
        <h3>${title}</h3>
        <div class="meta-line">
          <span>${season}</span>
          <span>${broadcast}</span>
          <span>${status}</span>
        </div>
        <div class="meta-line">
          <span>${escapeHtml(anime.episodes || "?")} eps</span>
          <span>Popularidade #${escapeHtml(anime.popularity || "?")}</span>
        </div>
        ${createGenreTags(anime.genres)}
        <a class="btn ghost" href="${animeUrl}">Ver detalhes</a>
      </div>
    </article>`;
}

function getReleaseTimestamp(anime) {
  const timestamp = Date.parse(anime?.aired?.from || "");
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function getReleaseLabel(anime) {
  const from = anime?.aired?.from;
  if (from) return formatDate(new Date(from));

  const airedText = anime?.aired?.string;
  if (airedText && !/^not available/i.test(airedText)) return airedText;

  return "Data a confirmar";
}

function getSeasonLabel(anime) {
  const season = translateSeason(anime.season);
  const year = anime.year || anime.aired?.prop?.from?.year;
  if (season && year) return `${season} ${year}`;
  if (year) return String(year);
  return "Temporada a confirmar";
}

function getBroadcastLabel(anime) {
  const broadcast = anime?.broadcast?.string;
  if (broadcast && !/^unknown/i.test(broadcast)) return broadcast;
  return "Horário a confirmar";
}

function translateSeason(season) {
  return {
    winter: "Inverno",
    spring: "Primavera",
    summer: "Verão",
    fall: "Outono"
  }[String(season || "").toLowerCase()] || "";
}

function formatDate(date) {
  if (Number.isNaN(date.getTime())) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderInlineUpcomingWarning(message) {
  upcomingRoot.insertAdjacentHTML("afterbegin", `<div class="state upcoming-warning"><strong>Aviso:</strong> ${escapeHtml(message)}</div>`);
}

upcomingSearch.addEventListener("input", renderUpcomingAnime);
upcomingTypeFilter.addEventListener("change", renderUpcomingAnime);
upcomingSortFilter.addEventListener("change", renderUpcomingAnime);
loadMoreUpcomingButton.addEventListener("click", () => {
  upcomingPage += 1;
  loadUpcomingAnime();
});

loadUpcomingAnime({ reset: true });
