const editorState = {
  id: new URLSearchParams(location.search).get("id"),
  dirty: false,
  slugTouched: false,
  selection: null,
  activeLink: null,
  openModal: null,
  modalTrigger: null,
  focusMode: false,
  status: "draft",
  featured: false
};

const form = document.getElementById("postEditorForm");
const editor = document.getElementById("richEditor");
const title = document.getElementById("postTitle");
const slug = document.getElementById("postSlug");
const canonical = document.getElementById("canonicalUrl");
const feedback = document.getElementById("editorFeedback");
const linkModal = document.getElementById("linkModal");
const imageModal = document.getElementById("imageModal");
const previewModal = document.getElementById("previewModal");
const removeLinkButton = document.getElementById("removeLink");

requireAdminSession(initEditor);

async function initEditor() {
  bindEditor();
  setDraftStatus("clean");
  updateWritingStats();
  syncSeoPreview();
  await loadCategories();
  if (editorState.id) await loadPost(editorState.id);
}

function bindEditor() {
  form.addEventListener("input", () => markDirty());
  title.addEventListener("input", () => {
    if (!editorState.slugTouched) {
      slug.value = toSlug(title.value);
      canonical.value = dynamicUrl(slug.value);
    }
    syncSeoPreview();
  });
  slug.addEventListener("input", () => {
    editorState.slugTouched = true;
    slug.value = toSlug(slug.value);
    canonical.value = dynamicUrl(slug.value);
    syncSeoPreview();
  });

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => applyFormat(button.dataset.command, button.dataset.value));
  });

  document.getElementById("openLinkModal").addEventListener("click", (event) => openLinkModal(event.currentTarget));
  removeLinkButton.addEventListener("click", removeSelectedLink);
  document.getElementById("openImageModal").addEventListener("click", (event) => openImageModal(event.currentTarget));
  document.getElementById("toggleFocusMode").addEventListener("click", toggleFocusMode);

  document.getElementById("cancelLink").addEventListener("click", () => closeLinkModal(true));
  document.getElementById("linkForm").addEventListener("submit", (event) => {
    event.preventDefault();
    insertOrUpdateLink();
  });
  document.getElementById("removeLinkFromModal").addEventListener("click", () => removeSelectedLink(true));

  document.getElementById("cancelImage").addEventListener("click", () => closeImageModal(true));
  document.getElementById("imageForm").addEventListener("submit", (event) => {
    event.preventDefault();
    insertImage();
  });

  document.getElementById("saveDraft").addEventListener("click", () => savePost());
  document.getElementById("publishPost").addEventListener("click", publishPost);
  document.getElementById("previewPost").addEventListener("click", (event) => showPreview(event.currentTarget));
  document.getElementById("featurePost")?.addEventListener("click", featurePost);
  document.getElementById("closePreview").addEventListener("click", () => closePreview(true));

  editor.addEventListener("input", () => {
    captureEditorSelection();
    updateLinkToolState();
  });
  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    markDirty();
  });
  editor.addEventListener("drop", (event) => {
    event.preventDefault();
    showFeedback("Use o botão Imagem para inserir mídia com URL e texto alternativo.", "error");
  });
  editor.addEventListener("mouseup", () => {
    captureEditorSelection();
    updateLinkToolState();
  });
  editor.addEventListener("keyup", () => {
    captureEditorSelection();
    updateLinkToolState();
  });

  document.addEventListener("selectionchange", () => {
    if (hasActiveEditorSelection()) {
      captureEditorSelection();
      updateLinkToolState();
    }
  });
  document.addEventListener("keydown", handleKeyboardShortcuts);

  [linkModal, imageModal, previewModal].forEach((modal) => {
    modal.addEventListener("keydown", trapModalFocus);
    modal.addEventListener("mousedown", (event) => {
      if (event.target !== modal) return;
      if (modal === linkModal) closeLinkModal(true);
      if (modal === imageModal) closeImageModal(true);
      if (modal === previewModal) closePreview(true);
    });
  });

  window.addEventListener("beforeunload", (event) => {
    if (editorState.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}

async function loadCategories() {
  try {
    const data = await fetch("/api/categories", { cache: "no-store" }).then((response) => response.json());
    const select = document.getElementById("categoryId");
    (data.categories || []).forEach((category) => {
      select.insertAdjacentHTML("beforeend", `<option value="${escapeAttr(category.id)}">${escapeText(category.name)}</option>`);
    });
  } catch {
    showFeedback("Não foi possível carregar categorias.", "error");
  }
}

async function loadPost(id) {
  try {
    const { post } = await adminFetch(`/api/admin/posts/${id}`);
    title.value = post.title || "";
    slug.value = post.slug || "";
    val("excerpt", post.excerpt);
    val("categoryId", post.category_id || "");
    val("tags", (post.tags || []).join(", "));
    val("coverImageUrl", post.cover_image_url);
    val("coverAlt", post.cover_alt);
    val("coverCredit", post.cover_credit);
    val("coverSourceUrl", post.cover_source_url);
    val("socialImageUrl", post.social_image_url);
    val("seoTitle", post.seo_title);
    val("seoDescription", post.seo_description);
    canonical.value = post.canonical_url || dynamicUrl(post.slug);
    editor.innerHTML = post.content_html || "";
    editorState.status = post.status || "draft"; editorState.featured = Boolean(post.featured);
    updateFeaturedControl(); await loadRevisions();
    editorState.slugTouched = true;
    editorState.dirty = false;
    setDraftStatus("clean");
    updateWritingStats();
    syncSeoPreview();
    updateLinkToolState();
  } catch (error) {
    showFeedback(error.message, "error");
  }
}

function val(id, value) {
  document.getElementById(id).value = value || "";
}

function applyFormat(command, value) {
  restoreOrCreateEditorSelection();
  editor.focus();
  if (command === "formatBlock") {
    document.execCommand(command, false, value);
  } else {
    document.execCommand(command, false, null);
  }
  captureEditorSelection();
  markDirty();
  updateLinkToolState();
}

function captureEditorSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!rangeBelongsToEditor(range)) return false;
  editorState.selection = range.cloneRange();
  return true;
}

