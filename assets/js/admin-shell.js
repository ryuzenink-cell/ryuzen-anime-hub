(function () {
  "use strict";
  const section = document.body.dataset.adminSection || "dashboard";
  const nav = document.querySelector("[data-admin-nav]");
  if (!nav) return;
  const items = [
    ["dashboard", "/admin/", "Dashboard", "⌂"], ["posts", "/admin/blog/", "Posts", "▤"], ["new-post", "/admin/blog/novo/", "Novo post", "+"],
    ["taxonomies", "/admin/taxonomias/", "Categorias e Tags", "#"], ["banners", "/admin/banners/", "Banners", "▧"], ["store", "/admin/loja/", "Loja", "◈"],
    ["security", "/admin/seguranca/", "Segurança e Auditoria", "◉"]
  ];
  const item = (key, href, label, icon) => `<a class="${section === key ? "active" : ""}" href="${href}" title="${label}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${label}</span></a>`;
  nav.className = "admin-sidebar";
  nav.innerHTML = `<a class="admin-brand" href="/admin/" title="Ryuzen Admin"><img src="/assets/icons/logo-placeholder.png" alt=""><div class="nav-label"><strong>RYUZEN ADMIN</strong><small>Central Operacional</small></div></a>
    <button class="admin-collapse" type="button" data-admin-collapse aria-label="Recolher menu" aria-expanded="true">‹</button>
    <p class="admin-nav-section">Visão Geral</p><nav class="admin-nav">${item(...items[0])}</nav>
    <p class="admin-nav-section">Editorial</p><nav class="admin-nav">${item(...items[1])}${item(...items[2])}</nav>
    <p class="admin-nav-section">Organização</p><nav class="admin-nav">${item(...items[3])}</nav>
    <p class="admin-nav-section">Promoção</p><nav class="admin-nav">${item(...items[4])}${item(...items[5])}</nav>
    <p class="admin-nav-section">Sistema</p><nav class="admin-nav">${item(...items[6])}</nav>
    <div class="admin-sidebar-footer"><nav class="admin-nav"><a href="/" target="_blank" rel="noopener" title="Ver site público"><span class="nav-icon" aria-hidden="true">↗</span><span class="nav-label">Ver site público</span></a><button id="adminLogout" type="button" title="Sair"><span class="nav-icon" aria-hidden="true">⇥</span><span class="nav-label">Sair</span></button></nav></div>`;

  const content = document.querySelector(".admin-content");
  if (content && !content.querySelector(".admin-global-search")) {
    const search = document.createElement("div");
    search.className = "admin-global-search";
    search.innerHTML = `<label class="sr-only" for="adminGlobalSearch">Buscar no painel</label><input id="adminGlobalSearch" class="field" type="search" autocomplete="off" placeholder="Buscar no painel..." aria-controls="adminGlobalResults" aria-expanded="false"><div id="adminGlobalResults" class="admin-search-results hidden" role="listbox"></div>`;
    content.prepend(search); bindSearch(search);
  }
  const setCollapsed = (collapsed) => {
    document.body.classList.toggle("admin-sidebar-collapsed", collapsed);
    const button = nav.querySelector("[data-admin-collapse]");
    button.setAttribute("aria-expanded", String(!collapsed)); button.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu"); button.textContent = collapsed ? "›" : "‹";
    try { localStorage.setItem("ryuzen_admin_sidebar_collapsed", collapsed ? "1" : "0"); } catch {}
  };
  try { setCollapsed(localStorage.getItem("ryuzen_admin_sidebar_collapsed") === "1"); } catch { setCollapsed(false); }
  nav.querySelector("[data-admin-collapse]")?.addEventListener("click", () => setCollapsed(!document.body.classList.contains("admin-sidebar-collapsed")));
  document.getElementById("adminLogout")?.addEventListener("click", logoutAdmin);
  document.querySelector("[data-admin-menu]")?.addEventListener("click", () => document.body.classList.toggle("admin-menu-open"));
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => document.body.classList.remove("admin-menu-open")));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.body.classList.remove("admin-menu-open"); });

  function bindSearch(root) {
    const input = root.querySelector("input"); const results = root.querySelector("#adminGlobalResults"); let timer = 0; let active = -1;
    input.addEventListener("input", () => { clearTimeout(timer); const q = input.value.trim(); if (q.length < 2) { close(); return; } timer = setTimeout(async () => { try { const data = await adminFetch(`/api/admin/search?q=${encodeURIComponent(q)}`); render(data.results || []); } catch { close(); } }, 240); });
    input.addEventListener("keydown", (event) => { const links = [...results.querySelectorAll("a")]; if (!links.length) return; if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); active = event.key === "ArrowDown" ? Math.min(links.length - 1, active + 1) : Math.max(0, active - 1); links[active].focus(); } if (event.key === "Escape") close(); });
    document.addEventListener("click", (event) => { if (!root.contains(event.target)) close(); });
    function close() { results.classList.add("hidden"); results.innerHTML = ""; input.setAttribute("aria-expanded", "false"); active = -1; }
    function render(groups) { if (!groups.length) { results.innerHTML = '<p class="admin-empty">Nenhum resultado encontrado.</p>'; } else { results.innerHTML = groups.map((group) => `<section><strong>${escapeHtml(group.label)}</strong>${group.items.map((result) => `<a href="${escapeHtml(result.url)}"><span>${escapeHtml(result.title)}</span><small>${escapeHtml(result.meta || "Abrir")}</small></a>`).join("")}</section>`).join(""); } results.classList.remove("hidden"); input.setAttribute("aria-expanded", "true"); }
  }
  function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character])); }
})();
