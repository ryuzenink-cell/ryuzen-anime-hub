import { json, handleError, requireDatabase } from "../_utils/http.js";
export async function onRequestGet({ env }) {
  try {
    const result = await requireDatabase(env).prepare("SELECT placement, image_url, alt_text, target_url FROM banners WHERE status = 'active' ORDER BY updated_at DESC, id DESC").all();
    return json({ banners: result.results || [] }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    if (String(error?.message || "").includes("no such table")) return json({ banners: [] }, 200, { "Cache-Control": "no-store" });
    return handleError(error);
  }
}
