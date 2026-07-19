const accountRegisterForm = document.getElementById("accountRegisterForm");
const accountRegisterFeedback = document.getElementById("accountFeedback");
const accountRegisterButton = document.getElementById("accountSubmit");

function setAccountRegisterFeedback(message) {
  accountRegisterFeedback.textContent = message;
  accountRegisterFeedback.classList.toggle("hidden", !message);
}

accountRegisterForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAccountRegisterFeedback("");
  const password = accountRegisterForm.password.value;
  const passwordConfirm = accountRegisterForm.passwordConfirm.value;
  if (password !== passwordConfirm) {
    setAccountRegisterFeedback("As senhas informadas não coincidem.");
    return;
  }
  accountRegisterButton.disabled = true;
  accountRegisterButton.textContent = "Criando conta...";
  try {
    const response = await fetch("/api/account/register", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: accountRegisterForm.email.value, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.authenticated) {
      if (response.status === 503) setAccountRegisterFeedback("O sistema de contas está temporariamente indisponível. Tente novamente em instantes.");
      else if (response.status === 429) setAccountRegisterFeedback("Muitas tentativas de cadastro. Aguarde alguns minutos antes de tentar novamente.");
      else if (data.code === "EMAIL_ALREADY_REGISTERED") setAccountRegisterFeedback("Este e-mail já possui uma conta. Faça login em vez de criar uma nova.");
      else setAccountRegisterFeedback(data.error || "Não foi possível concluir o cadastro. Verifique os dados informados.");
      return;
    }
    if (window.ryuzenRefreshAccountSession) await window.ryuzenRefreshAccountSession();
    window.location.assign(typeof RYZEN_ROUTES !== "undefined" ? RYZEN_ROUTES.myList : "/my-list/");
  } catch {
    setAccountRegisterFeedback("Não foi possível conectar. Verifique sua internet e tente novamente.");
  } finally {
    accountRegisterButton.disabled = false;
    accountRegisterButton.textContent = "Criar conta";
  }
});
