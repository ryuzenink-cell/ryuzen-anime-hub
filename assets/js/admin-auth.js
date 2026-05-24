const adminSessionState = { csrfToken: "", authenticated: false };

async function sessionRequest() {
  const response = await fetch("/api/auth/session", { credentials: "same-origin", headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.authenticated) throw new Error("Sessão expirada.");
  adminSessionState.csrfToken = data.csrfToken || "";
  adminSessionState.authenticated = true;
  document.querySelectorAll("[data-admin-name]").forEach((element) => { element.textContent = data.displayName || "Administrador"; });
  return data;
}
async function adminFetch(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) headers["X-CSRF-Token"] = adminSessionState.csrfToken;
  const response = await fetch(url, { ...options, method, headers, credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign(`/admin/login/?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new Error("Sua sessão expirou. Faça login novamente.");
  }
  if (!response.ok) throw new Error(body.error || "Falha na operação.");
  return body;
}
async function logoutAdmin() {
  try { await adminFetch("/api/auth/logout", { method: "POST" }); } finally { window.location.assign("/admin/login/"); }
}
async function requireAdminSession(onReady) {
  try { await sessionRequest(); if (typeof onReady === "function") onReady(); }
  catch { window.location.replace(`/admin/login/?next=${encodeURIComponent(location.pathname + location.search)}`); }
}
