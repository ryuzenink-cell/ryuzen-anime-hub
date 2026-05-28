import { json, handleError, readJson, requireDatabase, RequestError } from "../../../_utils/http.js";
import { findPostForAdmin, replaceImages, replaceTags, validatePostPayload } from "../../../_utils/posts.js";
import { writeAudit } from "../../../_utils/auth.js";
function postId(params) { const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400); return id; }
export async function onRequestGet({ params, env }) { try { return json({ post: await findPostForAdmin(requireDatabase(env), postId(params)) }); } catch (error) { return handleError(error); } }
export async function onRequestPut({ params, request, env }) {
  try {
    const db = requireDatabase(env); const id = postId(params); const existing = await findPostForAdmin(db, id);
    const payload = validatePostPayload(await readJson(request));
    await db.prepare(`INSERT INTO post_revisions (post_id, title, excerpt, content_markdown, revision_note, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(id, existing.title, existing.excerpt, existing.content_html || existing.content_markdown || "", "Versão salva antes da edição pelo painel").run();
    await db.prepare(`UPDATE posts SET title = ?, slug = ?, excerpt = ?, content_markdown = ?, content_html = ?, author_name = ?, category_id = ?, cover_image_url = ?, cover_alt = ?, cover_credit = ?, cover_source_url = ?, social_image_url = ?, seo_title = ?, seo_description = ?, canonical_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(payload.title, payload.slug, payload.excerpt, payload.content_markdown, payload.content_html, payload.author_name, payload.category_id, payload.cover_image_url, payload.cover_alt, payload.cover_credit, payload.cover_source_url, payload.social_image_url, payload.seo_title, payload.seo_description, payload.canonical_url, id).run();
    await replaceTags(db, id, payload.tags); await replaceImages(db, id, payload.images);
    await writeAudit(db, request, env, "post.update", "post", id, { slug: payload.slug });
    return json({ id, message: "Post atualizado com sucesso." });
  } catch (error) { return handleError(error); }
}