function rangeBelongsToEditor(range) {
  return !!range && (
    range.commonAncestorContainer === editor ||
    editor.contains(range.commonAncestorContainer)
  );
}

function hasActiveEditorSelection() {
  const selection = window.getSelection();
  return !!selection && selection.rangeCount > 0 && rangeBelongsToEditor(selection.getRangeAt(0));
}

function restoreOrCreateEditorSelection() {
  let range = editorState.selection;
  if (!range || !rangeBelongsToEditor(range)) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    editorState.selection = range.cloneRange();
  }
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

function setCaretAfter(node) {
  if (!node || !editor.contains(node)) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  editorState.selection = range.cloneRange();
}

function elementFromNode(node) {
  return node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
}

function findLinkInRange(range = editorState.selection) {
  if (!range || !rangeBelongsToEditor(range)) return null;
  const immediate = elementFromNode(range.startContainer)?.closest("a");
  if (immediate && editor.contains(immediate)) return immediate;
  for (const link of editor.querySelectorAll("a")) {
    try {
      if (range.intersectsNode(link)) return link;
    } catch {
      // Ignore stale DOM ranges.
    }
  }
  return null;
}

function updateLinkToolState() {
  const currentLink = findLinkInRange();
  const hasLink = !!currentLink;
  removeLinkButton.disabled = !hasLink;
  document.getElementById("openLinkModal").classList.toggle("active", hasLink);
}

