const ADMIN_TOKEN_KEY = "ryuzen_blog_admin_session";
function getAdminToken() { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ""; }
function saveAdminToken(token) { sessionStorage.setItem(ADMIN_TOKEN_KEY, String(token || "").trim()); }
function clearAdminToken() { sessionStorage.removeItem(ADMIN_TOKEN_KEY); }
async function adminFetch(url, options = {}) {
  const token = getAdminToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) throw new Error("Acesso não autorizado. Informe novamente a chave administrativa.");
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Falha na operação.");
  return body;
}
function requireAdminSession(onReady) {
  const gate = document.getElementById("adminAccessGate");
  const form = document.getElementById("adminAccessForm");
  const tokenInput = document.getElementById("adminToken");
  const error = document.getElementById("adminAccessError");
  const unlock = async (token) => {
    saveAdminToken(token);
    try {
      await adminFetch("/api/admin/posts?limit=1");
      gate?.classList.add("hidden"); onReady();
    } catch (cause) { clearAdminToken(); if (error) { error.textContent = cause.message; error.classList.remove("hidden"); } gate?.classList.remove("hidden"); }
  };
  form?.addEventListener("submit", (event) => { event.preventDefault(); unlock(tokenInput.value); });
  if (getAdminToken()) unlock(getAdminToken()); else gate?.classList.remove("hidden");
}
