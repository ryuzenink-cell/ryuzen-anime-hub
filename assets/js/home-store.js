(() => {
  "use strict";
  const mount = document.getElementById("homeStoreBanner");
  if (!mount) return;
  const placeholder = "/assets/images/logo-placeholder.webp?v=20260724-discovery-fix-v1";

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function validImageUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }
  function recordBannerClick() {
    const payload = { destination_type: "home_banner", source: "home" };
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (!navigator.sendBeacon || !navigator.sendBeacon("/api/store/click", blob)) {
        fetch("/api/store/click", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      }
    } catch { /* a métrica não interfere na navegação */ }
  }
  function createVisual(banner) {
    const visual = element("div", "home-store-visual");
    const imageUrl = validImageUrl(banner.image_url);
    if (!imageUrl) {
      const art = element("div", "store-banner-art");
      art.setAttribute("aria-hidden", "true");
      art.appendChild(element("span", "", "本"));
      art.appendChild(element("strong", "", "RYUZEN"));
      visual.appendChild(art);
      return visual;
    }
    const image = element("img", "store-banner-image");
    image.src = imageUrl;
    image.alt = String(banner.image_alt || "Seleção da Loja Ryuzen").slice(0, 240);
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      if (!image.classList.contains("is-fallback")) {
        image.src = placeholder;
        image.classList.add("is-fallback");
      }
    }, { once: true });
    visual.appendChild(image);
    return visual;
  }
  function render(banner) {
    const section = element("section", "home-store-banner");
    section.setAttribute("aria-label", "Destaque da Loja Ryuzen");
    const copy = element("div", "home-store-copy");
    copy.appendChild(element("p", "eyebrow", banner.eyebrow));
    copy.appendChild(element("h2", "", banner.title));
    copy.appendChild(element("p", "", banner.description));
    const action = element("a", "btn primary", banner.button_text);
    action.href = "/loja/";
    action.addEventListener("click", recordBannerClick);
    copy.appendChild(action);
    copy.appendChild(element("small", "", banner.affiliate_disclaimer));
    section.appendChild(copy);
    section.appendChild(createVisual(banner));
    mount.replaceChildren(section);
    mount.hidden = false;
  }
  async function loadBanner() {
    mount.hidden = true;
    try {
      const response = await fetch("/api/store/banner", { headers: { Accept: "application/json" } });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.banner) render(data.banner);
    } catch { mount.hidden = true; }
  }
  loadBanner();
})();