function openLinkModal(trigger = document.getElementById("openLinkModal")) {
  if (hasActiveEditorSelection()) captureEditorSelection();
  const range = editorState.selection;
  const activeLink = findLinkInRange(range);
  const selectedText = activeLink ? activeLink.textContent : (range && !range.collapsed ? range.toString() : "");
  editorState.activeLink = activeLink;
  editorState.originalLinkText = selectedText;

  document.getElementById("linkModalTitle").textContent = activeLink ? "Editar link" : "Inserir link";
  document.getElementById("submitLink").textContent = activeLink ? "Salvar alterações" : "Inserir link";
  document.getElementById("removeLinkFromModal").classList.toggle("hidden", !activeLink);
  document.getElementById("linkText").value = selectedText;
  document.getElementById("linkUrl").value = activeLink ? (activeLink.getAttribute("href") || "") : "";
  document.getElementById("linkTitle").value = activeLink ? (activeLink.getAttribute("title") || "") : "";
  clearModalError("linkFormError");
  openModal(linkModal, document.getElementById("linkText"), trigger);
}

function closeLinkModal(returnFocus = true) {
  closeModal(linkModal, returnFocus);
  document.getElementById("linkForm").reset();
  clearModalError("linkFormError");
  editorState.activeLink = null;
}

function insertOrUpdateLink() {
  clearModalError("linkFormError");
  const text = valGet("linkText");
  const href = normalizeHttpUrl(valGet("linkUrl"));
  const linkTitle = valGet("linkTitle");

  if (!text) {
    showModalError("linkFormError", "Informe o texto que será exibido no artigo.");
    document.getElementById("linkText").focus();
    return;
  }
  if (!href) {
    showModalError("linkFormError", "Informe uma URL válida iniciada por http:// ou https://.");
    document.getElementById("linkUrl").focus();
    return;
  }

  if (editorState.activeLink && editor.contains(editorState.activeLink)) {
    const link = editorState.activeLink;
    setLinkAttributes(link, href, linkTitle);
    if (text !== editorState.originalLinkText) link.textContent = text;
    setCaretAfter(link);
  } else {
    const range = restoreOrCreateEditorSelection();
    editor.focus();
    if (!range.collapsed && text === editorState.originalLinkText) {
      document.execCommand("createLink", false, href);
      const createdLinks = linksIntersectingRange(range);
      if (createdLinks.length) {
        createdLinks.forEach((link) => setLinkAttributes(link, href, linkTitle));
        setCaretAfter(createdLinks[createdLinks.length - 1]);
      }
    } else {
      const link = createLinkElement(text, href, linkTitle);
      range.deleteContents();
      range.insertNode(link);
      setCaretAfter(link);
    }
  }

  closeLinkModal(false);
  editor.focus();
  captureEditorSelection();
  markDirty();
  updateLinkToolState();
}

function createLinkElement(text, href, linkTitle) {
  const link = document.createElement("a");
  link.textContent = text;
  setLinkAttributes(link, href, linkTitle);
  return link;
}

function setLinkAttributes(link, href, linkTitle) {
  link.setAttribute("href", href);
  if (linkTitle) link.setAttribute("title", linkTitle);
  else link.removeAttribute("title");
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noopener noreferrer nofollow");
}

function linksIntersectingRange(range) {
  return [...editor.querySelectorAll("a")].filter((link) => {
    try {
      return range.intersectsNode(link);
    } catch {
      return false;
    }
  });
}

function removeSelectedLink(fromModal = false) {
  const link = fromModal && editorState.activeLink ? editorState.activeLink : findLinkInRange();
  if (!link || !editor.contains(link)) return;

  const parent = link.parentNode;
  const lastChild = link.lastChild;
  while (link.firstChild) parent.insertBefore(link.firstChild, link);
  link.remove();

  if (lastChild && editor.contains(lastChild)) setCaretAfter(lastChild);
  if (fromModal) closeLinkModal(false);
  editor.focus();
  captureEditorSelection();
  markDirty();
  updateLinkToolState();
}

function openImageModal(trigger = document.getElementById("openImageModal")) {
  if (hasActiveEditorSelection()) captureEditorSelection();
  clearModalError("imageFormError");
  openModal(imageModal, document.getElementById("inlineImageUrl"), trigger);
}

function closeImageModal(returnFocus = true) {
  closeModal(imageModal, returnFocus);
  document.getElementById("imageForm").reset();
  clearModalError("imageFormError");
}

