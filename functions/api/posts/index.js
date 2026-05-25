import { json, handleError, parseInteger, requireDatabase } from "../../_utils/http.js";
import { estimateReadingTimeFromHtml } from "../../_utils/article-template.js";

export async function onRequestGet({ request, env }) {
  try {
    const db = requireDatabase(env);
    const url = new URL(request.url);
    const page = parseInteger(url.searchParams.get("page"), 1, 1, 10000);
    const limit = parseInteger(url.searchParams.get("limit"), 12, 1, 40);
    const offset = (page - 1) * limit;
    const count = await db.prepare("SELECT COUNT(*) AS total FROM posts WHERE status = 'published'").first();
    const result = await db.prepare(`SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.cover_alt,
      p.published_at, p.updated_at, p.author_name, p.seo_description, p.canonical_url, p.featured, p.content_html,
      c.name AS category_name, GROUP_CONCAT(DISTINCT t.name) AS tags_csv
      FROM posts p LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN post_tags pt ON pt.post_id = p.id LEFT JOIN tags t ON t.id = pt.tag_id
      WHERE p.status = 'published'
      GROUP BY p.id
      ORDER BY p.featured DESC, p.published_at DESC, p.id DESC LIMIT ? OFFSET ?`).bind(limit, offset).all();
    const posts = (result.results || []).map(({ content_html, tags_csv, ...post }) => ({
      ...post,
      tags: tags_csv ? String(tags_csv).split(",").filter(Boolean) : [],
      readingTime: estimateReadingTimeFromHtml(content_html || ""),
      url: `/blog/p/${post.slug}/`,
    }));
    return json({ posts, pagination: { page, limit, total: Number(count?.total || 0) } }, 200, { "Cache-Control": "no-store" });
  } catch (error) { return handleError(error); }
}
