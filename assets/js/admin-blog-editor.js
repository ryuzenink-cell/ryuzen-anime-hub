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
  featured: false,
  // Autosave / concorrência otimista.
  version: null,
  saving: false,
  offline: false,
  retryCount: 0,
  lastSavedSnapshot: null,
  lastSavedAt: null,
  autosaveTimer: null,
  retryTimer: null
};

const form = document.getElementById("postEditorForm");
const editor = document.getElementById("richEditor");
const title = document.getElementById("postTitle");
const slug = document.getElementById("postSlug");
const canonical = document.getElementById("canonicalUrl");
const feedback = document.getElementById("editorFeedback");
const linkModal = document.getElementById("linkModal");
const imageModal = document.getElementById("imageModal");
const tableModal = document.getElementById("tableModal");
const animeFactsModal = document.getElementById("animeFactsModal");
const whereToWatchModal = document.getElementById("whereToWatchModal");
const noticeModal = document.getElementById("noticeModal");
const relatedArticlesModal = document.getElementById("relatedArticlesModal");
const previewModal = document.getElementById("previewModal");
const removeLinkButton = document.getElementById("removeLink");
const tableContextToolbar = document.getElementById("tableContextToolbar");

const TABLE_MIN_ROWS = 1;
const TABLE_MAX_ROWS = 20;
const TABLE_MIN_COLS = 1;
const TABLE_MAX_COLS = 10;
const SITE_HOSTNAME = "anime.ryuzen.ink";
const RELATED_MAX = 8;
const NOTICE_DEFAULTS = {
  unconfirmed: { label: "Informação não confirmada", message: "Esta informação ainda não foi anunciada oficialmente e pode mudar." },
  rumor: { label: "Baseado em rumor", message: "Este trecho é baseado em rumores e ainda não foi confirmado pelos produtores." },
  subject_to_change: { label: "Sujeito a alteração", message: "Estes detalhes podem ser alterados conforme novas informações forem divulgadas." },
  recently_updated: { label: "Atualizado recentemente", message: "Esta seção foi atualizada recentemente com novas informações." }
};

let relatedSelected = new Map();
let relatedCurrentResults = [];
let relatedSearchTimer = null;

const AUTOSAVE_DEBOUNCE_MS = 2000;
const AUTOSAVE_RETRY_DELAYS_MS = [3000, 8000, 20000];
let saveChain = Promise.resolve(null);

requireAdminSession(initEditor);

async function initEditor() {
  bindEditor();
  setDraftStatus("clean");
  updateWritingStats();
  syncSeoPreview();
  await loadCategories();
  if (editorState.id) await loadPost(editorState.id);
  editorState.lastSavedSnapshot = JSON.stringify(payload());
  await offerLocalDraftRecovery();
  editorState.offline = !navigator.onLine;
  if (editorState.offline) setDraftStatus("offline");
  window.addEventListener("online", handleConnectionRestored);
  window.addEventListener("offline", handleConnectionLost);
}

function handleConnectionLost() {
  editorState.offline = true;
  if (editorState.dirty) setDraftStatus("offline");
}