function insertImage() {
  clearModalError("imageFormError");
  const url = normalizeHttpUrl(valGet("inlineImageUrl"));
  const alt = valGet("inlineImageAlt");
  const caption = valGet("inlineImageCaption");
  const credit = valGet("inlineImageCredit");
  const sourceValue = valGet("inlineImageSource");
  const source = sourceValue ? normalizeHttpUrl(sourceValue) : "";

  if (!url || !alt) {
    showModalError("imageFormError", "Informe uma URL http/https válida e o texto alternativo da imagem.");
    (!url ? document.getElementById("inlineImageUrl") : document.getElementById("inlineImageAlt")).focus();
    return;
  }
  if (sourceValue && !source) {
    showModalError("imageFormError", "A URL da fonte oficial precisa começar por http:// ou https://.");
    document.getElementById("inlineImageSource").focus();
    return;
  }

  restoreOrCreateEditorSelection();
  const figure = `<figure class="article-figure"><img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async"><figcaption class="article-caption">${caption ? `<span class="caption">${escapeText(caption)}</span>` : ""}${credit ? `<span class="credit">Crédito: ${escapeText(credit)}</span>` : ""}${source ? `<a href="${escapeAttr(source)}" target="_blank" rel="noopener noreferrer nofollow">Fonte oficial</a>` : ""}</figcaption></figure><p><br></p>`;
  editor.focus();
  document.execCommand("insertHTML", false, figure);
  closeImageModal(false);
  captureEditorSelection();
  markDirty();
}

function collectImages() {
  return [...editor.querySelectorAll("figure.article-figure")].map((figure, index) => ({
    image_url: figure.querySelector("img")?.src || "",
    alt_text: figure.querySelector("img")?.alt || "",
    caption: figure.querySelector(".caption")?.textContent || "",
    credit_text: (figure.querySelector(".credit")?.textContent || "").replace(/^Crédito:\s*/, ""),
    source_url: figure.querySelector("a")?.href || "",
    placement: "inline",
    position_order: index
  }));
}

function payload() {
  return {
    title: title.value.trim(),
    slug: slug.value.trim(),
    excerpt: valGet("excerpt"),
    content_html: editor.innerHTML,
    category_id: valGet("categoryId") || null,
    tags: valGet("tags").split(",").map((item) => item.trim()).filter(Boolean),
    cover_image_url: valGet("coverImageUrl"),
    cover_alt: valGet("coverAlt"),
    cover_credit: valGet("coverCredit"),
    cover_source_url: valGet("coverSourceUrl"),
    social_image_url: valGet("socialImageUrl"),
    seo_title: valGet("seoTitle"),
    seo_description: valGet("seoDescription"),
    canonical_url: canonical.value.trim(),
    images: collectImages()
  };
}

async function savePost() {
  setDraftStatus("saving");
  try {
    const body = payload();
    const method = editorState.id ? "PUT" : "POST";
    const url = editorState.id ? `/api/admin/posts/${editorState.id}` : "/api/admin/posts";
    const result = await adminFetch(url, { method, body: JSON.stringify(body) });
    if (!editorState.id) {
      editorState.id = result.id;
      history.replaceState({}, "", `/admin/blog/editar/?id=${result.id}`);
    }
    editorState.dirty = false;
    setDraftStatus("saved");
    showFeedback("Rascunho salvo com sucesso.", "success");
    if (editorState.id) await loadRevisions();
    return editorState.id;
  } catch (error) {
    setDraftStatus("error");
    showFeedback(error.message, "error");
    return null;
  }
}

async function publishPost() {
  const blocking = getSeoChecks().filter((item) => item.level === "block");
  if (blocking.length) {
    showFeedback(`Corrija antes de publicar: ${blocking.map((item) => item.label).join("; ")}.`, "error");
    return;
  }
  const id = await savePost();
  if (id && confirm("Publicar o artigo agora?")) {
    try {
      const result = await adminFetch(`/api/admin/posts/${id}/publish`, { method: "POST" });
      editorState.dirty = false;
      setDraftStatus("saved");
      editorState.status = "published"; updateFeaturedControl();
      showFeedback(`Artigo publicado. URL: ${result.url}`, "success");
    } catch (error) {
      setDraftStatus("error");
      showFeedback(error.message, "error");
    }
  }
}

