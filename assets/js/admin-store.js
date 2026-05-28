(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const storeFeedback = $("storeFeedback");
  const productForm = $("productForm");
  const bannerForm = $("homeBannerForm");
  if (!productForm || !bannerForm) return;

  const productFields = {
    id: $("productId"), name: $("productName"), category: $("productCategory"), description: $("productDescription"),
    affiliate: $("productAffiliateUrl"), image: $("productImageUrl"), alt: $("productImageAlt"), asin: $("productAsin"),
    related: $("productRelatedTitle"), badge: $("productBadge"), status: $("productStatus"), sort: $("productSortOrder"),
    featured: $("productFeatured"), notes: $("productNotes"),
  };
  const bannerFields = {
    enabled: $("bannerEnabled"), eyebrow: $("homeBannerEyebrow"), title: $("homeBannerTitle"), description: $("homeBannerDescription"),
    buttonText: $("homeBannerButtonText"), buttonUrl: $("homeBannerButtonUrl"), image: $("homeBannerImageUrl"),
    alt: $("homeBannerImageAlt"), disclaimer: $("homeBannerDisclaimer"), status: $("homeBannerStatus"),
  };
  const labels = {
    category: { manga: "Mangá", light_novel: "Light novel", collectible: "Colecionável", digital_reading: "Leitura digital", geek_gift: "Presente geek", apparel: "Roupa/acessório", creators: "Para criadores", other: "Outro" },
    status: { draft: "Rascunho", published: "Publicado", archived: "Arquivado" },
    badge: { none: "Nenhum", ryuzen_choice: "Escolha Ryuzen", getting_started: "Para começar", highlight: "Destaque", recommended: "Recomendado", geek_gift: "Presente geek" },
  };
  const AMAZON_HOST_RE = /(?:^|\.)amazon\.(?:com\.br|com|ca|co\.uk|de|es|fr|it|co\.jp|in|com\.mx|com\.au)$/;
  const placeholder = "/assets/images/logo-placeholder.png";
  let products = [];
  let metrics = null;
  let capabilities = { linkReview: false };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function clear(node) { while (node?.firstChild) node.removeChild(node.firstChild); }
  function notice(text, type = "success") {
    if (window.AdminUI) window.AdminUI.toast(text, type === "error" ? "error" : type);
    if (!storeFeedback) return;
    storeFeedback.textContent = text; storeFeedback.className = `admin-alert ${type}`; storeFeedback.classList.remove("hidden");
  }
  function debounce(fn, wait) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
  }
  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }
  function safeHttpsUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }
  function safeAffiliateUrl(value) {
    const href = safeHttpsUrl(value);
    if (!href) return "";
    const hostname = new URL(href).hostname.toLowerCase();
    return hostname === "amzn.to" || AMAZON_HOST_RE.test(hostname) ? href : "";
  }
  function containsMarkup(value) { return /[<>]/.test(String(value || "")); }
  function markInvalid(field, message) {
    field?.classList.add("invalid");
    field?.setAttribute("aria-invalid", "true");
    if (field) field.setCustomValidity(message);
    return { field, message };
  }
  function clearInvalid(fields) {
    Object.values(fields).forEach((field) => {
      if (!field || !(field instanceof HTMLElement)) return;
      field.classList.remove("invalid");
      field.removeAttribute("aria-invalid");
      if (typeof field.setCustomValidity === "function") field.setCustomValidity("");
    });
  }
  function firstError(errors) {
    if (!errors.length) return true;
    const { field, message } = errors[0];
    notice(message, "error");
    field?.focus();
    return false;
  }
  async function withSubmitting(button, text, work) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = text;
    try { return await work(); }
    finally { button.disabled = false; button.textContent = original; }
  }

  function setTab(key) {
    document.querySelectorAll("[data-store-tab]").forEach((button) => {
      const active = button.dataset.storeTab === key;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-store-panel]").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.storePanel !== key));
  }

  function productPayload() {
    return {
      name: productFields.name.value.trim(), category: productFields.category.value, description: productFields.description.value.trim(),
      affiliate_url: productFields.affiliate.value.trim(), image_url: productFields.image.value.trim(), image_alt: productFields.alt.value.trim(),
      asin: productFields.asin.value.trim(), related_title: productFields.related.value.trim(), badge: productFields.badge.value,
      status: productFields.status.value, sort_order: Number(productFields.sort.value || 100), is_featured: productFields.featured.checked,
      internal_notes: productFields.notes.value.trim(),
    };
  }
  function publicationChecklist(payload) {
    const rows = [
      [Boolean(payload.name), "Nome do produto preenchido", true], [Boolean(payload.description), "Descrição preenchida", true],
      [Boolean(safeAffiliateUrl(payload.affiliate_url)), "URL afiliada Amazon HTTPS válida", true], [Boolean(safeHttpsUrl(payload.image_url)), "Imagem HTTPS válida", true],
      [Boolean(payload.image_alt), "Texto alternativo da imagem", true], [Boolean(payload.category), "Categoria selecionada", true],
      [Boolean(capabilities.linkReview && productFields.id.value && products.find((p) => String(p.id) === String(productFields.id.value))?.link_review_status === "reviewed"), capabilities.linkReview ? "Link revisado manualmente" : "Revisão manual disponível após migration 0005", false],
    ];
    const root = $("productChecklist"); if (root) root.innerHTML = rows.map(([ok, label, blocking]) => `<li class="${ok ? "done" : blocking ? "blocking" : "warning"}"><span>${ok ? "✓" : "!"}</span>${label}${!ok && blocking ? " (bloqueante para publicar)" : ""}</li>`).join("");
    return rows;
  }
  function validateProductClient(payload) {
    clearInvalid(productFields); const errors = []; const publishing = payload.status === "published";
    publicationChecklist(payload);
    if (publishing && !payload.name) errors.push(markInvalid(productFields.name, "Informe o nome do produto antes de publicar."));
    if (publishing && !payload.description) errors.push(markInvalid(productFields.description, "Informe uma descrição antes de publicar."));
    if (payload.description.length > 180) errors.push(markInvalid(productFields.description, "A descrição deve ter até 180 caracteres."));
    if ((publishing || payload.affiliate_url) && !safeAffiliateUrl(payload.affiliate_url)) errors.push(markInvalid(productFields.affiliate, "Use um link HTTPS legítimo da Amazon ou amzn.to."));
    if ((publishing || payload.image_url) && !safeHttpsUrl(payload.image_url)) errors.push(markInvalid(productFields.image, "A imagem deve usar uma URL válida iniciada por https://."));
    if ((publishing || payload.image_url) && !payload.image_alt) errors.push(markInvalid(productFields.alt, "Informe o texto alternativo da imagem."));
    if (!["draft", "published", "archived"].includes(payload.status)) errors.push(markInvalid(productFields.status, "Selecione um status válido."));
    [productFields.name, productFields.description, productFields.alt, productFields.related, productFields.notes].forEach((field) => { if (containsMarkup(field.value)) errors.push(markInvalid(field, "Não utilize HTML ou scripts nos campos de texto.")); });
    return firstError(errors);
  }

  function bannerPayload() {
    return {
      enabled: bannerFields.enabled.checked, eyebrow: bannerFields.eyebrow.value.trim(), title: bannerFields.title.value.trim(),
      description: bannerFields.description.value.trim(), button_text: bannerFields.buttonText.value.trim(), button_url: "/loja/",
      image_url: bannerFields.image.value.trim(), image_alt: bannerFields.alt.value.trim(), affiliate_disclaimer: bannerFields.disclaimer.value.trim(),
      status: bannerFields.status.value,
    };
  }
  function validateBannerClient(payload) {
    clearInvalid(bannerFields);
    const errors = [];
    [[bannerFields.eyebrow, payload.eyebrow, "Informe a etiqueta do banner."], [bannerFields.title, payload.title, "Informe o título do banner."], [bannerFields.description, payload.description, "Informe a descrição do banner."], [bannerFields.buttonText, payload.button_text, "Informe o texto do botão."], [bannerFields.disclaimer, payload.affiliate_disclaimer, "Informe o aviso de afiliado."]].forEach(([field, value, message]) => {
      if (!value) errors.push(markInvalid(field, message));
      if (containsMarkup(value)) errors.push(markInvalid(field, "Não utilize HTML ou scripts nos campos de texto."));
    });
    if (payload.image_url && !safeHttpsUrl(payload.image_url)) errors.push(markInvalid(bannerFields.image, "A imagem deve usar uma URL válida iniciada por https://."));
    if (payload.image_url && !payload.image_alt) errors.push(markInvalid(bannerFields.alt, "Informe o texto alternativo da imagem do banner."));
    if (!["active", "inactive", "archived"].includes(payload.status)) errors.push(markInvalid(bannerFields.status, "Selecione um status válido."));
    return firstError(errors);
  }

  function appendFallbackImage(parent, src, alt, className) {
    const image = element("img", className);
    image.src = safeHttpsUrl(src) || placeholder;
    image.alt = alt || "Imagem do produto";
    image.loading = "lazy";
    image.addEventListener("error", () => { image.src = placeholder; image.classList.add("is-fallback"); }, { once: true });
    parent.appendChild(image);
    return image;
  }

  function renderProductPreview() {
    const root = $("productPreview");
    const name = productFields.name.value.trim();
    if (!name) { root.classList.add("hidden"); clear(root); return; }
    root.classList.remove("hidden");
    clear(root);
    appendFallbackImage(root, productFields.image.value.trim(), productFields.alt.value.trim() || "Prévia da imagem", "store-preview-image");
    const body = element("div", "store-preview-body");
    body.appendChild(element("small", "", labels.category[productFields.category.value] || "Produto"));
    body.appendChild(element("strong", "", name));
    body.appendChild(element("p", "", productFields.description.value.trim() || "Descrição curta do produto"));
    body.appendChild(element("span", "store-preview-affiliate", "Produto recomendado · Link afiliado"));
    root.appendChild(body);
  }

  function renderBannerPreview() {
    const root = $("homeBannerPreview");
    if (!root) return;
    clear(root);
    const payload = bannerPayload();
    const copy = element("div", "home-banner-preview-copy");
    copy.appendChild(element("small", "", payload.eyebrow || "LOJA RYUZEN · SELEÇÃO DA SEMANA"));
    copy.appendChild(element("strong", "", payload.title || "Achados para quem vive o mundo anime"));
    copy.appendChild(element("p", "", payload.description || "Mangás, light novels e produtos selecionados pela Ryuzen."));
    copy.appendChild(element("span", "home-banner-preview-btn", payload.button_text || "Explorar a Loja"));
    copy.appendChild(element("em", "", payload.affiliate_disclaimer || "Links afiliados. Compras são processadas pela Amazon."));
    root.appendChild(copy);
    const visual = element("div", "home-banner-preview-visual");
    if (payload.image_url) appendFallbackImage(visual, payload.image_url, payload.image_alt || "Prévia do banner", "");
    else visual.appendChild(element("strong", "", "本"));
    root.appendChild(visual);
  }

  function productStatusPill(status) {
    return element("span", `status-pill ${status}`, labels.status[status] || status);
  }
  function button(text, classes, callback) {
    const node = element("button", classes, text);
    node.type = "button";
    if (callback) node.addEventListener("click", callback);
    return node;
  }
  function renderProducts() {
    const root = $("productsList");
    clear(root);
    if (!products.length) {
      root.appendChild(element("div", "admin-empty", "Nenhum produto cadastrado neste filtro."));
      return;
    }
    products.forEach((product) => {
      const row = element("article", "store-admin-row");
      appendFallbackImage(row, product.image_url, product.image_alt, "store-admin-thumb");
      const info = element("div", "store-admin-info");
      info.appendChild(element("strong", "", product.name));
      const meta = element("p", "store-admin-meta");
      meta.appendChild(document.createTextNode(`${labels.category[product.category] || product.category} · `));
      meta.appendChild(productStatusPill(product.status));
      if (product.badge && product.badge !== "none") meta.appendChild(document.createTextNode(` · ${labels.badge[product.badge] || product.badge}`));
      info.appendChild(meta);
      info.appendChild(element("small", "", `Ordem ${Number(product.sort_order)} · Atualizado em ${formatDate(product.updated_at)}`));
      const reviewLabel = !capabilities.linkReview ? "Revisão de link aguardando migration 0005" : product.link_review_status === "reviewed" ? `Link revisado em ${formatDate(product.last_reviewed_at)}` : product.link_review_status === "needs_check" ? "Link precisa ser verificado" : "Link ainda não revisado";
      info.appendChild(element("small", `store-link-review ${product.link_review_status || "not_reviewed"}`, reviewLabel));
      row.appendChild(info);
      const actions = element("div", "row-actions");
      actions.appendChild(button("Editar", "btn ghost small", () => editProduct(product)));
      actions.appendChild(button("↑", "btn ghost small", () => moveProduct(product.id, "move-up")));
      actions.appendChild(button("↓", "btn ghost small", () => moveProduct(product.id, "move-down")));
      if (capabilities.linkReview) {
        actions.appendChild(button("Revisado hoje", "btn ghost small", () => reviewLink(product.id, "reviewed")));
        actions.appendChild(button("Verificar link", "btn ghost small", () => reviewLink(product.id, "needs_check")));
      }
      const affiliate = safeAffiliateUrl(product.affiliate_url);
      if (affiliate) {
        const link = element("a", "btn ghost small", "Ver link");
        link.href = affiliate; link.target = "_blank"; link.rel = "noopener noreferrer sponsored";
        actions.appendChild(link);
      }
      if (product.status === "draft") actions.appendChild(button("Publicar", "btn primary small", () => actionProduct(product.id, "publish")));
      if (product.status === "published") actions.appendChild(button("Despublicar", "btn ghost small", () => actionProduct(product.id, "unpublish")));
      if (product.status !== "archived") actions.appendChild(button("Arquivar", "btn danger small", () => actionProduct(product.id, "archive")));
      row.appendChild(actions);
      root.appendChild(row);
    });
  }

  function editProduct(product) {
    setTab("products");
    productFields.id.value = product.id;
    productFields.name.value = product.name || "";
    productFields.category.value = product.category || "manga";
    productFields.description.value = product.description || "";
    productFields.affiliate.value = product.affiliate_url || "";
    productFields.image.value = product.image_url || "";
    productFields.alt.value = product.image_alt || "";
    productFields.asin.value = product.asin || "";
    productFields.related.value = product.related_title || "";
    productFields.badge.value = product.badge || "none";
    productFields.status.value = product.status || "draft";
    productFields.sort.value = Number(product.sort_order ?? 100);
    productFields.featured.checked = Boolean(product.is_featured);
    productFields.notes.value = product.internal_notes || "";
    $("productEditorTitle").textContent = "Editar produto";
    $("descriptionCount").textContent = String(productFields.description.value.length);
    renderProductPreview(); publicationChecklist(productPayload());
    productFields.name.focus();
    productForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function resetProduct() {
    productForm.reset();
    clearInvalid(productFields);
    productFields.id.value = "";
    productFields.sort.value = "100";
    productFields.status.value = "draft";
    $("productEditorTitle").textContent = "Novo produto";
    $("descriptionCount").textContent = "0";
    $("productPreview").classList.add("hidden");
    clear($("productPreview")); publicationChecklist(productPayload());
  }

  async function saveProduct(event) {
    event.preventDefault();
    const payload = productPayload();
    if (!validateProductClient(payload)) return;
    const id = productFields.id.value;
    await withSubmitting($("saveProductButton"), "Salvando...", async () => {
      try {
        await adminFetch(id ? `/api/admin/store/products/${id}` : "/api/admin/store/products", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
        notice(id ? "Produto atualizado com sucesso." : "Produto criado com sucesso.");
        resetProduct();
        await Promise.all([loadProducts(), loadMetrics()]);
      } catch (error) { notice(error.message, "error"); }
    });
  }
  async function loadProducts() {
    const root = $("productsList");
    clear(root); root.appendChild(element("div", "admin-empty", "Carregando produtos..."));
    try {
      const params = new URLSearchParams({ q: $("productSearch").value.trim(), status: $("productFilterStatus").value, category: $("productFilterCategory").value });
      const data = await adminFetch(`/api/admin/store/products?${params}`);
      products = Array.isArray(data.products) ? data.products : [];
      capabilities = { linkReview: Boolean(data.capabilities?.linkReview) };
      renderProducts();
      publicationChecklist(productPayload());
    } catch (error) {
      notice(error.message, "error");
      clear(root); root.appendChild(element("div", "admin-empty", "Não foi possível carregar os produtos."));
    }
  }

  function confirmAction(message, affirmativeText) {
    if (window.AdminUI) return window.AdminUI.confirm(message, { confirmText: affirmativeText, variant: affirmativeText === "Publicar" ? "primary" : "danger" });
    return Promise.resolve(window.confirm(message));
  }
  async function actionProduct(id, action) {
    const copy = {
      publish: { question: "Publicar este produto na Loja pública?", button: "Publicar", success: "Produto publicado." },
      unpublish: { question: "Retirar este produto da Loja pública e mantê-lo como rascunho?", button: "Despublicar", success: "Produto despublicado." },
      archive: { question: "Arquivar este produto? Ele deixará de aparecer publicamente.", button: "Arquivar", success: "Produto arquivado." },
    }[action];
    if (!copy || !(await confirmAction(copy.question, copy.button))) return;
    try {
      await adminFetch(`/api/admin/store/products/${id}/${action}`, { method: "POST" });
      notice(copy.success);
      await Promise.all([loadProducts(), loadMetrics()]);
    } catch (error) { notice(error.message, "error"); }
  }

  async function moveProduct(id, direction) {
    try { const result = await adminFetch(`/api/admin/store/products/${id}/${direction}`, { method: "POST" }); notice(result.message, result.moved ? "success" : "info"); await loadProducts(); } catch (error) { notice(error.message, "error"); }
  }
  async function reviewLink(id, status) {
    try { const result = await adminFetch(`/api/admin/store/products/${id}/mark-link-reviewed`, { method: "POST", body: JSON.stringify({ status }) }); notice(result.message); await Promise.all([loadProducts(), loadMetrics()]); } catch (error) { notice(error.message, "error"); }
  }

  async function loadBanner() {
    try {
      const { banner } = await adminFetch("/api/admin/store/banner");
      if (!banner) { renderBannerPreview(); return; }
      bannerFields.enabled.checked = Boolean(banner.enabled);
      bannerFields.eyebrow.value = banner.eyebrow || "";
      bannerFields.title.value = banner.title || "";
      bannerFields.description.value = banner.description || "";
      bannerFields.buttonText.value = banner.button_text || "";
      bannerFields.buttonUrl.value = "/loja/";
      bannerFields.image.value = banner.image_url || "";
      bannerFields.alt.value = banner.image_alt || "";
      bannerFields.disclaimer.value = banner.affiliate_disclaimer || "";
      bannerFields.status.value = banner.status || "inactive";
      renderBannerPreview();
    } catch (error) { notice(error.message, "error"); }
  }
  async function saveBanner(event) {
    event.preventDefault();
    const payload = bannerPayload();
    if (!validateBannerClient(payload)) return;
    await withSubmitting($("saveBannerButton"), "Salvando...", async () => {
      try {
        await adminFetch("/api/admin/store/banner", { method: "PUT", body: JSON.stringify(payload) });
        notice("Banner da home atualizado.");
        renderBannerPreview();
        await loadMetrics();
      } catch (error) { notice(error.message, "error"); }
    });
  }

  function renderMetrics(data) {
    metrics = data;
    const metricCards = [
      ["Publicados", Number(data.products?.published || 0), "Visíveis na Loja"],
      ["Rascunhos", Number(data.products?.draft || 0), "Em preparação"],
      ["Cliques em produtos", Number(data.totals?.product_clicks || 0), "Sem dados pessoais"],
      ["Cliques no banner", Number(data.totals?.banner_clicks || 0), "Origem: home"],
    ];
    const summary = $("storeMetrics");
    clear(summary);
    metricCards.forEach(([title, value, note]) => {
      const card = element("article", "admin-stat");
      card.appendChild(element("span", "", title)); card.appendChild(element("strong", "", value)); card.appendChild(element("small", "", note));
      summary.appendChild(card);
    });
    const popular = $("storePopularProducts");
    clear(popular);
    const rows = (data.popular || []).filter((row) => Number(row.clicks || 0) > 0);
    if (!rows.length) { popular.appendChild(element("div", "admin-empty", "Ainda não há cliques em produtos para comparar.")); return; }
    rows.forEach((row, index) => {
      const item = element("article", "store-popular-row");
      item.appendChild(element("span", "store-popular-rank", `#${index + 1}`));
      item.appendChild(element("strong", "", row.name));
      item.appendChild(element("small", "", `${Number(row.clicks)} clique${Number(row.clicks) === 1 ? "" : "s"}`));
      popular.appendChild(item);
    });
  }
  async function loadMetrics() {
    try { renderMetrics(await adminFetch("/api/admin/store/metrics")); }
    catch { /* métricas não bloqueiam o gerenciamento */ }
  }

  $("storeTabs")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-store-tab]");
    if (tab) setTab(tab.dataset.storeTab);
  });
  $("newProduct")?.addEventListener("click", () => { setTab("products"); resetProduct(); productFields.name.focus(); });
  $("clearProduct")?.addEventListener("click", resetProduct);
  productForm.addEventListener("submit", saveProduct);
  bannerForm.addEventListener("submit", saveBanner);
  $("productFilterStatus")?.addEventListener("change", loadProducts);
  $("productFilterCategory")?.addEventListener("change", loadProducts);
  $("productSearch")?.addEventListener("input", debounce(loadProducts, 260));
  productFields.description.addEventListener("input", () => { $("descriptionCount").textContent = String(productFields.description.value.length); renderProductPreview(); publicationChecklist(productPayload()); });
  [productFields.affiliate, productFields.status].forEach((field) => field?.addEventListener("input", () => publicationChecklist(productPayload())));
  [productFields.name, productFields.image, productFields.alt, productFields.category, productFields.badge].forEach((field) => {
    field?.addEventListener("input", () => { renderProductPreview(); publicationChecklist(productPayload()); });
    field?.addEventListener("change", () => { renderProductPreview(); publicationChecklist(productPayload()); });
  });
  Object.values(bannerFields).forEach((field) => field?.addEventListener("input", renderBannerPreview));
  bannerFields.status.addEventListener("change", renderBannerPreview);
  bannerFields.enabled.addEventListener("change", renderBannerPreview);

  requireAdminSession(() => {
    setTab("products");
    renderProductPreview();
    renderBannerPreview(); publicationChecklist(productPayload());
    Promise.all([loadProducts(), loadBanner(), loadMetrics()]);
  });
})();
