import { RequestError } from "./http.js";
import { safeWebUrl } from "./sanitize.js";

export const STORE_CATEGORIES = ["manga", "light_novel", "collectible", "digital_reading", "geek_gift", "apparel", "creators", "other"];
export const STORE_BADGES = ["none", "ryuzen_choice", "getting_started", "highlight", "recommended", "geek_gift"];
export const STORE_STATUSES = ["draft", "published", "archived"];
const AMAZON_HOST_RE = /(?:^|\.)amazon\.(?:com\.br|com|ca|co\.uk|de|es|fr|it|co\.jp|in|com\.mx|com\.au)$/;

function clean(value, max) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function requiredText(value, max, message) {
  const text = clean(value, max);
  if (!text) throw new RequestError(message, 400);
  return text;
}

function booleanFlag(value) {
  return value === true || value === 1 || value === "1";
}

function orderValue(value) {
  const input = String(value ?? "").trim();
  if (!input) return 100;
  const parsed = Number(input);
  return Number.isInteger(parsed) ? Math.max(0, Math.min(9999, parsed)) : 100;
}

function httpsWebUrl(value, { required = false, field = "URL" } = {}) {
  const url = safeWebUrl(value, required);
  if (!url) return "";
  if (new URL(url).protocol !== "https:") {
    throw new RequestError(`${field} deve começar com https://.`, 400);
  }
  return url;
}

export function safeAffiliateUrl(value) {
  const url = httpsWebUrl(value, { required: true, field: "O link afiliado" });
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname !== "amzn.to" && !AMAZON_HOST_RE.test(hostname)) {
    throw new RequestError("Informe um link de produto da Amazon ou link afiliado amzn.to.", 400);
  }
  return url;
}

export function safeStoreImageUrl(value, required = true) {
  return httpsWebUrl(value, { required, field: "A URL da imagem" });
}

export function validateProductPayload(payload = {}, { publishing = false } = {}) {
  const requestedStatus = String(payload.status || "");
  if (!STORE_STATUSES.includes(requestedStatus)) throw new RequestError("Selecione um status válido.", 400);
  const product = {
    name: requiredText(payload.name, 140, "Informe o nome do produto."),
    category: STORE_CATEGORIES.includes(payload.category) ? payload.category : "",
    description: requiredText(payload.description, 180, "Informe uma descrição curta."),
    affiliate_url: safeAffiliateUrl(payload.affiliate_url || payload.affiliateUrl),
    asin: clean(payload.asin, 20),
    related_title: clean(payload.related_title || payload.relatedTitle, 100),
    badge: STORE_BADGES.includes(payload.badge) ? payload.badge : "none",
    image_url: safeStoreImageUrl(payload.image_url || payload.imageUrl, true),
    image_alt: requiredText(payload.image_alt || payload.imageAlt, 240, "Informe o texto alternativo da imagem."),
    status: publishing ? "published" : requestedStatus,
    is_featured: booleanFlag(payload.is_featured ?? payload.isFeatured) ? 1 : 0,
    sort_order: orderValue(payload.sort_order ?? payload.sortOrder),
    internal_notes: cleanMultiline(payload.internal_notes || payload.internalNotes, 1000),
  };
  if (!product.category) throw new RequestError("Selecione uma categoria válida.", 400);
  return product;
}

export function validateStoredProductForPublishing(row) {
  if (!row) throw new RequestError("Produto não encontrado.", 404);
  if (row.status === "archived") throw new RequestError("Produtos arquivados não podem ser publicados.", 409);
  return validateProductPayload({ ...row, status: "published" }, { publishing: true });
}

export function validateHomeBannerPayload(payload = {}) {
  const rawButtonUrl = String(payload.button_url || payload.buttonUrl || "/loja/").trim();
  if (!/^\/loja\/?(?:[?#].*)?$/.test(rawButtonUrl)) throw new RequestError("O botão da home deve direcionar para /loja/.", 400);
  if (!["active", "inactive", "archived"].includes(payload.status)) throw new RequestError("Selecione um status válido para o banner.", 400);
  const imageUrl = String(payload.image_url || payload.imageUrl || "").trim();
  return {
    enabled: booleanFlag(payload.enabled) && payload.status === "active" ? 1 : 0,
    eyebrow: requiredText(payload.eyebrow, 80, "Informe a etiqueta do banner."),
    title: requiredText(payload.title, 100, "Informe o título do banner."),
    description: requiredText(payload.description, 180, "Informe a descrição do banner."),
    button_text: requiredText(payload.button_text || payload.buttonText, 42, "Informe o texto do botão."),
    button_url: "/loja/",
    image_url: imageUrl ? safeStoreImageUrl(imageUrl, true) : "",
    image_alt: imageUrl ? requiredText(payload.image_alt || payload.imageAlt, 240, "Informe o texto alternativo da imagem.") : clean(payload.image_alt || payload.imageAlt, 240),
    affiliate_disclaimer: requiredText(payload.affiliate_disclaimer || payload.affiliateDisclaimer, 180, "Informe o aviso de afiliado."),
    status: payload.status,
  };
}