function updateFeaturedControl() {
  const control = document.getElementById("featuredEditorialControl"); const button = document.getElementById("featurePost"); const status = document.getElementById("featuredStatus");
  if (!control || !editorState.id) return; control.classList.remove("hidden");
  button.disabled = editorState.status !== "published" || editorState.featured;
  status.textContent = editorState.featured ? "Este artigo é o destaque atual." : editorState.status !== "published" ? "Publique o artigo antes de destacá-lo." : "Somente um artigo pode ficar em destaque.";
}
async function featurePost() {
  if (!editorState.id || editorState.status !== "published") return;
  const ok = window.AdminUI ? await window.AdminUI.confirm("Definir este artigo como o destaque editorial? O destaque anterior será removido.", { confirmText: "Destacar", variant: "primary" }) : window.confirm("Definir este artigo como destaque?");
  if (!ok) return;
  try { const data = await adminFetch(`/api/admin/posts/${editorState.id}/feature`, { method: "POST" }); editorState.featured = true; updateFeaturedControl(); showFeedback(data.message, "success"); } catch (error) { showFeedback(error.message, "error"); }
}
async function loadRevisions() {
  if (!editorState.id) return; const panel = document.getElementById("postRevisionsPanel"); const root = document.getElementById("postRevisions"); panel?.classList.remove("hidden");
  try { const data = await adminFetch(`/api/admin/posts/${editorState.id}/revisions`); const revisions = data.revisions || []; root.innerHTML = revisions.length ? revisions.map((r) => `<article class="post-revision"><div><strong>${escapeText(r.title)}</strong><small>${escapeText(formatRevisionDate(r.created_at))} · ${escapeText(r.revision_note || "Versão salva")}</small></div><div class="row-actions"><button class="btn ghost small" type="button" data-preview-revision="${r.id}">Prévia</button><button class="btn danger small" type="button" data-restore-revision="${r.id}">Restaurar</button></div><div class="revision-preview hidden" data-revision-content="${r.id}"><h3>${escapeText(r.title)}</h3><p>${escapeText(r.excerpt || "")}</p>${escapeText(r.content_markdown || "")}</div></article>`).join("") : '<p class="muted">Nenhuma revisão anterior registrada.</p>';
    root.querySelectorAll("[data-preview-revision]").forEach((btn) => btn.addEventListener("click", () => root.querySelector(`[data-revision-content="${btn.dataset.previewRevision}"]`)?.classList.toggle("hidden")));
    root.querySelectorAll("[data-restore-revision]").forEach((btn) => btn.addEventListener("click", () => restoreRevision(btn.dataset.restoreRevision)));
  } catch (error) { root.innerHTML = `<p class="admin-alert error">${escapeText(error.message)}</p>`; }
}
async function restoreRevision(revisionId) {
  const ok = window.AdminUI ? await window.AdminUI.confirm("Restaurar esta versão? A versão atual será salva no histórico antes da restauração.", { confirmText: "Restaurar" }) : window.confirm("Restaurar esta versão?"); if (!ok) return;
  try { const result = await adminFetch(`/api/admin/posts/${editorState.id}/revisions/${revisionId}/restore`, { method: "POST" }); showFeedback(result.message, "success"); await loadPost(editorState.id); } catch (error) { showFeedback(error.message, "error"); }
}
function formatRevisionDate(value) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(String(value).includes("T") ? value : `${value.replace(" ", "T")}Z`)) : "—"; }

