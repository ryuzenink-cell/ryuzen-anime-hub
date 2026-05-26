import { publicJson, handleError, requireDatabase } from "../../_utils/http.js";
import { safeStoreImageUrl } from "../../_utils/store.js";

export async function onRequestGet({ env }) {
  try {
    const banner = await requireDatabase(env).prepare(`SELECT eyebrow, title, description, button_text, button_url, image_url, image_alt, affiliate_disclaimer
      FROM store_home_banner WHERE id = 1 AND enabled = 1 AND status = 'active' LIMIT 1`).first();
    if (!banner) return publicJson({ banner: null });
    if (banner.image_url) {
      try { banner.image_url = safeStoreImageUrl(banner.image_url, true); }
      catch { banner.image_url = ""; banner.image_alt = ""; }
    }
    banner.button_url = "/loja/";
    return publicJson({ banner });
  } catch (error) {
    if (String(error?.message || "").includes("no such table")) return publicJson({ banner: null });
    return handleError(error);
  }
}
