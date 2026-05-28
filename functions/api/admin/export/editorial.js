import { json, handleError, requireDatabase } from "../../../_utils/http.js";
import { ensureStoreSchema } from "../../../_utils/store.js";
export async function onRequestGet({ env }) {
  try {
    const db = requireDatabase(env); await ensureStoreSchema(db);
    const [posts, categories, tags, postTags, banners, products, storeBanner] = await Promise.all([
      db.prepare("SELECT id,title,slug,excerpt,content_html,status,author_name,category_id,cover_image_url,cover_alt,cover_credit,cover_source_url,social_image_url,seo_title,seo_description,canonical_url,featured,published_at,scheduled_at,updated_at,created_at FROM posts ORDER BY id").all(),
      db.prepare("SELECT * FROM categories ORDER BY id").all(), db.prepare("SELECT * FROM tags ORDER BY id").all(),
      db.prepare("SELECT * FROM post_tags ORDER BY post_id, tag_id").all(), db.prepare("SELECT * FROM banners ORDER BY id").all(),
      db.prepare("SELECT id,name,category,description,affiliate_url,asin,related_title,badge,image_url,image_alt,status,is_featured,sort_order,internal_notes,created_at,updated_at,last_reviewed_at,link_review_status FROM store_products ORDER BY id").all(),
      db.prepare("SELECT id,enabled,eyebrow,title,description,button_text,button_url,image_url,image_alt,affiliate_disclaimer,status,updated_at FROM store_home_banner WHERE id=1").first(),
    ]);
    const generatedAt = new Date().toISOString();
    return json({ format: "ryuzen-editorial-backup", version: 1, generated_at: generatedAt, data: { posts: posts.results || [], categories: categories.results || [], tags: tags.results || [], post_tags: postTags.results || [], banners: banners.results || [], store_products: products.results || [], store_home_banner: storeBanner || null } }, 200, { "Content-Disposition": `attachment; filename="ryuzen-editorial-backup-${generatedAt.slice(0,10)}.json"`, "Cache-Control": "no-store" });
  } catch (error) { return handleError(error); }
}