function showPreview(trigger = document.getElementById("previewPost")) {
  const body = payload();
  const preview = document.getElementById("previewCanvas");
  preview.innerHTML = `<header class="blog-article-header"><p class="eyebrow">Prévia editorial</p><h1>${escapeText(body.title || "Título do artigo")}</h1><p>${escapeText(body.excerpt || "Resumo do artigo")}</p></header>${body.cover_image_url ? `<img class="blog-article-cover" src="${escapeAttr(body.cover_image_url)}" alt="${escapeAttr(body.cover_alt)}">` : ""}<div class="blog-content">${editor.innerHTML}</div>`;
  openModal(previewModal, document.getElementById("closePreview"), trigger);
}

function closePreview(returnFocus = true) {
  closeModal(previewModal, returnFocus);
}

function getSeoChecks() {
  const body = payload();
  const plain = editor.textContent.trim();
  const headings = editor.querySelectorAll("h2,h3").length;
  const links = [...editor.querySelectorAll("a")];
  const badLink = links.some((link) => !isHttpUrl(link.href));
  const images = collectImages();
  const badImg = images.some((image) => !image.alt_text);
  return [
    { label: "Título preenchido", ok: !!body.title, level: !body.title ? "block" : "ok" },
    { label: "Slug válido", ok: !!body.slug, level: !body.slug ? "block" : "ok" },
    { label: "Resumo preenchido", ok: !!body.excerpt, level: !body.excerpt ? "block" : "ok" },
    { label: "Conteúdo preenchido", ok: !!plain || images.length > 0, level: (!plain && !images.length) ? "block" : "ok" },
    { label: "Categoria selecionada", ok: !!body.category_id, level: body.category_id ? "ok" : "warn" },
    { label: "Título SEO preenchido", ok: !!body.seo_title, level: body.seo_title ? "ok" : "warn" },
    { label: "Título SEO recomendado (30–65 caracteres)", ok: body.seo_title.length >= 30 && body.seo_title.length <= 65, level: "warn" },
    { label: "Meta description preenchida", ok: !!body.seo_description, level: body.seo_description ? "ok" : "warn" },
    { label: "Meta description recomendada (120–160 caracteres)", ok: body.seo_description.length >= 120 && body.seo_description.length <= 160, level: "warn" },
    { label: "Capa com texto alternativo", ok: !body.cover_image_url || !!body.cover_alt, level: body.cover_image_url && !body.cover_alt ? "block" : "ok" },
    { label: "Imagem social configurada", ok: !!body.social_image_url, level: body.social_image_url ? "ok" : "warn" },
    { label: "Sumário automático disponível (2+ headings)", ok: headings >= 2, level: headings >= 2 ? "ok" : "warn" },
    { label: "Links externos seguros", ok: !badLink, level: badLink ? "block" : "ok" },
    { label: "Imagens internas com alt text", ok: !badImg, level: badImg ? "block" : "ok" },
    { label: "CTA final aplicado automaticamente", ok: true, level: "ok" }
  ];
}

function syncSeoPreview() {
  const body = payload();
  document.getElementById("seoPreviewTitle").textContent = body.seo_title || body.title || "Título do artigo";
  document.getElementById("seoPreviewUrl").textContent = body.canonical_url || dynamicUrl(body.slug || "slug-do-post");
  document.getElementById("seoPreviewDescription").textContent = body.seo_description || body.excerpt || "Descrição exibida nos mecanismos de pesquisa.";
  document.getElementById("socialPreviewTitle").textContent = body.seo_title || body.title || "Título do artigo";
  document.getElementById("socialPreviewDescription").textContent = body.seo_description || body.excerpt || "Descrição para compartilhamento.";
  const image = document.getElementById("socialPreviewImage");
  const source = body.social_image_url || body.cover_image_url;
  if (source && isHttpUrl(source)) {
    image.src = source;
    image.classList.remove("hidden");
  } else {
    image.classList.add("hidden");
  }
  document.getElementById("seoChecklist").innerHTML = getSeoChecks().map((check) => `<li class="${check.ok ? "ok" : check.level}">${check.ok ? "✓" : "!"} ${escapeText(check.label)}</li>`).join("");
}

