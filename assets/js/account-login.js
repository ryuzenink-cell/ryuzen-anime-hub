const accountLoginForm = document.getElementById("accountLoginForm");
const accountLoginFeedback = document.getElementById("accountFeedback");
const accountLoginButton = document.getElementById("accountSubmit");

function setAccountFeedback(message) {
  accountLoginFeedback.textContent = message;
  accountLoginFeedback.classList.toggle("hidden", !message);
}

function safeNextRoute() {
  const next = new URLSearchParams(location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return typeof RYZEN_ROUTES !== "undefined" ? RYZEN_ROUTES.myList : "/my-list/";
}

accountLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAccountFeedback("");
  accountLoginButton.disabled = true;
  accountLoginButton.textContent = "Entrando...";
  try {
    const response = await fetch("/api/account/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: accountLoginForm.email.value, password: accountLoginForm.password.value }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.authenticated) {
      if (response.status === 503) setAccountFeedback("O sistema de contas está temporariamente indisponível. Tente novamente em instantes.");
      else if (response.status === 429) setAccountFeedback("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
      else setAccountFeedback(data.error || "E-mail ou senha inválidos.");
      return;
    }
    if (window.ryuzenRefreshAccountSession) await window.ryuzenRefreshAccountSession();
    window.location.assign(safeNextRoute());
  } catch {
    setAccountFeedback("Não foi possível conectar. Verifique sua internet e tente novamente.");
  } finally {
    accountLoginButton.disabled = false;
    accountLoginButton.textContent = "Entrar";
  }
});
