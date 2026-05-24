import { publicJson, handleError, requireDatabase } from "../../_utils/http.js";
import { sanitizeArticleHtml } from "../../_utils/sanitize.js";
export async function onRequestGet({ params, env }) {
  try {
    const db = requireDatabase(env);
    const post = await db.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM posts p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.status = 'published'`).bind(String(params.slug || "")).first();
    if (!post) return publicJson({ error: "Post não encontrado." }, 404);
    const tags = await db.prepare(`SELECT t.name, t.slug FROM tags t INNER JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ? ORDER BY t.name`).bind(post.id).all();
    const images = await db.prepare("SELECT * FROM post_images WHERE post_id = ? ORDER BY position_order, id").bind(post.id).all();
    return publicJson({ post: { ...post, content_html: sanitizeArticleHtml(post.content_html || ""), url: `/blog/p/${post.slug}/`, tags: tags.results || [], images: images.results || [] } });
  } catch (error) { return handleError(error); }
}
