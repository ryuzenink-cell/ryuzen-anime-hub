const monthSelect = document.getElementById("salesMonth");
const storeLabel = document.getElementById("salesStoreLabel");
const periodLabel = document.getElementById("salesPeriodLabel");
const kpiRoot = document.getElementById("salesKpis");
const dataNotice = document.getElementById("salesDataNotice");

async function loadMangaSales() {
  setSalesLoading();
  try {
    const response = await fetch(sitePath(monthSelect.value), { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar a base de mercado de mangás.");

    const data = await response.json();
    renderMangaMarket(data);
  } catch (error) {
    renderError(kpiRoot, error.message);
    document.querySelectorAll(".data-table").forEach((table) => {
      table.innerHTML = "";
    });
    dataNotice.innerHTML = `
      <div class="state sales-warning">
        <h2>Base indisponível</h2>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function setSalesLoading() {
  storeLabel.textContent = "Carregando...";
  kpiRoot.innerHTML = Array.from({ length: 5 }, () => `
    <article class="sales-kpi-card skeleton-kpi">
      <div class="skeleton skeleton-kpi-line"></div>
      <div class="skeleton skeleton-kpi-number"></div>
    </article>
  `).join("");
  dataNotice.innerHTML = "";
}

function renderMangaMarket(data) {
  const { summary = {}, dashboard = {}, period = {} } = data;
  storeLabel.textContent = dashboard.label || "Mercado de Mangás";
  periodLabel.textContent = formatPeriod(period);

  renderKpis(summary);
  renderDataNotice(dashboard);
  renderGlobalSummary(summary);
  renderJapanSummary(summary);
  renderJapanRanking(data.japan_series_rankings || []);
  renderInternationalMarket(data.international_market || []);
  renderFormatDistribution(data.format_distribution || []);
  renderDistributionChannels(data.distribution_channels || []);
  renderTrendInsights(data.trend_insights || []);
  renderSources(data.sources || []);
}

function renderKpis(summary) {
  const kpis = [
    ["Mercado global", formatUsdBillion(summary.global_market_value_usd_billion), "Valor estimado em 2025"],
    ["Projeção 2035", formatUsdBillion(summary.projected_global_market_2035_usd_billion), "Cenário de expansão global"],
    ["Digital", formatPercentFrom100(summary.digital_format_share), "Participação estimada do formato"],
    ["Ásia-Pacífico", formatPercentFrom100(summary.asia_pacific_market_share), "Maior região do mercado"],
    ["Top Japão", formatNumber(summary.japan_top_series_copies), summary.japan_top_series || "Série líder"]
  ];

  kpiRoot.innerHTML = kpis.map(([label, value, help]) => `
    <article class="sales-kpi-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(help)}</small>
    </article>
  `).join("");
}

function renderDataNotice(dashboard) {
  dataNotice.innerHTML = `
    <div class="state sales-warning">
      <h2>Nova identidade do dashboard</h2>
      <p>${escapeHtml(dashboard.note || "Esta página representa o mercado de mangás, não uma loja específica.")}</p>
      <p>Os dados foram estruturados para testes de interface, análise editorial e apresentação em tabelas dentro do Ryuzen Anime Hub.</p>
    </div>
  `;
}

function renderGlobalSummary(summary) {
  const rows = [
    ["Valor estimado do mercado global em 2025", formatUsdBillion(summary.global_market_value_usd_billion)],
    ["Projeção estimada para 2035", formatUsdBillion(summary.projected_global_market_2035_usd_billion)],
    ["Crescimento anual composto estimado", formatPercentFrom100(summary.estimated_cagr_2025_2035)],
    ["Participação do formato digital", formatPercentFrom100(summary.digital_format_share)],
    ["Participação de online/e-commerce", formatPercentFrom100(summary.online_distribution_share)],
    ["Participação da Ásia-Pacífico", formatPercentFrom100(summary.asia_pacific_market_share)],
    ["CAGR projetado da América do Norte", formatPercentFrom100(summary.north_america_projected_cagr)]
  ];

  renderSimpleTable("financialSummaryTable", ["Indicador internacional", "Valor"], rows);
}

function renderJapanSummary(summary) {
  const rows = [
    ["Série mais vendida no Japão", summary.japan_top_series || "-"],
    ["Cópias da líder anual", formatCopies(summary.japan_top_series_copies)],
    ["Cópias somadas do Top 10", formatCopies(summary.japan_top_10_series_copies)],
    ["Média de cópias no Top 10", formatCopies(summary.japan_top_10_average_copies)],
    ["Leitura principal", "One Piece retomou força no ranking japonês, enquanto obras recentes como Dandadan e Blue Lock sustentaram a nova geração."]
  ];

  renderSimpleTable("operationSummaryTable", ["Indicador Japão", "Leitura"], rows);
}

function renderJapanRanking(rankings) {
  const rows = rankings.map((item) => [
    `#${item.rank}`,
    item.title,
    formatCopies(item.copies_sold),
    item.publisher,
    item.segment,
    item.status,
    item.note
  ]);

  renderSimpleTable("channelTable", ["Rank", "Título", "Cópias", "Editora", "Segmento", "Status", "Leitura Ryuzen"], rows);
}

function renderInternationalMarket(regions) {
  const rows = regions.map((item) => [
    item.region,
    formatPercentFrom100(item.estimated_market_share),
    formatUsdBillion(item.estimated_market_value_usd_billion),
    item.growth_profile,
    item.main_drivers
  ]);

  renderSimpleTable("customerTypeTable", ["Região", "Share estimado", "Valor estimado", "Perfil", "Motores de crescimento"], rows);
}

function renderFormatDistribution(formats) {
  const rows = formats.map((item) => [
    item.format,
    formatPercentFrom100(item.share),
    item.reading_behavior,
    item.opportunity
  ]);

  renderSimpleTable("paymentTable", ["Formato", "Participação", "Comportamento", "Oportunidade"], rows);
}

function renderDistributionChannels(channels) {
  const rows = channels.map((item) => [
    item.channel,
    formatPercentFrom100(item.share),
    item.role,
    item.opportunity
  ]);

  renderSimpleTable("productsTable", ["Canal", "Share estimado", "Papel no mercado", "Oportunidade"], rows);
}

function renderTrendInsights(insights) {
  const rows = insights.map((item) => [
    item.theme,
    item.examples,
    item.market_reading,
    item.ryuzen_angle
  ]);

  renderSimpleTable("ordersTable", ["Tendência", "Exemplos", "Leitura de mercado", "Aplicação no Ryuzen"], rows);
}

function renderSources(sources) {
  const table = document.getElementById("sourcesTable");
  if (!table) return;

  const rows = sources.map((source) => [
    source.name,
    source.used_for,
    `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Abrir fonte</a>`
  ]);

  renderSimpleTable("sourcesTable", ["Fonte", "Uso no dashboard", "Link"], rows, true);
}

function renderSimpleTable(tableId, headers, rows, rowsAreHtml = false) {
  const table = document.getElementById(tableId);
  if (!table) return;

  if (!rows.length) {
    table.innerHTML = `
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody><tr><td colspan="${headers.length}">Nenhum dado encontrado.</td></tr></tbody>
    `;
    return;
  }

  table.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map((row) => `
        <tr>${row.map((cell) => `<td>${rowsAreHtml ? cell : escapeHtml(cell)}</td>`).join("")}</tr>
      `).join("")}
    </tbody>
  `;
}

function formatUsdBillion(value) {
  return `${formatNumber(value)} bi US$`;
}

function formatCopies(value) {
  return `${formatNumber(value)} cópias`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatPercentFrom100(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  }).format(Number(value || 0) / 100);
}

function formatDateBR(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatPeriod(period = {}) {
  if (period.label) return period.label;
  if (period.start_date && period.end_date) {
    return `${formatDateBR(period.start_date)} a ${formatDateBR(period.end_date)}`;
  }
  return period.year ? `Ano ${period.year}` : "Resumo anual";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const DATASET_INDEX_PATH = dataPath("manga-market-index.json");
const DATASET_START_YEAR = 2025;
const DATASET_END_YEAR = new Date().getFullYear() + 2;

function getMonthName(month) {
  const monthNames = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro"
  };

  return monthNames[String(month).padStart(2, "0")] || String(month);
}

function normalizeDataset(dataset = {}) {
  if (!dataset.path) return null;

  const year = dataset.year ? String(dataset.year) : "";
  const month = dataset.month ? String(dataset.month).padStart(2, "0") : null;
  const periodType = dataset.period_type || (month ? "monthly" : "annual");

  return {
    id: dataset.id || `${year}-${month || periodType}`,
    label: dataset.label || (month ? `${year} - ${getMonthName(month)}` : `${year} - Apuração anual`),
    year,
    month,
    period_type: periodType,
    status: dataset.status || "available",
    path: dataset.path,
    note: dataset.note || ""
  };
}

function sortDatasets(datasets) {
  return [...datasets].sort((a, b) => {
    if (a.year !== b.year) {
      return Number(b.year || 0) - Number(a.year || 0);
    }

    if (a.period_type === "annual" && b.period_type !== "annual") {
      return -1;
    }

    if (a.period_type !== "annual" && b.period_type === "annual") {
      return 1;
    }

    return Number(b.month || 0) - Number(a.month || 0);
  });
}

async function pathExists(path) {
  try {
    const response = await fetch(sitePath(path), { method: "HEAD", cache: "no-store" });
    if (response.ok) return true;

    // Alguns servidores estáticos podem não responder bem ao HEAD.
    // Neste caso, tentamos GET como fallback.
    if (response.status === 405 || response.status === 501) {
      const fallbackResponse = await fetch(sitePath(path), { cache: "no-store" });
      return fallbackResponse.ok;
    }

    return false;
  } catch (error) {
    return false;
  }
}

async function filterExistingDatasets(datasets) {
  const seenPaths = new Set();
  const normalizedDatasets = datasets
    .map(normalizeDataset)
    .filter(Boolean)
    .filter((dataset) => {
      if (seenPaths.has(dataset.path)) return false;
      seenPaths.add(dataset.path);
      return true;
    });

  const validationResults = await Promise.all(
    normalizedDatasets.map(async (dataset) => ((await pathExists(dataset.path)) ? dataset : null))
  );

  return validationResults.filter(Boolean);
}

async function loadDatasetIndex() {
  try {
    const response = await fetch(DATASET_INDEX_PATH, { cache: "no-store" });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!data.datasets || !Array.isArray(data.datasets)) {
      return [];
    }

    return data.datasets;
  } catch (error) {
    console.warn("Não foi possível carregar o índice de bases.", error);
    return [];
  }
}

function buildConventionDatasetCandidates() {
  const candidates = [];

  for (let year = DATASET_START_YEAR; year <= DATASET_END_YEAR; year += 1) {
    candidates.push({
      id: `${year}-annual`,
      label: `${year} - Apuração anual`,
      year: String(year),
      period_type: "annual",
      status: "complete",
      path: `data/${year}/manga-market-${year}-annual.json`,
      note: `Apuração anual consolidada de ${year}.`
    });

    // Também aceita a variação data/2025/annual/... caso algum ano use esta organização.
    candidates.push({
      id: `${year}-annual-folder`,
      label: `${year} - Apuração anual`,
      year: String(year),
      period_type: "annual",
      status: "complete",
      path: `data/${year}/annual/manga-market-${year}-annual.json`,
      note: `Apuração anual consolidada de ${year}.`
    });

    for (let month = 1; month <= 12; month += 1) {
      const monthKey = String(month).padStart(2, "0");
      const monthLabel = getMonthName(monthKey);

      candidates.push({
        id: `${year}-${monthKey}`,
        label: `${year} - ${monthLabel}`,
        year: String(year),
        month: monthKey,
        period_type: "monthly",
        status: "partial",
        path: `data/${year}/${monthKey}/manga-market-${year}-${monthKey}.json`,
        note: `Apuração mensal de ${monthLabel.toLowerCase()} de ${year}.`
      });

      // Também aceita a variação data/2026/monthly/01/... caso algum ano use esta organização.
      candidates.push({
        id: `${year}-${monthKey}-monthly-folder`,
        label: `${year} - ${monthLabel}`,
        year: String(year),
        month: monthKey,
        period_type: "monthly",
        status: "partial",
        path: `data/${year}/monthly/${monthKey}/manga-market-${year}-${monthKey}.json`,
        note: `Apuração mensal de ${monthLabel.toLowerCase()} de ${year}.`
      });
    }
  }

  return candidates;
}

async function discoverDatasets() {
  const indexedDatasets = await loadDatasetIndex();
  const validIndexedDatasets = await filterExistingDatasets(indexedDatasets);
  const conventionDatasets = await filterExistingDatasets(buildConventionDatasetCandidates());
  const byPath = new Map();

  [...validIndexedDatasets, ...conventionDatasets].forEach((dataset) => {
    if (!byPath.has(dataset.path)) {
      byPath.set(dataset.path, dataset);
    }
  });

  return sortDatasets(Array.from(byPath.values()));
}

function renderDatasetOptions(datasets) {
  if (!monthSelect) return;

  monthSelect.innerHTML = datasets
    .map((dataset) => `<option value="${escapeHtml(dataset.path)}">${escapeHtml(dataset.label)}</option>`)
    .join("");
}

function renderDashboardUnavailable(message) {
  renderError(kpiRoot, message);
  document.querySelectorAll(".data-table").forEach((table) => {
    table.innerHTML = "";
  });
  dataNotice.innerHTML = `
    <div class="state sales-warning">
      <h2>Base indisponível</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

async function initMangaDashboard() {
  try {
    const datasets = await discoverDatasets();

    if (!datasets.length) {
      throw new Error("Nenhuma base JSON válida foi encontrada em data/manga-market-index.json ou nas pastas data/2025, data/2026 etc.");
    }

    renderDatasetOptions(datasets);
    monthSelect.addEventListener("change", loadMangaSales);
    await loadMangaSales();
  } catch (error) {
    console.error(error);
    renderDashboardUnavailable(error.message);
  }
}

initMangaDashboard();
