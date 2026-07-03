import { RequestError } from "./http.js";
import { normalizeImage, safeWebUrl, sanitizeArticleHtml } from "./sanitize.js";

export function slugify(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150);
}

function text(value, maximum) { return String(value || "").trim().slice(0, maximum); }

export function validatePostPayload(payload = {}, { publishing = false } = {}) {
  const title = text(payload.title, 180);
  if (!title) throw new RequestError("Não foi possível salvar porque o título do post está vazio.", 400, { code: "REQUIRED_FIELD_MISSING", field: "title" });
  const slug = slugify(payload.slug || title);
  if (!slug) throw new RequestError("Não foi possível salvar porque o slug do post é inválido ou está vazio.", 400, { code: "REQUIRED_FIELD_MISSING", field: "slug" });
  const excerpt = text(payload.excerpt, 320);
  if (!excerpt) throw new RequestError("Não foi possível salvar porque o resumo do post está vazio.", 400, { code: "REQUIRED_FIELD_MISSING", field: "excerpt" });
  const contentHtml = sanitizeArticleHtml(payload.content_html || payload.contentHtml || "");
  if (publishing && !contentHtml.replace(/<[^>]+>/g, "").trim() && !contentHtml.includes("<img") && !contentHtml.includes("<table")) {
    throw new RequestError("Não é possível publicar porque o artigo ainda não tem conteúdo.", 400, { code: "REQUIRED_FIELD_MISSING", field: "content_html" });
  }
  const cover = safeWebUrl(payload.cover_image_url || payload.coverImageUrl || "", false, "URL da capa", "cover_image_url");
  const coverAlt = text(payload.cover_alt || payload.coverAlt, 240);
  if (cover && !coverAlt) throw new RequestError("Informe o texto alternativo da capa antes de salvar.", 400, { code: "REQUIRED_FIELD_MISSING", field: "cover_alt" });
  const categoryId = payload.category_id || payload.categoryId ? Number(payload.category_id || payload.categoryId) : null;
  if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId < 1)) {
    throw new RequestError("A categoria selecionada é inválida.", 400, { code: "VALIDATION_ERROR", field: "category_id" });
  }
  return {
    title, slug, excerpt, content_html: contentHtml, content_markdown: "",
    author_name: text(payload.author_name || payload.authorName || "Ryuzen Anime Hub", 120) || "Ryuzen Anime Hub",
    category_id: categoryId,
    cover_image_url: cover,
    cover_alt: coverAlt,
    cover_credit: text(payload.cover_credit || payload.coverCredit, 240),
    cover_source_url: safeWebUrl(payload.cover_source_url || payload.coverSourceUrl || "", false, "URL da fonte da capa", "cover_source_url"),
    social_image_url: safeWebUrl(payload.social_image_url || payload.socialImageUrl || "", false, "URL da imagem social", "social_image_url"),
    seo_title: text(payload.seo_title || payload.seoTitle || title, 180),
    seo_description: text(payload.seo_description || payload.seoDescription || excerpt, 320),
    canonical_url: safeWebUrl(payload.canonical_url || payload.canonicalUrl || `https://anime.ryuzen.ink/blog/p/${slug}/`, false, "URL canonical", "canonical_url"),
    featured: payload.featured ? 1 : 0,
    tags: normalizeTags(payload.tags),
    images: Array.isArray(payload.images) ? payload.images.map(normalizeImage) : [],
  };
}

/**
 * Detecta se a migration 0006 (coluna posts.version) já foi aplicada na base D1.
 * Não altera schema: enquanto a migration não for executada, o backend continua
 * funcionando normalmente sem controle de concorrência otimista.
 */
export async function getPostCapabilities(db) {
  const tableInfo = await db.prepare("PRAGMA table_info(posts)").all();
  const columns = tableInfo.results || [];
  return { versioning: columns.some((column) => column.name === "version") };
}

export function normalizeTags(tags) {
  const values = Array.isArray(tags) ? tags : String(tags || "").split(",");
  return [...new Set(values.map((tag) => text(tag, 50)).filter(Boolean))].slice(0, 12);
}

export async function findPostForAdmin(db, id) {
  const post = await db.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM posts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`).bind(id).first();
  if (!post) throw new RequestError("O post informado não foi encontrado ou pode ter sido excluído.", 404, { code: "POST_NOT_FOUND" });
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
