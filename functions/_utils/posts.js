import { RequestError } from "./http.js";
import { normalizeImage, safeWebUrl, sanitizeArticleHtml } from "./sanitize.js";

export function slugify(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150);
}

function text(value, maximum) { return String(value || "").trim().slice(0, maximum); }

export function validatePostPayload(payload = {}, { publishing = false } = {}) {
  const title = text(payload.title, 180);
  const slug = slugify(payload.slug || title);
  const excerpt = text(payload.excerpt, 320);
  const contentHtml = sanitizeArticleHtml(payload.content_html || payload.contentHtml || "");
  if (!title || !slug || !excerpt) throw new RequestError("Preencha título, slug e resumo do artigo.", 400);
  if (publishing && !contentHtml.replace(/<[^>]+>/g, "").trim() && !contentHtml.includes("<img")) {
    throw new RequestError("Não é possível publicar um artigo sem conteúdo.", 400);
  }
  const cover = safeWebUrl(payload.cover_image_url || payload.coverImageUrl || "");
  const coverAlt = text(payload.cover_alt || payload.coverAlt, 240);
  if (cover && !coverAlt) throw new RequestError("Informe o texto alternativo da capa.", 400);
  const categoryId = payload.category_id || payload.categoryId ? Number(payload.category_id || payload.categoryId) : null;
  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId < 1)) throw new RequestError("Categoria inválida.", 400);
  return {
    title, slug, excerpt, content_html: contentHtml, content_markdown: "",
    author_name: text(payload.author_name || payload.authorName || "Ryuzen Anime Hub", 120) || "Ryuzen Anime Hub",
    category_id: categoryId,
    cover_image_url: cover,
    cover_alt: coverAlt,
    cover_credit: text(payload.cover_credit || payload.coverCredit, 240),
    cover_source_url: safeWebUrl(payload.cover_source_url || payload.coverSourceUrl || ""),
    social_image_url: safeWebUrl(payload.social_image_url || payload.socialImageUrl || ""),
    seo_title: text(payload.seo_title || payload.seoTitle || title, 180),
    seo_description: text(payload.seo_description || payload.seoDescription || excerpt, 320),
    canonical_url: safeWebUrl(payload.canonical_url || payload.canonicalUrl || `https://anime.ryuzen.ink/blog/p/${slug}/`),
    featured: payload.featured ? 1 : 0,
    tags: normalizeTags(payload.tags),
    images: Array.isArray(payload.images) ? payload.images.map(normalizeImage) : [],
  };
}

export function normalizeTags(tags) {
  const values = Array.isArray(tags) ? tags : String(tags || "").split(",");
  return [...new Set(values.map((tag) => text(tag, 50)).filter(Boolean))].slice(0, 12);
}

export async function findPostForAdmin(db, id) {
  const post = await db.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`).bind(id).first();
  if (!post) throw new RequestError("Post não encontrado.", 404);
  const tags = await db.prepare(`SELECT t.name FROM tags t INNER JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ? ORDER BY t.name`).bind(id).all();
  const images = await db.prepare(`SELECT * FROM post_images WHERE post_id = ? ORDER BY position_order, id`).bind(id).all();
  return { ...post, tags: (tags.results || []).map((tag) => tag.name), images: images.results || [] };
}

export async function replaceTags(db, postId, tags) {
  await db.prepare("DELETE FROM post_tags WHERE post_id = ?").bind(postId).run();
  for (const name of tags) {
    const slug = slugify(name);
    if (!slug) continue;
    await db.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)").bind(name, slug).run();
    const tag = await db.prepare("SELECT id FROM tags WHERE slug = ?").bind(slug).first();
    if (tag?.id) await db.prepare("INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)").bind(postId, tag.id).run();
  }
}

export async function replaceImages(db, postId, images) {
  await db.prepare("DELETE FROM post_images WHERE post_id = ?").bind(postId).run();
  for (const image of images) {
    await db.prepare(`INSERT INTO post_images
      (post_id, image_url, alt_text, caption, credit_text, source_url, placement, position_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .bind(postId, image.image_url, image.alt_text, image.caption, image.credit_text, image.source_url, image.placement, image.position_order).run();
  }
}
