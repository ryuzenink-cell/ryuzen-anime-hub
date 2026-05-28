(function () {
  "use strict";
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function ensureToastRoot() {
    let root = document.getElementById("adminToastRegion");
    if (!root) {
      root = document.createElement("div");
      root.id = "adminToastRegion";
      root.className = "admin-toast-region";
      root.setAttribute("aria-live", "polite");
      root.setAttribute("aria-atomic", "false");
      document.body.appendChild(root);
    }
    return root;
  }
  function toast(message, type = "info", timeout = 4300) {
    const node = document.createElement("div");
    node.className = `admin-toast ${type}`;
    node.setAttribute("role", type === "error" ? "alert" : "status");
    const text = document.createElement("p"); text.textContent = String(message || "");
    const close = document.createElement("button"); close.type = "button"; close.className = "admin-toast-close"; close.setAttribute("aria-label", "Fechar mensagem"); close.textContent = "×";
    const remove = () => { node.classList.add("leaving"); window.setTimeout(() => node.remove(), reduceMotion ? 0 : 180); };
    close.addEventListener("click", remove); node.append(text, close); ensureToastRoot().appendChild(node);
    if (timeout > 0) window.setTimeout(remove, timeout);
    return node;
  }
  function ensureDialog() {
    let dialog = document.getElementById("adminConfirmDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog"); dialog.id = "adminConfirmDialog"; dialog.className = "admin-confirm-dialog";
    dialog.innerHTML = `<form method="dialog" class="admin-confirm-card"><h2 id="adminConfirmTitle">Confirmar ação</h2><p id="adminConfirmText"></p><div class="row-actions"><button class="btn ghost" value="cancel">Cancelar</button><button class="btn danger" id="adminConfirmButton" value="confirm">Confirmar</button></div></form>`;
    document.body.appendChild(dialog); return dialog;
  }
  function confirmAction(message, options = {}) {
    const dialog = ensureDialog();
    if (typeof dialog.showModal !== "function") return Promise.resolve(window.confirm(message));
    dialog.querySelector("#adminConfirmTitle").textContent = options.title || "Confirmar ação";
    dialog.querySelector("#adminConfirmText").textContent = message;
    const button = dialog.querySelector("#adminConfirmButton"); button.textContent = options.confirmText || "Confirmar"; button.className = `btn ${options.variant || "danger"}`;
    return new Promise((resolve) => { const close = () => { resolve(dialog.returnValue === "confirm"); dialog.removeEventListener("close", close); }; dialog.addEventListener("close", close); dialog.showModal(); });
  }
  window.AdminUI = { toast, confirm: confirmAction };
})();
