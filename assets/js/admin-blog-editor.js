const editorState = { id: new URLSearchParams(location.search).get("id"), dirty: false, slugTouched: false, selection: null };
const form = document.getElementById("postEditorForm");
const editor = document.getElementById("richEditor");
const title = document.getElementById("postTitle");
const slug = document.getElementById("postSlug");
const canonical = document.getElementById("canonicalUrl");
const feedback = document.getElementById("editorFeedback");
requireAdminSession(initEditor);
document.getElementById("adminLogout")?.addEventListener("click", () => { clearAdminToken(); location.href = "/admin/blog/"; });
function initEditor() { loadCategories(); bindEditor(); if (editorState.id) loadPost(editorState.id); }
function bindEditor() {
  form.addEventListener("input", () => { editorState.dirty = true; syncSeoPreview(); });
  title.addEventListener("input", () => { if (!editorState.slugTouched) { slug.value = toSlug(title.value); canonical.value = dynamicUrl(slug.value); } });
  slug.addEventListener("input", () => { editorState.slugTouched = true; slug.value = toSlug(slug.value); canonical.value = dynamicUrl(slug.value); });
  document.querySelectorAll("[data-command]").forEach((button) => button.addEventListener("click", () => applyFormat(button.dataset.command, button.dataset.value)));
  document.getElementById("openImageModal").addEventListener("click", openImageModal);
  document.getElementById("cancelImage").addEventListener("click", closeImageModal);
  document.getElementById("insertImage").addEventListener("click", insertImage);
  document.getElementById("imageForm").addEventListener("submit", (event) => event.preventDefault());
  document.getElementById("saveDraft").addEventListener("click", () => savePost(false));
  document.getElementById("publishPost").addEventListener("click", async () => { const id = await savePost(false); if (id && confirm("Publicar o artigo agora?")) { try { const result = await adminFetch(`/api/admin/posts/${id}/publish`, { method: "POST" }); editorState.dirty = false; showFeedback(`Artigo publicado. URL: ${result.url}`, "success"); } catch (error) { showFeedback(error.message, "error"); } } });
  document.getElementById("previewPost").addEventListener("click", showPreview);
  editor.addEventListener("paste", (event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); });
  editor.addEventListener("drop", (event) => { event.preventDefault(); showFeedback("Use o botão Imagem para inserir mídia com URL e texto alternativo.", "error"); });
  window.addEventListener("beforeunload", (event) => { if (editorState.dirty) { event.preventDefault(); event.returnValue = ""; } });
}
async function loadCategories() { try { const data = await fetch("/api/categories").then((response) => response.json()); const select = document.getElementById("categoryId"); (data.categories || []).forEach((cat) => select.insertAdjacentHTML("beforeend", `<option value="${cat.id}">${escapeText(cat.name)}</option>`)); } catch { showFeedback("Não foi possível carregar categorias.", "error"); } }
async function loadPost(id) { try { const { post } = await adminFetch(`/api/admin/posts/${id}`); title.value=post.title||""; slug.value=post.slug||""; document.getElementById("excerpt").value=post.excerpt||""; document.getElementById("categoryId").value=post.category_id||""; document.getElementById("tags").value=(post.tags||[]).join(", "); document.getElementById("coverImageUrl").value=post.cover_image_url||""; document.getElementById("coverAlt").value=post.cover_alt||""; document.getElementById("coverCredit").value=post.cover_credit||""; document.getElementById("coverSourceUrl").value=post.cover_source_url||""; document.getElementById("socialImageUrl").value=post.social_image_url||""; document.getElementById("seoTitle").value=post.seo_title||""; document.getElementById("seoDescription").value=post.seo_description||""; canonical.value=post.canonical_url||dynamicUrl(post.slug); editor.innerHTML=post.content_html||""; editorState.slugTouched=true; editorState.dirty=false; syncSeoPreview(); } catch(error) { showFeedback(error.message,"error"); } }
function applyFormat(command, value) {
  editor.focus();
  if (command === "createLink") {
    const href = window.prompt("Informe a URL completa do link (https://...):", "https://");
    if (!href) return;
    if (!isHttpUrl(href)) { alert("Use uma URL http/https válida."); return; }
    document.execCommand("createLink", false, href);
  } else if (command === "formatBlock") document.execCommand(command, false, value);
  else document.execCommand(command, false, null);
  editorState.dirty=true;
}
function openImageModal() {
  const selection = window.getSelection();
  editorState.selection = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  document.getElementById("imageModal").classList.remove("hidden");
}
function closeImageModal() { document.getElementById("imageModal").classList.add("hidden"); document.getElementById("imageForm").reset(); }
function insertImage() { const url=document.getElementById("inlineImageUrl").value.trim(); const alt=document.getElementById("inlineImageAlt").value.trim(); const caption=document.getElementById("inlineImageCaption").value.trim(); const credit=document.getElementById("inlineImageCredit").value.trim(); const source=document.getElementById("inlineImageSource").value.trim(); if (!isHttpUrl(url) || !alt) { alert("Informe uma URL http/https válida e o texto alternativo."); return; } if (source && !isHttpUrl(source)) { alert("A fonte precisa ser uma URL válida."); return; } if (editorState.selection) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(editorState.selection); } const figure=`<figure class="article-figure"><img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async"><figcaption class="article-caption">${caption ? `<span class="caption">${escapeText(caption)}</span>` : ""}${credit ? `<span class="credit">Crédito: ${escapeText(credit)}</span>` : ""}${source ? `<a href="${escapeAttr(source)}" target="_blank" rel="noopener noreferrer nofollow">Fonte oficial</a>` : ""}</figcaption></figure><p><br></p>`; editor.focus(); document.execCommand("insertHTML", false, figure); editorState.dirty=true; closeImageModal(); }
function collectImages() { return [...editor.querySelectorAll("figure.article-figure")].map((figure, index) => ({ image_url: figure.querySelector("img")?.src || "", alt_text: figure.querySelector("img")?.alt || "", caption: figure.querySelector(".caption")?.textContent || "", credit_text: (figure.querySelector(".credit")?.textContent || "").replace(/^Crédito:\s*/, ""), source_url: figure.querySelector("a")?.href || "", placement: "inline", position_order: index })); }
function payload() { return { title:title.value.trim(), slug:slug.value.trim(), excerpt:document.getElementById("excerpt").value.trim(), content_html:editor.innerHTML, category_id:document.getElementById("categoryId").value||null, tags:document.getElementById("tags").value.split(",").map((x)=>x.trim()).filter(Boolean), cover_image_url:document.getElementById("coverImageUrl").value.trim(), cover_alt:document.getElementById("coverAlt").value.trim(), cover_credit:document.getElementById("coverCredit").value.trim(), cover_source_url:document.getElementById("coverSourceUrl").value.trim(), social_image_url:document.getElementById("socialImageUrl").value.trim(), seo_title:document.getElementById("seoTitle").value.trim(), seo_description:document.getElementById("seoDescription").value.trim(), canonical_url:canonical.value.trim(), images:collectImages() }; }
async function savePost() { try { const body=payload(); const method=editorState.id ? "PUT" : "POST"; const url=editorState.id ? `/api/admin/posts/${editorState.id}` : "/api/admin/posts"; const result=await adminFetch(url,{method,body:JSON.stringify(body)}); if (!editorState.id) { editorState.id=result.id; history.replaceState({}, "", `/admin/blog/editar/?id=${result.id}`); } editorState.dirty=false; showFeedback("Rascunho salvo com sucesso.","success"); return editorState.id; } catch(error) { showFeedback(error.message,"error"); return null; } }
function showPreview() { const body=payload(); const preview=document.getElementById("previewCanvas"); preview.innerHTML=`<header class="blog-article-header"><p class="eyebrow">Prévia editorial</p><h1>${escapeText(body.title||"Título do artigo")}</h1><p>${escapeText(body.excerpt||"Resumo do artigo")}</p></header>${body.cover_image_url ? `<img class="blog-article-cover" src="${escapeAttr(body.cover_image_url)}" alt="${escapeAttr(body.cover_alt)}">` : ""}<div class="blog-content">${editor.innerHTML}</div>`; document.getElementById("previewModal").classList.remove("hidden"); }
document.getElementById("closePreview")?.addEventListener("click", () => document.getElementById("previewModal").classList.add("hidden"));
function syncSeoPreview() { document.getElementById("seoPreviewTitle").textContent=document.getElementById("seoTitle").value||title.value||"Título do artigo"; document.getElementById("seoPreviewUrl").textContent=canonical.value||dynamicUrl(slug.value||"slug-do-post"); document.getElementById("seoPreviewDescription").textContent=document.getElementById("seoDescription").value||document.getElementById("excerpt").value||"Descrição exibida nos mecanismos de pesquisa."; }
function dynamicUrl(value){ return `https://anime.ryuzen.ink/blog/p/${toSlug(value)}/`; }
function toSlug(value){ return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,""); }
function isHttpUrl(value){ try { return ["http:","https:"].includes(new URL(value).protocol); } catch { return false; } }
function showFeedback(message,type){ feedback.textContent=message; feedback.className=`admin-alert ${type}`; feedback.classList.remove("hidden"); }
function escapeText(value=""){ return String(value).replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(value=""){ return escapeText(value); }
