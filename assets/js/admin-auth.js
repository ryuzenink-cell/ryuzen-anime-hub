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
  let response;
  try {
    response = await fetch(url, { ...options, method, headers, credentials: "same-origin" });
  } catch (networkError) {
    const error = new Error("Sua conexão foi interrompida. Verifique a internet e tente novamente.");
    error.code = "NETWORK_ERROR";
    error.cause = networkError;
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign(`/admin/login/?next=${encodeURIComponent(location.pathname + location.search)}`);
    const error = new Error(body.error || "Sua sessão expirou. Faça login novamente.");
    error.code = body.code || "SESSION_EXPIRED";
    error.status = 401;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(body.error || "Não foi possível concluir esta operação.");
    error.code = body.code || null;
    error.field = body.field || null;
    error.errorId = body.errorId || null;
    error.status = response.status;
    throw error;
  }
  return body;
}
async function logoutAdmin() {
  try { await adminFetch("/api/auth/logout", { method: "POST" }); } finally { window.location.assign("/admin/login/"); }
}
async function requireAdminSession(onReady) {
  try { await sessionRequest(); if (typeof onReady === "function") onReady(); }
  catch { window.location.replace(`/admin/login/?next=${encodeURIComponent(location.pathname + location.search)}`); }
}