function updateWritingStats() {
  const plainText = editor.innerText.replace(/\s+/g, " ").trim();
  const words = plainText ? plainText.split(" ").filter(Boolean).length : 0;
  const characters = plainText.length;
  const minutes = words ? Math.max(1, Math.ceil(words / 220)) : 0;
  const reading = minutes ? `aproximadamente ${minutes} min de leitura` : "menos de 1 min de leitura";
  document.getElementById("writingStats").textContent = `${formatNumber(words)} palavras • ${formatNumber(characters)} caracteres • ${reading}`;
}

function markDirty() {
  editorState.dirty = true;
  setDraftStatus("dirty");
  updateWritingStats();
  syncSeoPreview();
}

function setDraftStatus(status) {
  const statusElement = document.getElementById("draftStatus");
  const labels = {
    clean: "Sem alterações pendentes",
    dirty: "Alterações não salvas",
    saving: "Salvando rascunho…",
    saved: "Rascunho salvo",
    error: "Erro ao salvar"
  };
  statusElement.className = `draft-status ${status}`;
  statusElement.textContent = labels[status] || labels.clean;
}

function toggleFocusMode() {
  editorState.focusMode = !editorState.focusMode;
  form.classList.toggle("editor-focus-mode", editorState.focusMode);
  const button = document.getElementById("toggleFocusMode");
  button.setAttribute("aria-pressed", String(editorState.focusMode));
  button.setAttribute("aria-label", editorState.focusMode ? "Sair do modo foco" : "Ativar modo foco");
  button.textContent = editorState.focusMode ? "Sair do modo foco" : "Modo foco";
}

function openModal(modal, initialFocus, trigger) {
  editorState.openModal = modal;
  editorState.modalTrigger = trigger || document.activeElement;
  modal.classList.remove("hidden");
  document.body.classList.add("editor-modal-open");
  window.setTimeout(() => initialFocus?.focus(), 0);
}

function closeModal(modal, returnFocus) {
  modal.classList.add("hidden");
  if (editorState.openModal === modal) editorState.openModal = null;
  if (![linkModal, imageModal, previewModal].some((item) => !item.classList.contains("hidden"))) {
    document.body.classList.remove("editor-modal-open");
  }
  if (returnFocus && editorState.modalTrigger) editorState.modalTrigger.focus();
}

function trapModalFocus(event) {
  if (event.key !== "Tab" || event.currentTarget.classList.contains("hidden")) return;
  const focusable = [...event.currentTarget.querySelectorAll('button:not([disabled]):not(.hidden), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleKeyboardShortcuts(event) {
  if (event.key === "Escape" && editorState.openModal) {
    event.preventDefault();
    if (editorState.openModal === linkModal) closeLinkModal(true);
    if (editorState.openModal === imageModal) closeImageModal(true);
    if (editorState.openModal === previewModal) closePreview(true);
    return;
  }

  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier) return;
  const key = event.key.toLowerCase();

  if (key === "s" && (form.contains(document.activeElement) || editorState.openModal)) {
    event.preventDefault();
    if (!editorState.openModal) savePost();
  }

  if (key === "k" && (document.activeElement === editor || editor.contains(document.activeElement))) {
    event.preventDefault();
    captureEditorSelection();
    openLinkModal(document.getElementById("openLinkModal"));
  }
}

function showModalError(id, message) {
  const element = document.getElementById(id);
  element.textContent = message;
  element.classList.remove("hidden");
}

function clearModalError(id) {
  const element = document.getElementById(id);
  element.textContent = "";
  element.classList.add("hidden");
}

function valGet(id) {
  return document.getElementById(id).value.trim();
}

function dynamicUrl(value) {
  return `https://anime.ryuzen.ink/blog/p/${toSlug(value)}/`;
}

function toSlug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function isHttpUrl(value) {
  return !!normalizeHttpUrl(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function showFeedback(message, type) {
  if (window.AdminUI) window.AdminUI.toast(message, type === "error" ? "error" : type);
  feedback.textContent = message; feedback.className = `admin-alert ${type}`; feedback.classList.remove("hidden");
}

function escapeText(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[character]));
}

function escapeAttr(value = "") {
  return escapeText(value);
}
