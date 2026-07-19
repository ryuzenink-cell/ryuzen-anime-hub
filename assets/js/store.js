(() => {
  "use strict";
  const content = document.getElementById("storeContent");
  const filters = document.getElementById("storeFilters");
  const summary = document.getElementById("storeResultsSummary");
  const productSection = document.getElementById("produtos");
  if (!content || !filters) return;

  const placeholder = "/assets/images/logo-placeholder.webp?v=20260719-user-accounts-v1";
  const categories = {
    manga: "Mangás", light_novel: "Light novels", collectible: "Colecionáveis",
    digital_reading: "Leitura digital", geek_gift: "Presentes", apparel: "Roupas e acessórios",
    creators: "Para criadores", other: "Outros",
  };
  const badges = {
    ryuzen_choice: "Escolha Ryuzen", getting_started: "Para começar", highlight: "Destaque",
    recommended: "Recomendado", geek_gift: "Presente geek",
  };
  const AMAZON_HOST_RE = /(?:^|\.)amazon\.(?:com\.br|com|ca|co\.uk|de|es|fr|it|co\.jp|in|com\.mx|com\.au)$/;
  let products = [];
  let activeCategory = "all";
  let loadingController;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function validHttpsUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }
  function validAffiliateUrl(value) {
    const href = validHttpsUrl(value);
    if (!href) return "";
    const hostname = new URL(href).hostname.toLowerCase();
    return hostname === "amzn.to" || AMAZON_HOST_RE.test(hostname) ? href : "";
  }
  function setBusy(busy) { content.setAttribute("aria-busy", String(Boolean(busy))); }
  function setSummary(text = "") { if (summary) summary.textContent = text; }

  function renderLoading() {
    setBusy(true);
    setSummary("Carregando seleção...");
    clear(content);
    const skeleton = element("div", "store-loading");
    skeleton.setAttribute("aria-label", "Carregando produtos");
    for (let index = 0; index < 4; index += 1) skeleton.appendChild(document.createElement("span"));
    content.appendChild(skeleton);
  }

  function renderState({ error = false } = {}) {
    setBusy(false);
    filters.classList.add("hidden");
    setSummary("");
    clear(content);
    const state = element("div", "store-empty state");
    state.appendChild(element("p", "eyebrow", error ? "Loja Ryuzen" : "Em breve"));
    state.appendChild(element("h3", "", error ? "Não foi possível carregar a seleção" : "Novos achados estão chegando"));
    state.appendChild(element("p", "", error ? "A seleção não pôde ser exibida agora. Tente novamente em instantes." : "A equipe Ryuzen está preparando uma seleção especial de produtos para fãs de anime. Volte em breve."));
    if (error) {
      const retry = element("button", "btn ghost store-retry", "Tentar novamente");
      retry.type = "button";
      retry.addEventListener("click", loadProducts, { once: true });
      state.appendChild(retry);
    }
    content.appendChild(state);
  }

  function renderFilters() {
    const available = [...new Set(products.map((product) => product.category).filter((category) => categories[category]))];
    clear(filters);
    if (available.length < 2) {
      filters.classList.add("hidden");
      return;
    }
    const options = [{ key: "all", label: "Todos" }, ...available.map((key) => ({ key, label: categories[key] }))];
    options.forEach(({ key, label }) => {
      const button = element("button", `store-filter${activeCategory === key ? " active" : ""}`, label);
      button.type = "button";
      button.dataset.storeFilter = key;
      button.setAttribute("aria-pressed", String(activeCategory === key));
      filters.appendChild(button);
    });
    filters.classList.remove("hidden");
  }

  function recordClick(productId) {
    const payload = { destination_type: "store_product", product_id: Number(productId), source: "loja" };
    try {
      const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (!navigator.sendBeacon || !navigator.sendBeacon("/api/store/click", body)) {
        fetch("/api/store/click", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      }
    } catch { /* a métrica nunca deve impedir a navegação */ }
  }

  function imageFor(product) {
    const wrap = element("div", "store-image-wrap");
    const badgeText = badges[product.badge];
    if (badgeText) wrap.appendChild(element("span", "store-badge", badgeText));
    const image = element("img", "store-image");
    image.src = validHttpsUrl(product.image_url) || placeholder;
    image.alt = String(product.image_alt || "Imagem do produto selecionado").slice(0, 240);
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      if (!image.classList.contains("is-fallback")) {
        image.src = placeholder;
        image.classList.add("is-fallback");
      }
    }, { once: true });
    wrap.appendChild(image);
    return wrap;
  }

  function cardFor(product) {
    const href = validAffiliateUrl(product.affiliate_url);
    if (!href) return null;
    const card = element("article", "store-card");
    card.appendChild(imageFor(product));
    const body = element("div", "store-card-body");
    body.appendChild(element("p", "store-category", categories[product.category] || "Produto selecionado"));
    body.appendChild(element("h3", "", String(product.name || "Produto selecionado")));
    body.appendChild(element("p", "store-description", String(product.description || "")));
    const footer = element("div", "store-card-footer");
    footer.appendChild(element("p", "store-affiliate", "Produto recomendado · Link afiliado"));
    footer.appendChild(element("p", "store-price-note", "Consulte preço e disponibilidade no site da Amazon."));
    const link = element("a", "btn primary store-cta", "Ver na Amazon");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer sponsored";
    link.setAttribute("aria-label", `Ver ${String(product.name || "produto")} na Amazon`);
    link.addEventListener("click", () => recordClick(product.id));
    footer.appendChild(link);
    body.appendChild(footer);
    card.appendChild(body);
    return card;
  }

  function renderProducts() {
    setBusy(false);
    const visible = activeCategory === "all" ? products : products.filter((product) => product.category === activeCategory);
    if (!visible.length) {
      renderState();
      return;
    }
    const grid = element("div", "store-grid");
    visible.forEach((product) => {
      const card = cardFor(product);
      if (card) grid.appendChild(card);
    });
    if (!grid.children.length) {
      renderState();
      return;
    }
    clear(content);
    content.appendChild(grid);
    const label = visible.length === 1 ? "1 produto selecionado" : `${visible.length} produtos selecionados`;
    setSummary(label);
  }

  async function loadProducts() {
    loadingController?.abort();
    loadingController = new AbortController();
    renderLoading();
    try {
      const response = await fetch("/api/store/products", { headers: { Accept: "application/json" }, signal: loadingController.signal });
      if (!response.ok) throw new Error("Falha na seleção");
      const data = await response.json();
      products = (Array.isArray(data.products) ? data.products : []).filter((product) => validAffiliateUrl(product.affiliate_url));
      activeCategory = "all";
      if (!products.length) {
        renderState();
        return;
      }
      renderFilters();
      renderProducts();
    } catch (error) {
      if (error.name !== "AbortError") renderState({ error: true });
    }
  }

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-store-filter]");
    if (!button) return;
    activeCategory = button.dataset.storeFilter;
    renderFilters();
    renderProducts();
  });

  document.querySelector('.store-hero a[href="#produtos"]')?.addEventListener("click", (event) => {
    if (!productSection) return;
    event.preventDefault();
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    productSection.scrollIntoView({ behavior, block: "start" });
    productSection.focus({ preventScroll: true });
  });

  loadProducts();
})();
