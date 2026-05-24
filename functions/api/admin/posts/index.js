import { json, handleError, parseInteger, readJson, requireDatabase } from "../../../_utils/http.js";
import { replaceImages, replaceTags, validatePostPayload } from "../../../_utils/posts.js";
export async function onRequestGet({ request, env }) {
  try {
    const db = requireDatabase(env);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "";
    const search = `%${String(url.searchParams.get("q") || "").slice(0, 100)}%`;
    const page = parseInteger(url.searchParams.get("page"), 1, 1, 10000);
    const limit = parseInteger(url.searchParams.get("limit"), 30, 1, 100);
    const conditions = ["p.title LIKE ?"];
    const bindings = [search];
    if (["draft", "published", "archived", "scheduled"].includes(status)) { conditions.push("p.status = ?"); bindings.push(status); }
    const result = await db.prepare(`SELECT p.id, p.title, p.slug, p.status, p.updated_at, p.published_at, c.name AS category_name
      FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE ${conditions.join(" AND ")}
      ORDER BY p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?`).bind(...bindings, limit, (page - 1) * limit).all();
    return json({ posts: result.results || [] });
  } catch (error) { return handleError(error); }
}
export async function onRequestPost({ request, env }) {
  try {
    const db = requireDatabase(env);
    const payload = validatePostPayload(await readJson(request));
    const result = await db.prepare(`INSERT INTO posts
      (title, slug, excerpt, content_markdown, content_html, status, author_name, category_id, cover_image_url, cover_alt, cover_credit, cover_source_url, social_image_url, seo_title, seo_description, canonical_url, featured, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`)
      .bind(payload.title, payload.slug, payload.excerpt, payload.content_markdown, payload.content_html, payload.author_name, payload.category_id, payload.cover_image_url, payload.cover_alt, payload.cover_credit, payload.cover_source_url, payload.social_image_url, payload.seo_title, payload.seo_description, payload.canonical_url, payload.featured).first();
    await replaceTags(db, result.id, payload.tags);
    await replaceImages(db, result.id, payload.images);
    return json({ id: result.id, status: "draft", message: "Rascunho salvo com sucesso." }, 201);
  } catch (error) { return handleError(error); }
}
