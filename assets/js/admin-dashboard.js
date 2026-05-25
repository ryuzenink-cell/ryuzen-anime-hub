requireAdminSession(loadDashboard);
async function loadDashboard() {
  try {
    const data = await adminFetch("/api/admin/dashboard");
    const stats = [
      ["Posts CMS publicados", data.counts.published || 0, `${data.legacyStaticPosts} artigos legados estáticos`],
      ["Rascunhos", data.counts.draft || 0, "Aguardando revisão"],
      ["Arquivados", data.counts.archived || 0, "Fora do blog público"],
      ["Categorias", data.categories || 0, "Taxonomias cadastradas"],
      ["Banners ativos", data.activeBanners || 0, "Substituições públicas"],
      ["Último login", data.lastLoginAt ? formatDate(data.lastLoginAt) : "—", "Acesso administrativo"],
    ];
    document.getElementById("dashboardStats").innerHTML = stats.map(([label,value,note]) => `<article class="admin-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join("");
    document.getElementById("dashboardLatest").innerHTML = data.lastPublication ? `<h3>${esc(data.lastPublication.title)}</h3><p>Publicado em ${esc(formatDate(data.lastPublication.published_at))}</p><a class="btn ghost" href="/blog/p/${esc(data.lastPublication.slug)}/" target="_blank" rel="noopener">Abrir artigo</a>` : `<p class="muted">Nenhum post dinâmico publicado ainda.</p>`;
    document.getElementById("dashboardActivity").innerHTML = data.activity.length ? data.activity.map(renderEvent).join("") : `<p class="muted">Nenhuma atividade registrada.</p>`;
  } catch (error) { document.getElementById("dashboardActivity").innerHTML = `<p class="admin-alert error">${esc(error.message)}</p>`; }
}
function renderEvent(item) { const labels={"auth.login_success":"Login administrativo","auth.logout":"Logout","post.create_draft":"Rascunho criado","post.update":"Post editado","post.publish":"Post publicado","post.archive":"Post arquivado","post.duplicate":"Post duplicado","category.create":"Categoria criada","category.update":"Categoria editada","tag.create":"Tag criada","tag.update":"Tag editada","banner.create":"Banner criado","banner.update":"Banner editado","banner.activate":"Banner ativado","banner.archive":"Banner arquivado"}; let meta=""; try { const d=JSON.parse(item.metadata_json || "{}"); meta=d.name || d.slug || ""; } catch {} return `<div class="activity-item"><time>${esc(formatDate(item.created_at))}</time><div><strong>${esc(labels[item.action] || item.action)}</strong><p>${esc(meta || item.resource_type || "Sistema")}</p></div></div>`; }
function formatDate(value) { if(!value) return "—"; return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(String(value).includes("T")? value : `${value.replace(" ","T")}Z`)); }
function esc(v="") { return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
