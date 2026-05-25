const form = document.getElementById("adminLoginForm");
const feedback = document.getElementById("loginFeedback");
const button = document.getElementById("loginSubmit");
let turnstileEnabled = false;

initLogin();
async function initLogin() {
  try {
    const config = await fetch("/api/auth/config", { headers: { Accept: "application/json" } }).then((response) => response.json());
    if (config.turnstileSiteKey) activateTurnstile(config.turnstileSiteKey);
  } catch { /* Login continua funcional sem widget se não configurado no ambiente. */ }
}
function activateTurnstile(siteKey) {
  turnstileEnabled = true;
  const host = document.getElementById("turnstileHost");
  host.innerHTML = `<div class="cf-turnstile" data-sitekey="${escapeAttr(siteKey)}" data-theme="dark"></div>`;
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  script.async = true; script.defer = true;
  document.head.append(script);
}
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");
  const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value || "";
  if (turnstileEnabled && !turnstileToken) { setMessage("Conclua a verificação de segurança."); return; }
  button.disabled = true; button.textContent = "Entrando...";
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email.value, password: form.password.value, adminKey: form.adminKey.value, turnstileToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.authenticated) throw new Error("E-mail ou credenciais inválidos.");
    form.reset();
    const next = new URLSearchParams(location.search).get("next");
    window.location.replace(next && next.startsWith("/admin/") && !next.startsWith("/admin/login") ? next : "/admin/");
  } catch { setMessage("E-mail ou credenciais inválidos."); if (window.turnstile) window.turnstile.reset(); }
  finally { button.disabled = false; button.textContent = "Entrar"; }
});
function setMessage(message) { feedback.textContent = message; feedback.classList.toggle("hidden", !message); }
function escapeAttr(value="") { return String(value).replace(/[&<>'"]/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[character])); }
