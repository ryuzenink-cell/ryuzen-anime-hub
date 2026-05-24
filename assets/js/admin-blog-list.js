const adminListState = { status: "", query: "" };
const postsTable = document.getElementById("adminPostsTable");
const statusButtons = document.querySelectorAll("[data-status-filter]");
const searchInput = document.getElementById("adminPostSearch");
requireAdminSession(loadAdminPosts);
document.getElementById("adminLogout")?.addEventListener("click", logoutAdmin);
statusButtons.forEach((button) => button.addEventListener("click", () => { adminListState.status = button.dataset.statusFilter; statusButtons.forEach((b) => b.classList.toggle("active", b === button)); loadAdminPosts(); }));
searchInput?.addEventListener("input", () => { adminListState.query = searchInput.value.trim(); loadAdminPosts(); });
async function loadAdminPosts() {
  postsTable.innerHTML = `<div class="admin-empty">Carregando publicações...</div>`;
  try {
    const query = new URLSearchParams({ q: adminListState.query, status: adminListState.status });
    const result = await adminFetch(`/api/admin/posts?${query}`);
    renderRows(result.posts || []);
  } catch (error) { postsTable.innerHTML = `<div class="admin-alert error">${escapeAdmin(error.message)}</div>`; }
}
function renderRows(posts) {
  if (!posts.length) { postsTable.innerHTML = `<div class="admin-empty"><h3>Nenhuma publicação encontrada</h3><p>Crie um novo artigo para começar a alimentar o editorial.</p><a class="btn primary" href="/admin/blog/novo/">Novo post</a></div>`; return; }
  postsTable.innerHTML = `<div class="admin-post-table"><div class="admin-post-row header"><span>Título</span><span>Status</span><span>Categoria</span><span>Atualização</span><span>Ações</span></div>${posts.map((post) => `<article class="admin-post-row"><div><strong>${escapeAdmin(post.title)}</strong><small>/${escapeAdmin(post.slug)}</small></div><span class="status-pill ${escapeAdmin(post.status)}">${statusLabel(post.status)}</span><span>${escapeAdmin(post.category_name || "Sem categoria")}</span><span>${formatAdminDate(post.updated_at)}</span><div class="row-actions"><a class="btn ghost small" href="/admin/blog/editar/?id=${post.id}">Editar</a>${post.status === "published" ? `<a class="btn ghost small" href="/blog/p/${escapeAdmin(post.slug)}/" target="_blank" rel="noopener">Ver</a>` : `<button class="btn primary small" data-publish="${post.id}">Publicar</button>`}<button class="btn danger small" data-archive="${post.id}">Arquivar</button></div></article>`).join("")}</div>`;
  postsTable.querySelectorAll("[data-publish]").forEach((button) => button.addEventListener("click", () => updateStatus(button.dataset.publish, "publish")));
  postsTable.querySelectorAll("[data-archive]").forEach((button) => button.addEventListener("click", () => updateStatus(button.dataset.archive, "archive")));
}
async function updateStatus(id, action) { if (!confirm(action === "publish" ? "Publicar este artigo agora?" : "Arquivar este artigo?")) return; try { await adminFetch(`/api/admin/posts/${id}/${action}`, { method: "POST" }); loadAdminPosts(); } catch (error) { alert(error.message); } }
function statusLabel(status) { return ({draft:"Rascunho",published:"Publicado",archived:"Arquivado",scheduled:"Agendado"})[status] || status; }
function formatAdminDate(value) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value + (value.includes("Z") ? "" : "Z"))) : "—"; }
function escapeAdmin(value="") { return String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
