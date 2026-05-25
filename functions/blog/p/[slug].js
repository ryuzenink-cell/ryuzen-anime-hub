import { sanitizeArticleHtml, safeWebUrl } from "../../_utils/sanitize.js";
import { requireDatabase } from "../../_utils/http.js";
import { enrichArticleContent, estimateReadingTimeFromHtml, renderDynamicArticlePage } from "../../_utils/article-template.js";

function optionalSafeUrl(value = "") {
  if (!value) return "";
  try { return safeWebUrl(value); } catch { return ""; }
}

export async function onRequestGet({ params, env }) {
  try {
    const db = requireDatabase(env);
    const post = await db.prepare(`SELECT p.*, c.name AS category_name FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.status = 'published'`).bind(String(params.slug || "")).first();
    if (!post) return new Response("Artigo não encontrado.", { status: 404, headers: { "Cache-Control": "no-store" } });

    post.cover_image_url = optionalSafeUrl(post.cover_image_url);
    post.social_image_url = optionalSafeUrl(post.social_image_url);
    post.canonical_url = optionalSafeUrl(post.canonical_url);
    const tagResult = await db.prepare(`SELECT t.name FROM tags t INNER JOIN post_tags pt ON pt.tag_id = t.id
      WHERE pt.post_id = ? ORDER BY t.name`).bind(post.id).all();
    const tags = (tagResult.results || []).map((tag) => tag.name);
    const cleanContent = sanitizeArticleHtml(post.content_html || "");
    const article = enrichArticleContent(cleanContent);

    const relatedResult = await db.prepare(`SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.cover_alt, p.content_html,
      c.name AS category_name
      FROM posts p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND p.id <> ?
      ORDER BY CASE WHEN p.category_id = ? THEN 0 ELSE 1 END, p.published_at DESC, p.id DESC LIMIT 3`)
      .bind(post.id, post.category_id || -1).all();
    const relatedPosts = (relatedResult.results || []).map((related) => ({
      ...related,
      cover_image_url: optionalSafeUrl(related.cover_image_url),
      reading_time: estimateReadingTimeFromHtml(related.content_html || ""),
    }));

    const html = renderDynamicArticlePage({ post, tags, contentHtml: article.html, headings: article.headings, relatedPosts });
    return new Response(html, { headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    } });
  } catch (error) {
    console.error("Falha ao renderizar artigo dinâmico:", error?.message || "erro desconhecido");
    return new Response("Não foi possível carregar este artigo.", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
