const profileState = document.getElementById("profileState");
const profileContent = document.getElementById("profileContent");
const profileEmail = document.getElementById("profileEmail");
const profileFeedback = document.getElementById("profileFeedback");
const profileLogout = document.getElementById("profileLogout");
const avatarPreview = document.getElementById("avatarPreview");
const avatarGrid = document.getElementById("avatarGrid");

function setProfileState(message) {
  if (!profileState) return;
  profileState.textContent = message;
  profileState.classList.toggle("hidden", !message);
}
function setFeedback(message, isError = true) {
  if (!profileFeedback) return;
  profileFeedback.textContent = message;
  profileFeedback.classList.toggle("hidden", !message);
  profileFeedback.classList.toggle("account-alert-success", !isError);
}
function avatarThumbUrl(filename) {
  return `/assets/images/avatars/${encodeURIComponent(filename)}`;
}

async function loadAvatarOptions() {
  try {
    const response = await fetch("/data/avatars.json", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.avatars) ? data.avatars : [];
  } catch { return []; }
}

function renderAvatarGrid(avatars, currentFilename) {
  const defaultButton = `
    <button type="button" class="avatar-option avatar-option-default ${currentFilename ? "" : "selected"}" data-avatar-option="" aria-pressed="${currentFilename ? "false" : "true"}">
      <span>Padrão</span>
    </button>`;
  const optionButtons = avatars.map((filename) => `
    <button type="button" class="avatar-option ${filename === currentFilename ? "selected" : ""}" data-avatar-option="${escapeAttr(filename)}" aria-pressed="${filename === currentFilename ? "true" : "false"}" aria-label="Usar este avatar">
      <img src="${avatarThumbUrl(filename)}" alt="" loading="lazy">
    </button>`).join("");
  avatarGrid.innerHTML = defaultButton + optionButtons;
  avatarGrid.querySelectorAll("[data-avatar-option]").forEach((button) => {
    button.addEventListener("click", () => selectAvatar(button.dataset.avatarOption));
  });
}

function escapeAttr(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function updateSummary() {
  const state = window.ryuzenAccountState || {};
  avatarPreview.src = state.avatarUrl || "/assets/icons/icon-192.png?v=20260724-discovery-fix-v1";
  profileEmail.textContent = state.email || "";
}

async function selectAvatar(filename) {
  setFeedback("");
  try {
    const response = await fetch("/api/account/avatar", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": window.ryuzenAccountState?.csrfToken || "" },
      body: JSON.stringify({ avatarFilename: filename || null }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setFeedback(data.error || "Não foi possível atualizar o avatar. Tente novamente.");
      return;
    }
    if (window.ryuzenAccountState) {
      window.ryuzenAccountState.avatarUrl = data.user?.avatarUrl || "";
      window.ryuzenAccountState.avatarFilename = data.user?.avatarFilename || "";
    }
    updateSummary();
    if (typeof window.ryuzenRefreshAccountSession === "function") await window.ryuzenRefreshAccountSession();
    if (window.ryuzenPublicToast) window.ryuzenPublicToast("Avatar atualizado.");
    const avatars = await loadAvatarOptions();
    renderAvatarGrid(avatars, data.user?.avatarFilename || "");
  } catch {
    setFeedback("Não foi possível conectar. Verifique sua internet e tente novamente.");
  }
}

async function showProfile(state) {
  setProfileState("");
  profileContent.classList.remove("hidden");
  updateSummary();
  const avatars = await loadAvatarOptions();
  renderAvatarGrid(avatars, state.avatarFilename || "");
}

function handleAccountState(state) {
  if (!state || !state.checked) return;
  if (state.dbUnavailable) {
    profileContent.classList.add("hidden");
    setProfileState("O sistema de contas está temporariamente indisponível. Tente novamente em instantes.");
    return;
  }
  if (!state.authenticated) {
    window.location.assign(`/conta/entrar/?next=${encodeURIComponent(location.pathname)}`);
    return;
  }
  showProfile(state);
}

document.addEventListener("ryuzen:account-state", (event) => handleAccountState(event.detail));
if (window.ryuzenAccountState?.checked) handleAccountState(window.ryuzenAccountState);

profileLogout?.addEventListener("click", async () => {
  if (typeof window.ryuzenLogoutAccount === "function") await window.ryuzenLogoutAccount();
  window.location.assign("/");
});