function handleConnectionRestored() {
  editorState.offline = false;
  if (editorState.dirty) queueSave({ manual: false });
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
  document.getElementById("openTableModal").addEventListener("click", (event) => openTableModal(event.currentTarget));
  document.getElementById("openAnimeFactsModal").addEventListener("click", (event) => openAnimeFactsModal(event.currentTarget));
  document.getElementById("openWhereToWatchModal").addEventListener("click", (event) => openWhereToWatchModal(event.currentTarget));
  document.getElementById("openNoticeModal").addEventListener("click", (event) => openNoticeModal(event.currentTarget));
  document.getElementById("openRelatedArticlesModal").addEventListener("click", (event) => openRelatedArticlesModal(event.currentTarget));
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

  document.getElementById("cancelTable").addEventListener("click", () => closeTableModal(true));
  document.getElementById("tableForm").addEventListener("submit", (event) => {
    event.preventDefault();
    insertTable();
  });
  tableContextToolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-table-action]");
    if (!button || button.disabled) return;
    handleTableAction(button.dataset.tableAction);
  });

  document.getElementById("cancelAnimeFacts").addEventListener("click", () => closeAnimeFactsModal(true));
  document.getElementById("animeFactsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    insertAnimeFacts();
  });

  document.getElementById("cancelWhereToWatch").addEventListener("click", () => closeWhereToWatchModal(true));
  document.getElementById("whereToWatchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    insertWhereToWatch();
  });

  document.getElementById("cancelNotice").addEventListener("click", () => closeNoticeModal(true));
  document.getElementById("noticeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    insertNotice();
  });
  document.getElementById("noticeType").addEventListener("change", (event) => {
    const textarea = document.getElementById("noticeMessage");
    const isCurrentlyADefault = Object.values(NOTICE_DEFAULTS).some((item) => item.message === textarea.value.trim());
    if (!textarea.value.trim() || isCurrentlyADefault) {
      textarea.value = (NOTICE_DEFAULTS[event.target.value] || NOTICE_DEFAULTS.unconfirmed).message;
    }
  });

  document.getElementById("cancelRelatedArticles").addEventListener("click", () => closeRelatedArticlesModal(true));
  document.getElementById("clearRelatedSelection").addEventListener("click", () => {
    relatedSelected = new Map();
    renderRelatedResults(relatedCurrentResults);
    renderRelatedSelected();
  });
  document.getElementById("submitRelatedArticles").addEventListener("click", insertRelatedArticles);
  document.getElementById("relatedSearch").addEventListener("input", (event) => {
    window.clearTimeout(relatedSearchTimer);
    const term = event.target.value.trim();
    relatedSearchTimer = window.setTimeout(() => searchRelatedArticles(term), 300);
  });

  document.getElementById("saveDraft").addEventListener("click", () => savePost());
  document.getElementById("publishPost").addEventListener("click", publishPost);
  document.getElementById("previewPost").addEventListener("click", (event) => showPreview(event.currentTarget));
  document.getElementById("featurePost")?.addEventListener("click", featurePost);
  document.getElementById("closePreview").addEventListener("click", () => closePreview(true));

  editor.addEventListener("input", () => {
    captureEditorSelection();
    updateLinkToolState();
    updateTableToolState();
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
    updateTableToolState();
  });
  editor.addEventListener("keyup", () => {
    captureEditorSelection();
    updateLinkToolState();
    updateTableToolState();
  });
  editor.addEventListener("keydown", handleTableKeydown);

  document.addEventListener("selectionchange", () => {
    if (hasActiveEditorSelection()) {
      captureEditorSelection();
      updateLinkToolState();
      updateTableToolState();
    }
  });
  document.addEventListener("keydown", handleKeyboardShortcuts);

  [linkModal, imageModal, tableModal, animeFactsModal, whereToWatchModal, noticeModal, relatedArticlesModal, previewModal].forEach((modal) => {
    modal.addEventListener("keydown", trapModalFocus);
    modal.addEventListener("mousedown", (event) => {
      if (event.target !== modal) return;
      if (modal === linkModal) closeLinkModal(true);
      if (modal === imageModal) closeImageModal(true);
      if (modal === tableModal) closeTableModal(true);
      if (modal === animeFactsModal) closeAnimeFactsModal(true);
      if (modal === whereToWatchModal) closeWhereToWatchModal(true);
      if (modal === noticeModal) closeNoticeModal(true);
      if (modal === relatedArticlesModal) closeRelatedArticlesModal(true);
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
    editorState.version = Number.isInteger(post.version) ? post.version : null;
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

function applyPayloadToForm(data) {
  title.value = data.title || "";
  slug.value = data.slug || "";
  val("excerpt", data.excerpt);
  val("categoryId", data.category_id || "");
  val("tags", (data.tags || []).join(", "));
  val("coverImageUrl", data.cover_image_url);
  val("coverAlt", data.cover_alt);
  val("coverCredit", data.cover_credit);
  val("coverSourceUrl", data.cover_source_url);
  val("socialImageUrl", data.social_image_url);
  val("seoTitle", data.seo_title);
  val("seoDescription", data.seo_description);
  canonical.value = data.canonical_url || dynamicUrl(slug.value);
  editor.innerHTML = data.content_html || "";
  editorState.slugTouched = true;
  updateWritingStats();
  syncSeoPreview();
  updateLinkToolState();
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

function isInternalUrl(href) {
  try { return new URL(href).hostname === SITE_HOSTNAME; } catch { return false; }
}

function setLinkAttributes(link, href, linkTitle) {
  link.setAttribute("href", href);
  if (linkTitle) link.setAttribute("title", linkTitle);
  else link.removeAttribute("title");
  if (isInternalUrl(href)) {
    link.removeAttribute("target");
    link.removeAttribute("rel");
  } else {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer nofollow");
  }
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

function isEmptyBlock(element) {
  return element.textContent.trim() === "" && !element.querySelector("img,table,a");
}

/**
 * Inserts block-level HTML (figures, tables, lists...) relative to the current caret.
 * execCommand("insertHTML") splits/nests unpredictably when the caret sits inside an
 * existing (possibly empty) paragraph, so block content is positioned explicitly instead:
 * a trailing empty placeholder paragraph is replaced outright, real content gets the new
 * block appended right after it, and a caret inside a table is anchored past the whole table.
 */
function insertBlockAtSelection(html) {
  const range = restoreOrCreateEditorSelection();
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;
  const lastNode = fragment.lastElementChild;
  const container = elementFromNode(range.startContainer);

  const enclosingTable = container?.closest("table");
  if (enclosingTable && editor.contains(enclosingTable)) {
    const anchor = enclosingTable.closest(".article-table-wrapper") || enclosingTable;
    anchor.after(fragment);
  } else {
    const block = container?.closest("p,li,h2,h3,blockquote");
    if (!block || !editor.contains(block) || block === editor) {
      range.deleteContents();
      range.insertNode(fragment);
    } else if (isEmptyBlock(block)) {
      block.replaceWith(fragment);
    } else {
      block.after(fragment);
    }
  }

  editor.focus();
  if (lastNode && editor.contains(lastNode)) placeCaretInCell(lastNode);
  else captureEditorSelection();
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

  const figure = `<figure class="article-figure"><img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async"><figcaption class="article-caption">${caption ? `<span class="caption">${escapeText(caption)}</span>` : ""}${credit ? `<span class="credit">Crédito: ${escapeText(credit)}</span>` : ""}${source ? `<a href="${escapeAttr(source)}" target="_blank" rel="noopener noreferrer nofollow">Fonte oficial</a>` : ""}</figcaption></figure><p><br></p>`;
  insertBlockAtSelection(figure);
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

/* ---------------------------------------------------------------------- */
/* Tabelas editoriais                                                     */
/* ---------------------------------------------------------------------- */

function clampInt(value, min, max, fallback) {
  const number = parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function openTableModal(trigger = document.getElementById("openTableModal")) {
  if (hasActiveEditorSelection()) captureEditorSelection();
  document.getElementById("tableRows").value = "3";
  document.getElementById("tableCols").value = "3";
  document.getElementById("tableHeaderRow").checked = true;
  document.getElementById("tableHeaderCol").checked = false;
  document.getElementById("tableCaption").value = "";
  document.getElementById("tableAlign").value = "left";
  clearModalError("tableFormError");
  openModal(tableModal, document.getElementById("tableRows"), trigger);
}

function closeTableModal(returnFocus = true) {
  closeModal(tableModal, returnFocus);
  document.getElementById("tableForm").reset();
  clearModalError("tableFormError");
}

function alignClassFor(align) {
  if (align === "center") return "align-center";
  if (align === "right") return "align-right";
  return "";
}

function buildTableHtml({ rows, cols, headerRow, headerCol, caption, alignClass }) {
  const cellClass = alignClass ? ` class="${alignClass}"` : "";
  const bodyRowCount = headerRow ? Math.max(rows - 1, 0) : rows;
  let html = '<div class="article-table-wrapper"><table class="article-table">';
  if (caption) html += `<caption>${escapeText(caption)}</caption>`;
  if (headerRow) {
    html += "<thead><tr>";
    for (let c = 0; c < cols; c += 1) html += `<th scope="col"${cellClass}>Coluna ${c + 1}</th>`;
    html += "</tr></thead>";
  }
  if (bodyRowCount > 0) {
    html += "<tbody>";
    for (let r = 0; r < bodyRowCount; r += 1) {
      html += "<tr>";
      for (let c = 0; c < cols; c += 1) {
        html += headerCol && c === 0 ? `<th scope="row"${cellClass}></th>` : `<td${cellClass}></td>`;
      }
      html += "</tr>";
    }
    html += "</tbody>";
  }
  html += "</table></div><p><br></p>";
  return html;
}

function insertTable() {
  clearModalError("tableFormError");
  const rows = clampInt(document.getElementById("tableRows").value, TABLE_MIN_ROWS, TABLE_MAX_ROWS, 3);
  const cols = clampInt(document.getElementById("tableCols").value, TABLE_MIN_COLS, TABLE_MAX_COLS, 3);
  const headerRow = document.getElementById("tableHeaderRow").checked;
  const headerCol = document.getElementById("tableHeaderCol").checked;
  const caption = valGet("tableCaption");
  const alignClass = alignClassFor(document.getElementById("tableAlign").value);

  insertBlockAtSelection(buildTableHtml({ rows, cols, headerRow, headerCol, caption, alignClass }));
  closeTableModal(false);
  captureEditorSelection();
  markDirty();
  updateTableToolState();
}

function findTableCell(range = editorState.selection) {
  if (!range || !rangeBelongsToEditor(range)) return null;
  const node = elementFromNode(range.startContainer);
  const cell = node?.closest ? node.closest("td,th") : null;
  return cell && editor.contains(cell) ? cell : null;
}

function findTable(cell) {
  return cell ? cell.closest("table") : null;
}

function allRows(table) {
  return [...table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr")];
}

function columnAlignClass(table, colIndex) {
  for (const row of allRows(table)) {
    const cell = row.cells[colIndex];
    if (cell?.classList.contains("align-center")) return "align-center";
    if (cell?.classList.contains("align-right")) return "align-right";
  }
  return "";
}

function hasHeaderColumn(table) {
  const firstRow = table.querySelector(":scope > tbody > tr") || table.querySelector(":scope > thead > tr");
  const firstCell = firstRow?.cells[0];
  return !!(firstCell && firstCell.tagName === "TH" && firstCell.getAttribute("scope") === "row");
}

function replaceCellTag(cell, tagName, scope) {
  if (cell.tagName.toLowerCase() === tagName) {
    if (scope) cell.setAttribute("scope", scope); else cell.removeAttribute("scope");
    return cell;
  }
  const replacement = document.createElement(tagName);
  if (cell.className) replacement.className = cell.className;
  if (scope) replacement.setAttribute("scope", scope);
  while (cell.firstChild) replacement.appendChild(cell.firstChild);
  cell.replaceWith(replacement);
  return replacement;
}

function applyHeaderColumn(table, enabled) {
  allRows(table).forEach((row) => {
    if (row.parentElement.tagName === "THEAD") return;
    const cell = row.cells[0];
    if (!cell) return;
    replaceCellTag(cell, enabled ? "th" : "td", enabled ? "row" : null);
  });
}

function placeCaretInCell(cell, selectAll = false) {
  if (!cell) return;
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(cell);
  if (!selectAll) range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  editorState.selection = range.cloneRange();
  updateTableToolState();
}

function addTableRow(table, referenceRow, position) {
  if (referenceRow.parentElement.tagName === "THEAD") return;
  if (allRows(table).length >= TABLE_MAX_ROWS) {
    showFeedback(`Uma tabela pode ter no máximo ${TABLE_MAX_ROWS} linhas.`, "error");
    return;
  }
  const cols = referenceRow.cells.length;
  const headerColEnabled = hasHeaderColumn(table);
  const newRow = document.createElement("tr");
  for (let c = 0; c < cols; c += 1) {
    const cell = document.createElement("td");
    const align = columnAlignClass(table, c);
    if (align) cell.classList.add(align);
    newRow.appendChild(cell);
  }
  referenceRow.parentElement.insertBefore(newRow, position === "before" ? referenceRow : referenceRow.nextSibling);
  applyHeaderColumn(table, headerColEnabled);
  placeCaretInCell(newRow.cells[0]);
}

function deleteTableRow(table, row) {
  if (row.parentElement.tagName === "THEAD") return;
  if (allRows(table).length <= 1) {
    showFeedback("A tabela precisa manter ao menos uma linha.", "error");
    return;
  }
  const tbody = row.parentElement;
  const nextFocusRow = row.nextElementSibling || row.previousElementSibling || table.querySelector(":scope > thead > tr");
  row.remove();
  if (tbody.tagName === "TBODY" && !tbody.children.length) tbody.remove();
  if (nextFocusRow) placeCaretInCell(nextFocusRow.cells[0]); else editor.focus();
}

function addTableColumn(table, colIndex, position) {
  const rows = allRows(table);
  const currentCols = rows[0]?.cells.length || 0;
  if (currentCols >= TABLE_MAX_COLS) {
    showFeedback(`Uma tabela pode ter no máximo ${TABLE_MAX_COLS} colunas.`, "error");
    return;
  }
  const insertIndex = position === "before" ? colIndex : colIndex + 1;
  const headerColEnabled = hasHeaderColumn(table);
  rows.forEach((row) => {
    const isHead = row.parentElement.tagName === "THEAD";
    const cell = document.createElement(isHead ? "th" : "td");
    if (isHead) cell.setAttribute("scope", "col");
    row.insertBefore(cell, row.cells[insertIndex] || null);
  });
  applyHeaderColumn(table, headerColEnabled);
}

function deleteTableColumn(table, colIndex) {
  const rows = allRows(table);
  const currentCols = rows[0]?.cells.length || 0;
  if (currentCols <= 1) {
    showFeedback("A tabela precisa manter ao menos uma coluna.", "error");
    return;
  }
  const headerColEnabled = hasHeaderColumn(table);
  rows.forEach((row) => row.cells[colIndex]?.remove());
  applyHeaderColumn(table, headerColEnabled);
}

function toggleHeaderRow(table) {
  const thead = table.querySelector(":scope > thead");
  if (thead) {
    const theadRow = thead.querySelector("tr");
    let tbody = table.querySelector(":scope > tbody");
    if (!tbody) {
      tbody = document.createElement("tbody");
      table.appendChild(tbody);
    }
    if (theadRow) {
      [...theadRow.cells].forEach((cell) => replaceCellTag(cell, "td", null));
      tbody.insertBefore(theadRow, tbody.firstChild);
    }
    thead.remove();
  } else {
    const firstRow = table.querySelector(":scope > tbody > tr");
    if (!firstRow) return;
    const newThead = document.createElement("thead");
    [...firstRow.cells].forEach((cell) => replaceCellTag(cell, "th", "col"));
    newThead.appendChild(firstRow);
    const caption = table.querySelector(":scope > caption");
    table.insertBefore(newThead, caption ? caption.nextSibling : table.firstChild);
    const tbody = table.querySelector(":scope > tbody");
    if (tbody && !tbody.children.length) tbody.remove();
  }
  applyHeaderColumn(table, hasHeaderColumn(table));
}

function toggleHeaderColumn(table) {
  applyHeaderColumn(table, !hasHeaderColumn(table));
}

function setColumnAlign(table, colIndex, align) {
  allRows(table).forEach((row) => {
    const cell = row.cells[colIndex];
    if (!cell) return;
    cell.classList.remove("align-center", "align-right");
    const cls = alignClassFor(align);
    if (cls) cell.classList.add(cls);
  });
}

function toggleTableCaption(table) {
  const existing = table.querySelector(":scope > caption");
  if (existing) {
    existing.remove();
    return;
  }
  const caption = document.createElement("caption");
  caption.textContent = "Legenda da tabela";
  table.insertBefore(caption, table.firstChild);
  placeCaretInCell(caption, true);
}

async function deleteTable(wrapper) {
  const confirmed = window.AdminUI
    ? await window.AdminUI.confirm("Remover esta tabela do artigo? Essa ação não pode ser desfeita.", { confirmText: "Remover tabela" })
    : window.confirm("Remover esta tabela?");
  if (!confirmed) return;
  wrapper.remove();
  editor.focus();
  markDirty();
  updateTableToolState();
}

function setButtonDisabled(action, disabled) {
  const button = tableContextToolbar.querySelector(`[data-table-action="${action}"]`);
  if (button) button.disabled = disabled;
}

function togglePressed(action, pressed) {
  const button = tableContextToolbar.querySelector(`[data-table-action="${action}"]`);
  if (button) button.setAttribute("aria-pressed", String(pressed));
}

function updateTableToolState() {
  const cell = findTableCell();
  const table = findTable(cell);
  if (!table || !cell) {
    tableContextToolbar.classList.add("hidden");
    return;
  }
  tableContextToolbar.classList.remove("hidden");

  const row = cell.closest("tr");
  const inHead = row.parentElement.tagName === "THEAD";
  const totalRows = allRows(table).length;
  const totalCols = row.cells.length;

  setButtonDisabled("addRowAbove", inHead);
  setButtonDisabled("addRowBelow", inHead);
  setButtonDisabled("deleteRow", inHead || totalRows <= 1);
  setButtonDisabled("deleteColumn", totalCols <= 1);

  togglePressed("toggleHeaderRow", !!table.querySelector(":scope > thead"));
  togglePressed("toggleHeaderColumn", hasHeaderColumn(table));

  const currentAlign = cell.classList.contains("align-center") ? "center" : cell.classList.contains("align-right") ? "right" : "left";
  togglePressed("alignLeft", currentAlign === "left");
  togglePressed("alignCenter", currentAlign === "center");
  togglePressed("alignRight", currentAlign === "right");
  togglePressed("toggleCaption", !!table.querySelector(":scope > caption"));
}

function handleTableAction(action) {
  const cell = findTableCell();
  const table = findTable(cell);
  if (!table || !cell) return;
  const wrapper = table.closest(".article-table-wrapper") || table;
  const row = cell.closest("tr");
  const colIndex = [...row.cells].indexOf(cell);

  if (action === "deleteTable") {
    deleteTable(wrapper);
    return;
  }

  switch (action) {
    case "addRowAbove": addTableRow(table, row, "before"); break;
    case "addRowBelow": addTableRow(table, row, "after"); break;
    case "deleteRow": deleteTableRow(table, row); break;
    case "addColumnLeft": addTableColumn(table, colIndex, "before"); break;
    case "addColumnRight": addTableColumn(table, colIndex, "after"); break;
    case "deleteColumn": deleteTableColumn(table, colIndex); break;
    case "toggleHeaderRow": toggleHeaderRow(table); break;
    case "toggleHeaderColumn": toggleHeaderColumn(table); break;
    case "alignLeft": setColumnAlign(table, colIndex, "left"); break;
    case "alignCenter": setColumnAlign(table, colIndex, "center"); break;
    case "alignRight": setColumnAlign(table, colIndex, "right"); break;
    case "toggleCaption": toggleTableCaption(table); break;
    default: return;
  }
  markDirty();
  updateTableToolState();
}

function handleTableKeydown(event) {
  if (event.key !== "Tab") return;
  const cell = findTableCell();
  if (!cell) return;
  event.preventDefault();
  const table = findTable(cell);
  const cells = [...table.querySelectorAll("th,td")];
  const index = cells.indexOf(cell);

  if (event.shiftKey) {
    if (index > 0) placeCaretInCell(cells[index - 1], true);
    return;
  }
  if (index < cells.length - 1) {
    placeCaretInCell(cells[index + 1], true);
    return;
  }
  const rows = allRows(table);
  if (rows.length >= TABLE_MAX_ROWS) return;
  addTableRow(table, rows[rows.length - 1], "after");
  markDirty();
}

/* ---------------------------------------------------------------------- */
/* Blocos editoriais do RAH (ficha do anime, onde assistir, aviso)         */
/* ---------------------------------------------------------------------- */

function buildFactRows(pairs) {
  return pairs
    .filter(([, value]) => !!String(value || "").trim())
    .map(([label, value]) => `<tr><th scope="row">${escapeText(label)}</th><td>${escapeText(value)}</td></tr>`)
    .join("");
}

function buildFactTableHtml(caption, rowsHtml) {
  const captionHtml = caption ? `<caption>${escapeText(caption)}</caption>` : "";
  return `<div class="article-table-wrapper"><table class="article-table">${captionHtml}<tbody>${rowsHtml}</tbody></table></div><p><br></p>`;
}

function openAnimeFactsModal(trigger = document.getElementById("openAnimeFactsModal")) {
  if (hasActiveEditorSelection()) captureEditorSelection();
  document.getElementById("animeFactsForm").reset();
  document.getElementById("factCaption").value = "Ficha rápida do anime";
  clearModalError("animeFactsFormError");
  openModal(animeFactsModal, document.getElementById("factTitle"), trigger);
}

function closeAnimeFactsModal(returnFocus = true) {
  closeModal(animeFactsModal, returnFocus);
  clearModalError("animeFactsFormError");
}

function insertAnimeFacts() {
  clearModalError("animeFactsFormError");
  const rows = buildFactRows([
    ["Título", valGet("factTitle")],
    ["Título japonês", valGet("factTitleJp")],
    ["Estúdio", valGet("factStudio")],
    ["Diretor", valGet("factDirector")],
    ["Obra original", valGet("factSource")],
    ["Gênero", valGet("factGenre")],
    ["Nº de episódios", valGet("factEpisodes")],
    ["Temporada", valGet("factSeason")],
    ["Ano", valGet("factYear")],
    ["Plataforma", valGet("factPlatform")],
    ["Status", valGet("factStatus")],
    ["Data de estreia", valGet("factPremiere")]
  ]);
  if (!rows) {
    showModalError("animeFactsFormError", "Preencha ao menos um campo da ficha.");
    return;
  }
  insertBlockAtSelection(buildFactTableHtml(valGet("factCaption") || "Ficha rápida do anime", rows));
  closeAnimeFactsModal(false);
  markDirty();
}

function openWhereToWatchModal(trigger = document.getElementById("openWhereToWatchModal")) {
  if (hasActiveEditorSelection()) captureEditorSelection();
  document.getElementById("whereToWatchForm").reset();
  document.getElementById("watchCaption").value = "Onde assistir";
  clearModalError("whereToWatchFormError");
  openModal(whereToWatchModal, document.getElementById("watchPlatform"), trigger);
}

function closeWhereToWatchModal(returnFocus = true) {
  closeModal(whereToWatchModal, returnFocus);
  clearModalError("whereToWatchFormError");
}

function insertWhereToWatch() {
  clearModalError("whereToWatchFormError");
  const linkValue = valGet("watchLink");
  let linkCellHtml = "";
  if (linkValue) {
    const href = normalizeHttpUrl(linkValue);
    if (!href) {
      showModalError("whereToWatchFormError", "O link oficial precisa ser uma URL válida iniciada por http:// ou https://.");
      document.getElementById("watchLink").focus();
      return;
    }
    linkCellHtml = `<tr><th scope="row">Link oficial</th><td><a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">Assistir aqui</a></td></tr>`;
  }
  const rows = buildFactRows([
    ["Plataforma", valGet("watchPlatform")],
    ["Disponibilidade no Brasil", valGet("watchAvailability")],
    ["Dublagem", valGet("watchDub")],
    ["Legendas", valGet("watchSubs")],
    ["Situação atual", valGet("watchStatus")]
  ]) + linkCellHtml;
  if (!rows) {
    showModalError("whereToWatchFormError", "Preencha ao menos um campo do bloco.");
    return;
  }
  insertBlockAtSelection(buildFactTableHtml(valGet("watchCaption") || "Onde assistir", rows));
  closeWhereToWatchModal(false);
  markDirty();
}

function openNoticeModal(trigger = document.getElementById("openNoticeModal")) {
  if (hasActiveEditorSelection()) captureEditorSelection();
  document.getElementById("noticeForm").reset();
  document.getElementById("noticeType").value = "unconfirmed";
  document.getElementById("noticeMessage").value = NOTICE_DEFAULTS.unconfirmed.message;
  clearModalError("noticeFormError");
  openModal(noticeModal, document.getElementById("noticeType"), trigger);
}

function closeNoticeModal(returnFocus = true) {
  closeModal(noticeModal, returnFocus);
  clearModalError("noticeFormError");
}

function insertNotice() {
  clearModalError("noticeFormError");
  const type = document.getElementById("noticeType").value;
  const label = (NOTICE_DEFAULTS[type] || NOTICE_DEFAULTS.unconfirmed).label;
  const message = valGet("noticeMessage");
  if (!message) {
    showModalError("noticeFormError", "Escreva a mensagem do aviso.");
    document.getElementById("noticeMessage").focus();
    return;
  }
  const html = `<blockquote class="callout-notice"><p><strong>${escapeText(label)}:</strong> ${escapeText(message)}</p></blockquote><p><br></p>`;
  insertBlockAtSelection(html);
  closeNoticeModal(false);
  markDirty();
}

/* ---------------------------------------------------------------------- */
/* Artigos relacionados                                                   */
/* ---------------------------------------------------------------------- */

function openRelatedArticlesModal(trigger = document.getElementById("openRelatedArticlesModal")) {
  if (hasActiveEditorSelection()) captureEditorSelection();
  clearModalError("relatedArticlesFormError");
  document.getElementById("relatedSearch").value = "";
  openModal(relatedArticlesModal, document.getElementById("relatedSearch"), trigger);
  loadRelatedSuggestions();
  renderRelatedSelected();
}

function closeRelatedArticlesModal(returnFocus = true) {
  closeModal(relatedArticlesModal, returnFocus);
  clearModalError("relatedArticlesFormError");
}

async function loadRelatedSuggestions() {
  const container = document.getElementById("relatedResults");
  document.getElementById("relatedSuggestLabel").textContent = "Sugestões automáticas";
  container.innerHTML = '<p class="muted">Carregando sugestões...</p>';
  try {
    const categoryId = valGet("categoryId");
    const query = categoryId
      ? `/api/admin/posts?status=published&category=${encodeURIComponent(categoryId)}&order=published_desc&limit=6`
      : `/api/admin/posts?status=published&order=published_desc&limit=6`;
    const data = await adminFetch(query);
    renderRelatedResults(filterOutCurrentPost(data.posts || []));
  } catch (error) {
    container.innerHTML = `<p class="admin-alert error">${escapeText(error.message)}</p>`;
  }
}

async function searchRelatedArticles(term) {
  if (!term) {
    loadRelatedSuggestions();
    return;
  }
  const container = document.getElementById("relatedResults");
  document.getElementById("relatedSuggestLabel").textContent = "Resultados da busca";
  container.innerHTML = '<p class="muted">Buscando...</p>';
  try {
    const data = await adminFetch(`/api/admin/posts?status=published&q=${encodeURIComponent(term)}&limit=8`);
    renderRelatedResults(filterOutCurrentPost(data.posts || []));
  } catch (error) {
    container.innerHTML = `<p class="admin-alert error">${escapeText(error.message)}</p>`;
  }
}

function filterOutCurrentPost(posts) {
  const currentId = editorState.id ? Number(editorState.id) : null;
  return posts.filter((post) => post.id !== currentId);
}

function renderRelatedResults(posts) {
  relatedCurrentResults = posts;
  const container = document.getElementById("relatedResults");
  if (!posts.length) {
    container.innerHTML = '<p class="muted">Nenhum artigo encontrado.</p>';
    return;
  }
  container.innerHTML = posts
    .map((post) => `<button type="button" class="related-article-option" data-related-id="${post.id}" ${relatedSelected.has(post.id) ? "disabled" : ""}>${escapeText(post.title)}</button>`)
    .join("");
  container.querySelectorAll("[data-related-id]").forEach((button) => {
    button.addEventListener("click", () => addRelatedSelection(Number(button.dataset.relatedId)));
  });
}

function addRelatedSelection(id) {
  const post = relatedCurrentResults.find((item) => item.id === id);
  if (!post || relatedSelected.has(id)) return;
  if (relatedSelected.size >= RELATED_MAX) {
    showModalError("relatedArticlesFormError", `Selecione no máximo ${RELATED_MAX} artigos.`);
    return;
  }
  clearModalError("relatedArticlesFormError");
  relatedSelected.set(id, post);
  renderRelatedResults(relatedCurrentResults);
  renderRelatedSelected();
}

function removeRelatedSelection(id) {
  relatedSelected.delete(id);
  renderRelatedResults(relatedCurrentResults);
  renderRelatedSelected();
}

function renderRelatedSelected() {
  const container = document.getElementById("relatedSelected");
  document.getElementById("relatedSelectedCount").textContent = String(relatedSelected.size);
  if (!relatedSelected.size) {
    container.innerHTML = '<p class="muted">Nenhum artigo selecionado ainda.</p>';
    return;
  }
  container.innerHTML = [...relatedSelected.values()]
    .map((post) => `<span class="related-article-chip">${escapeText(post.title)}<button type="button" class="related-article-remove" data-related-remove="${post.id}" aria-label="Remover ${escapeAttr(post.title)} da seleção">×</button></span>`)
    .join("");
  container.querySelectorAll("[data-related-remove]").forEach((button) => {
    button.addEventListener("click", () => removeRelatedSelection(Number(button.dataset.relatedRemove)));
  });
}

function insertRelatedArticles() {
  clearModalError("relatedArticlesFormError");
  if (!relatedSelected.size) {
    showModalError("relatedArticlesFormError", "Selecione ao menos um artigo para inserir o bloco.");
    return;
  }
  const label = document.getElementById("relatedLabel").value || "Leia também";
  const items = [...relatedSelected.values()]
    .map((post) => `<li><a href="${escapeAttr(dynamicUrl(post.slug))}">${escapeText(post.title)}</a></li>`)
    .join("");
  const html = `<p><strong>${escapeText(label)}:</strong></p><ul>${items}</ul><p><br></p>`;
  insertBlockAtSelection(html);
  closeRelatedArticlesModal(false);
  markDirty();
  relatedSelected = new Map();
  renderRelatedSelected();
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

/* ---------------------------------------------------------------------- */
/* Salvamento automático, fila serializada e concorrência otimista        */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* Camada de segurança local (localStorage) contra perda de conteúdo      */
/* O D1 continua sendo a fonte oficial; o localStorage só existe para     */
/* recuperar texto que ainda não chegou a ser confirmado pelo servidor.   */
/* ---------------------------------------------------------------------- */

const LOCAL_DRAFT_SCHEMA_VERSION = 1;

function localDraftKey() {
  return editorState.id ? `ryuzen_admin_draft_${editorState.id}` : "ryuzen_admin_draft_new";
}

function persistLocalDraft() {
  try {
    const snapshot = { schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION, payload: payload(), version: editorState.version, savedAt: Date.now() };
    window.localStorage.setItem(localDraftKey(), JSON.stringify(snapshot));
  } catch {
    // localStorage indisponível (modo privado, quota excedida etc.) — o autosave remoto continua sendo a proteção principal.
  }
}

function clearLocalDraft() {
  try { window.localStorage.removeItem(localDraftKey()); } catch { /* ignore */ }
}

function readLocalDraft() {
  try {
    const raw = window.localStorage.getItem(localDraftKey());
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.schemaVersion !== LOCAL_DRAFT_SCHEMA_VERSION || !data.payload) return null;
    return data;
  } catch {
    return null;
  }
}

async function offerLocalDraftRecovery() {
  const local = readLocalDraft();
  if (!local) return;
  const localSnapshot = JSON.stringify(local.payload);
  if (localSnapshot === editorState.lastSavedSnapshot) {
    clearLocalDraft();
    return;
  }
  const restore = window.AdminUI
    ? await window.AdminUI.confirm("Encontramos, neste dispositivo, um rascunho com alterações que não chegaram a ser confirmadas pelo servidor. Deseja restaurá-lo?", { confirmText: "Restaurar rascunho local", variant: "primary" })
    : window.confirm("Encontramos um rascunho local não confirmado pelo servidor. Restaurar?");
  if (!restore) {
    clearLocalDraft();
    return;
  }
  applyPayloadToForm(local.payload);
  markDirty();
  showFeedback("Rascunho local restaurado. Ele será salvo automaticamente em instantes.", "success");
}

function scheduleAutosave() {
  window.clearTimeout(editorState.autosaveTimer);
  if (editorState.offline) return;
  editorState.autosaveTimer = window.setTimeout(() => queueSave({ manual: false }), AUTOSAVE_DEBOUNCE_MS);
}

function stopAutosaveTimers() {
  window.clearTimeout(editorState.autosaveTimer);
  window.clearTimeout(editorState.retryTimer);
}

/**
 * Serializa TODAS as tentativas de salvar (autosave, botão manual e publicação)
 * numa única corrente de promises. Isso impede que duas requisições de criação
 * concorrentes gerem dois rascunhos: a segunda chamada só executa depois que a
 * primeira já concluiu e `editorState.id` já foi preenchido, então ela vira um
 * PUT em vez de um novo POST.
 */
function queueSave(options = {}) {
  saveChain = saveChain.then(() => runSave(options)).catch((error) => {
    console.error("Falha inesperada na fila de salvamento:", error);
    return editorState.id ? Number(editorState.id) : null;
  });
  return saveChain;
}

function isNetworkError(error) {
  return !navigator.onLine || error?.code === "NETWORK_ERROR" || error?.status === undefined;
}

async function runSave({ manual = false, publishing = false } = {}) {
  if (editorState.offline) {
    setDraftStatus("offline");
    return editorState.id ? Number(editorState.id) : null;
  }
  const currentPayload = payload();
  const snapshot = JSON.stringify(currentPayload);
  if (!manual && !publishing && snapshot === editorState.lastSavedSnapshot) {
    return editorState.id ? Number(editorState.id) : null;
  }

  editorState.saving = true;
  setDraftStatus("saving");
  updateSaveControlsDisabled();
  try {
    const method = editorState.id ? "PUT" : "POST";
    const url = editorState.id ? `/api/admin/posts/${editorState.id}` : "/api/admin/posts";
    const requestBody = editorState.id ? { ...currentPayload, version: editorState.version } : currentPayload;
    const result = await adminFetch(url, { method, body: JSON.stringify(requestBody), keepalive: true });
    if (!editorState.id) {
      editorState.id = result.id;
      history.replaceState({}, "", `/admin/blog/editar/?id=${result.id}`);
    }
    if (typeof result.version === "number") editorState.version = result.version;
    editorState.lastSavedSnapshot = snapshot;
    editorState.dirty = false;
    editorState.retryCount = 0;
    editorState.lastSavedAt = new Date();
    clearLocalDraft();
    setDraftStatus("saved", editorState.lastSavedAt);
    if (manual) showFeedback("Rascunho salvo com sucesso.", "success");
    if (editorState.id) await loadRevisions();
    return editorState.id;
  } catch (error) {
    return handleSaveFailure(error, manual);
  } finally {
    editorState.saving = false;
    updateSaveControlsDisabled();
  }
}

function handleSaveFailure(error, manual) {
  persistLocalDraft();
  if (error.code === "VERSION_CONFLICT") {
    stopAutosaveTimers();
    setDraftStatus("conflict");
    showFeedback(error.message, "error");
    return editorState.id ? Number(editorState.id) : null;
  }
  if (error.code === "SESSION_EXPIRED") {
    // adminFetch já redireciona para o login; nada mais a fazer aqui além de preservar o rascunho local (já feito acima).
    return editorState.id ? Number(editorState.id) : null;
  }
  if (isNetworkError(error)) {
    setDraftStatus(editorState.offline ? "offline" : "retrying");
    scheduleRetry();
    if (manual) showFeedback("Sua conexão foi interrompida. As alterações continuam neste dispositivo e serão salvas quando a conexão retornar.", "error");
    return editorState.id ? Number(editorState.id) : null;
  }
  setDraftStatus("error");
  showFeedback(buildErrorMessage(error), "error");
  return null;
}

function buildErrorMessage(error) {
  const suffix = error.errorId ? ` (código ${error.code || "SAVE_FAILED"}-${error.errorId})` : "";
  return `${error.message}${suffix}`;
}

function scheduleRetry() {
  window.clearTimeout(editorState.retryTimer);
  const delay = AUTOSAVE_RETRY_DELAYS_MS[Math.min(editorState.retryCount, AUTOSAVE_RETRY_DELAYS_MS.length - 1)];
  editorState.retryCount += 1;
  editorState.retryTimer = window.setTimeout(() => {
    if (!editorState.offline && editorState.dirty) queueSave({ manual: false });
  }, delay);
}

function updateSaveControlsDisabled() {
  const saveButton = document.getElementById("saveDraft");
  const publishButton = document.getElementById("publishPost");
  if (saveButton) saveButton.disabled = editorState.saving;
  if (publishButton) publishButton.disabled = editorState.saving;
}

async function savePost() {
  return queueSave({ manual: true });
}

async function publishPost() {
  const blocking = getSeoChecks().filter((item) => item.level === "block");
  if (blocking.length) {
    showFeedback(`Corrija antes de publicar: ${blocking.map((item) => item.label).join("; ")}.`, "error");
    return;
  }
  const publishButton = document.getElementById("publishPost");
  if (publishButton?.disabled) return; // clique duplo enquanto a publicação já está em andamento
  if (publishButton) publishButton.disabled = true;
  try {
    // Aguarda qualquer salvamento automático pendente e força uma última gravação com o conteúdo mais recente.
    const id = await queueSave({ manual: true, publishing: true });
    if (!id) return;
    const confirmed = window.AdminUI
      ? await window.AdminUI.confirm("Publicar o artigo agora?", { confirmText: "Publicar", variant: "primary" })
      : window.confirm("Publicar o artigo agora?");
    if (!confirmed) return;
    if (publishButton) publishButton.disabled = true;
    const result = await adminFetch(`/api/admin/posts/${id}/publish`, { method: "POST" });
    editorState.dirty = false;
    setDraftStatus("saved", new Date());
    editorState.status = "published"; updateFeaturedControl();
    showFeedback(`Artigo publicado. URL: ${result.url}`, "success");
  } catch (error) {
    setDraftStatus("error");
    showFeedback(buildErrorMessage(error), "error");
  } finally {
    if (publishButton) publishButton.disabled = editorState.saving;
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
  const hasTable = !!editor.querySelector("table");
  return [
    { label: "Título preenchido", ok: !!body.title, level: !body.title ? "block" : "ok" },
    { label: "Slug válido", ok: !!body.slug, level: !body.slug ? "block" : "ok" },
    { label: "Resumo preenchido", ok: !!body.excerpt, level: !body.excerpt ? "block" : "ok" },
    { label: "Conteúdo preenchido", ok: !!plain || images.length > 0 || hasTable, level: (!plain && !images.length && !hasTable) ? "block" : "ok" },
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
  setDraftStatus(editorState.offline ? "offline" : "dirty");
  updateWritingStats();
  syncSeoPreview();
  persistLocalDraft();
  scheduleAutosave();
}

function formatTime(date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function setDraftStatus(status, timestamp) {
  const statusElement = document.getElementById("draftStatus");
  const labels = {
    clean: "Sem alterações pendentes",
    dirty: "Alterações não salvas",
    saving: "Salvando…",
    saved: timestamp ? `Salvo às ${formatTime(timestamp)}` : "Rascunho salvo",
    offline: "Sem conexão — as alterações continuam salvas neste dispositivo",
    retrying: "Sem conexão — tentando salvar novamente…",
    conflict: "Versão desatualizada — recarregue a página para continuar",
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
  const allModals = [linkModal, imageModal, tableModal, animeFactsModal, whereToWatchModal, noticeModal, relatedArticlesModal, previewModal];
  if (!allModals.some((item) => !item.classList.contains("hidden"))) {
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
    if (editorState.openModal === tableModal) closeTableModal(true);
    if (editorState.openModal === animeFactsModal) closeAnimeFactsModal(true);
    if (editorState.openModal === whereToWatchModal) closeWhereToWatchModal(true);
    if (editorState.openModal === noticeModal) closeNoticeModal(true);
    if (editorState.openModal === relatedArticlesModal) closeRelatedArticlesModal(true);
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
