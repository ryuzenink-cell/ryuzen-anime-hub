import { publicJson, handleError, requireDatabase } from "../../_utils/http.js";
import { safeAffiliateUrl, safeStoreImageUrl } from "../../_utils/store.js";

export async function onRequestGet({ env }) {
  try {
    const result = await requireDatabase(env).prepare(`SELECT id, name, category, description, affiliate_url, badge, image_url, image_alt
      FROM store_products
      WHERE status = 'published'
      ORDER BY is_featured DESC, sort_order ASC, updated_at DESC, id DESC`).all();
    const products = (result.results || []).filter((product) => {
      try { product.affiliate_url = safeAffiliateUrl(product.affiliate_url); }
      catch { return false; }
      try { product.image_url = safeStoreImageUrl(product.image_url, true); }
      catch { product.image_url = ""; }
      return true;
    });
    return publicJson({ products });
  } catch (error) {
    if (String(error?.message || "").includes("no such table")) return publicJson({ products: [] });
    return handleError(error);
  }
}
