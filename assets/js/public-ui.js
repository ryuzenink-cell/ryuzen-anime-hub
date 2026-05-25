(() => {
  const PUBLIC_UI_VERSION = "20260526public-ui-v1";

  function icon(name) {
    const icons = {
      menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
      close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/></svg>',
      calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
      heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.8 8.6c0 5-8.8 10.4-8.8 10.4S3.2 13.6 3.2 8.6A4.7 4.7 0 0112 6.5a4.7 4.7 0 018.8 2.1z"/></svg>',
      up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
      copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"/></svg>',
    };
    return icons[name] || "";
  }

  function preparePublicDocument() {
    if (location.pathname.startsWith("/admin")) return false;
    document.body.classList.add("public-site");
    const main = document.querySelector("main");
    if (main && !main.id) main.id = "main-content";
    if (!document.querySelector(".skip-link") && main) {
      const skip = document.createElement("a");
      skip.href = "#main-content";
      skip.className = "skip-link";
      skip.textContent = "Pular para o conteúdo";
      document.body.prepend(skip);
    }
    return true;
  }

  function bindMobileNavigation() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const close = document.querySelector("[data-menu-close]");
    const backdrop = document.querySelector("[data-menu-backdrop]");
    const drawer = document.querySelector("[data-mobile-drawer]");
    if (!toggle || !drawer) return;
    const open = () => {
      document.body.classList.add("nav-open");
      toggle.setAttribute("aria-expanded", "true");
      drawer.setAttribute("aria-hidden", "false");
      close?.focus();
    };
    const hide = () => {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      drawer.setAttribute("aria-hidden", "true");
    };
    toggle.addEventListener("click", () => document.body.classList.contains("nav-open") ? hide() : open());
    close?.addEventListener("click", hide);
    backdrop?.addEventListener("click", hide);
    drawer.querySelectorAll("a").forEach((link) => link.addEventListener("click", hide));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) hide();
    });
  }

  function toast(message) {
    let region = document.querySelector(".public-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "public-toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const item = document.createElement("div");
    item.className = "public-toast";
    item.textContent = message;
    region.appendChild(item);
    window.setTimeout(() => item.remove(), 2600);
  }
  window.ryuzenPublicToast = toast;

  function updateListBadges() {
    if (typeof getAnimeList !== "function") return;
    const count = getAnimeList().length;
    document.querySelectorAll("[data-list-count]").forEach((item) => {
      const text = String(count);
      if (item.textContent !== text) item.textContent = text;
      item.hidden = count === 0;
    });
    document.querySelectorAll("[data-quick-save]").forEach((button) => {
      const saved = typeof isAnimeSaved === "function" && isAnimeSaved(button.dataset.quickSave);
      button.classList.toggle("saved", saved);
      button.setAttribute("aria-label", saved ? "Remover da minha lista" : "Adicionar à minha lista");
      button.setAttribute("aria-pressed", saved ? "true" : "false");
    });
  }
  window.refreshRyuzenListBadges = updateListBadges;

  function bindQuickSave() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-quick-save]");
      if (!button || typeof saveAnimeToList !== "function") return;
      event.preventDefault();
      event.stopPropagation();
      const id = Number(button.dataset.quickSave);
      if (typeof isAnimeSaved === "function" && isAnimeSaved(id)) {
        removeAnimeFromList(id);
        toast("Removido da sua lista.");
      } else {
        saveAnimeToList({
          id,
          title: button.dataset.title || "Anime",
          image: button.dataset.image || "",
          status: "plan",
          personalScore: "",
          episodesWatched: "",
          totalEpisodes: button.dataset.episodes || "",
          notes: ""
        });
        toast("Adicionado à sua lista.");
      }
      updateListBadges();
    });
    window.addEventListener("storage", updateListBadges);
    document.addEventListener("ryuzen:list-updated", updateListBadges);
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(() => { pending = false; updateListBadges(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(updateListBadges, 0);
  }

  function enhanceRankingTabs() {
    const tabs = [...document.querySelectorAll("[data-ranking]")];
    if (!tabs.length) return;
    tabs.forEach((tab, index) => {
      tab.setAttribute("role", "tab");
      tab.id = tab.id || `ranking-tab-${tab.dataset.ranking}`;
      tab.setAttribute("aria-controls", "rankingList");
      tab.setAttribute("aria-selected", tab.classList.contains("active") ? "true" : "false");
      tab.setAttribute("tabindex", tab.classList.contains("active") ? "0" : "-1");
      tab.addEventListener("click", () => {
        tabs.forEach((item) => {
          const active = item === tab;
          item.setAttribute("aria-selected", active ? "true" : "false");
          item.setAttribute("tabindex", active ? "0" : "-1");
        });
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        tabs[next].focus();
        tabs[next].click();
      });
    });
    const panel = document.getElementById("rankingList");
    if (panel) { panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-live", "polite"); }
  }

  function articleEnhancements() {
    const article = document.querySelector(".blog-article");
    if (!article) return;
    const header = article.querySelector(".blog-article-header");
    const toc = article.querySelector(".blog-toc");
    const content = article.querySelector(".blog-content");
    if (header && !article.querySelector(".article-tools")) {
      const tools = document.createElement("nav");
      tools.className = "article-tools";
      tools.setAttribute("aria-label", "Ferramentas do artigo");
      tools.innerHTML = `
        <button type="button" class="article-tool" data-share-copy>${icon("copy")} Copiar link</button>
        <a class="article-tool" data-share-whatsapp target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a class="article-tool" data-share-x target="_blank" rel="noopener noreferrer">X</a>`;
      header.after(tools);
      tools.querySelector("[data-share-copy]").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(location.href); toast("Link copiado."); }
        catch { toast("Não foi possível copiar o link."); }
      });
      const shareText = encodeURIComponent(document.title);
      const shareUrl = encodeURIComponent(location.href);
      tools.querySelector("[data-share-whatsapp]").href = `https://wa.me/?text=${shareText}%20${shareUrl}`;
      tools.querySelector("[data-share-x]").href = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
    }
    if (toc && toc.querySelectorAll("a").length > 4) {
      toc.classList.add("collapsible");
      if (!toc.querySelector(".toc-toggle")) {
        const button = document.createElement("button");
        button.className = "toc-toggle";
        button.type = "button";
        button.setAttribute("aria-expanded", "false");
        button.innerHTML = '<span>Ver tópicos deste artigo</span><span aria-hidden="true">＋</span>';
        toc.prepend(button);
        button.addEventListener("click", () => {
          const isOpen = toc.classList.toggle("open");
          button.setAttribute("aria-expanded", String(isOpen));
          button.lastElementChild.textContent = isOpen ? "−" : "＋";
        });
      }
    }
    if (content) {
      const progress = document.createElement("progress");
      progress.className = "reading-progress";
      progress.max = 100;
      progress.value = 0;
      progress.setAttribute("aria-hidden", "true");
      document.body.prepend(progress);
      const update = () => {
        const top = content.getBoundingClientRect().top + window.scrollY;
        const total = Math.max(content.offsetHeight - window.innerHeight * .45, 1);
        const percent = Math.max(0, Math.min(100, ((window.scrollY - top + 110) / total) * 100));
        progress.value = percent;
      };
      window.addEventListener("scroll", update, { passive: true });
      update();
    }
    const topButton = document.createElement("button");
    topButton.className = "back-to-top";
    topButton.type = "button";
    topButton.setAttribute("aria-label", "Voltar ao topo");
    topButton.innerHTML = icon("up");
    topButton.addEventListener("click", () => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
    document.body.appendChild(topButton);
    window.addEventListener("scroll", () => topButton.classList.toggle("visible", window.scrollY > 560), { passive: true });
  }

  function enhanceListFilters() {
    const listRoot = document.getElementById("myList");
    const input = document.getElementById("myListSearch");
    if (!listRoot || !input) return;
    input.addEventListener("input", () => {
      const value = input.value.toLocaleLowerCase("pt-BR").trim();
      listRoot.querySelectorAll(".list-item").forEach((item) => {
        item.hidden = value && !item.textContent.toLocaleLowerCase("pt-BR").includes(value);
      });
    });
  }

  function init() {
    if (!preparePublicDocument()) return;
    bindMobileNavigation();
    bindQuickSave();
    enhanceRankingTabs();
    articleEnhancements();
    enhanceListFilters();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.RYZEN_PUBLIC_UI_VERSION = PUBLIC_UI_VERSION;
})();
