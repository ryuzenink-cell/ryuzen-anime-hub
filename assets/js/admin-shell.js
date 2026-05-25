(function () {
  const section = document.body.dataset.adminSection || "dashboard";
  const nav = document.querySelector("[data-admin-nav]");
  if (!nav) return;
  const item = (key, href, label) => `<a class="${section === key ? "active" : ""}" href="${href}"><span class="nav-dot"></span>${label}</a>`;
  nav.className = "admin-sidebar";
  nav.innerHTML = `<a class="admin-brand" href="/admin/"><img src="/assets/icons/logo-placeholder.png" alt=""><div><strong>RYUZEN ADMIN</strong><small>Central Operacional</small></div></a>
    <p class="admin-nav-section">Visão geral</p><nav class="admin-nav">${item("dashboard", "/admin/", "Dashboard")}</nav>
    <p class="admin-nav-section">Editorial</p><nav class="admin-nav">${item("posts", "/admin/blog/", "Posts")}${item("new-post", "/admin/blog/novo/", "Novo post")}</nav>
    <p class="admin-nav-section">Organização</p><nav class="admin-nav">${item("taxonomies", "/admin/taxonomias/", "Categorias e Tags")}</nav>
    <p class="admin-nav-section">Promoção</p><nav class="admin-nav">${item("banners", "/admin/banners/", "Banners")}</nav>
    <p class="admin-nav-section">Sistema</p><nav class="admin-nav">${item("security", "/admin/seguranca/", "Segurança e Auditoria")}</nav>
    <div class="admin-sidebar-footer"><nav class="admin-nav"><a href="/" target="_blank" rel="noopener"><span class="nav-dot"></span>Ver site público</a><button id="adminLogout" type="button"><span class="nav-dot"></span>Sair</button></nav></div>`;
  document.getElementById("adminLogout")?.addEventListener("click", logoutAdmin);
  document.querySelector("[data-admin-menu]")?.addEventListener("click", () => document.body.classList.toggle("admin-menu-open"));
})();
