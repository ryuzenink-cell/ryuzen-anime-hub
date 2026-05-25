import { RequestError } from "./http.js";
import { safeWebUrl } from "./sanitize.js";

export const BANNER_PLACEMENTS = ["blog_sidebar_left", "blog_sidebar_right", "blog_inline_horizontal", "blog_home_featured"];
export const BANNER_STATUSES = ["active", "inactive", "archived"];
const cleanText = (value, max) => String(value || "").trim().slice(0, max);

export function validateBannerPayload(payload = {}) {
  const name = cleanText(payload.name, 120);
  const placement = cleanText(payload.placement, 40);
  const status = BANNER_STATUSES.includes(payload.status) ? payload.status : "inactive";
  const altText = cleanText(payload.alt_text || payload.altText, 240);
  if (!name) throw new RequestError("Informe o nome interno do banner.", 400);
  if (!BANNER_PLACEMENTS.includes(placement)) throw new RequestError("Posição de banner inválida.", 400);
  if (!altText) throw new RequestError("Informe o texto alternativo do banner.", 400);
  return {
    name,
    placement,
    status,
    image_url: safeWebUrl(payload.image_url || payload.imageUrl, true),
    alt_text: altText,
    target_url: safeWebUrl(payload.target_url || payload.targetUrl, true),
  };
}

export async function enforceSingleActiveBanner(db, placement, exceptId = null) {
  if (exceptId) {
    await db.prepare("UPDATE banners SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE placement = ? AND status = 'active' AND id <> ?")
      .bind(placement, exceptId).run();
  } else {
    await db.prepare("UPDATE banners SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE placement = ? AND status = 'active'")
      .bind(placement).run();
  }
}
