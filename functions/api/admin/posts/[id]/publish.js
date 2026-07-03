import { json, handleError, requireDatabase, RequestError } from "../../../../_utils/http.js";
import { findPostForAdmin, validatePostPayload } from "../../../../_utils/posts.js";
import { writeAudit } from "../../../../_utils/auth.js";
export async function onRequestPost({ params, request, env }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador de post inválido.", 400, { code: "VALIDATION_ERROR", field: "id" });
    const db = requireDatabase(env);
    const current = await findPostForAdmin(db, id);
    validatePostPayload(current, { publishing: true });
    // COALESCE preserva published_at original: clicar publicar duas vezes (ou uma corrida de duplo clique) é seguro e idempotente.
    await db.prepare(`UPDATE posts SET status = 'published', published_at = COALESCE(published_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
    const updated = await db.prepare("SELECT published_at, updated_at FROM posts WHERE id = ?").bind(id).first();
    await writeAudit(db, request, env, "post.publish", "post", id, { slug: current.slug });
    return json({
      id,
      status: "published",
      url: `/blog/p/${current.slug}/`,
      published_at: updated?.published_at || null,
      updated_at: updated?.updated_at || null,
      message: "Artigo publicado.",
    });
  } catch (error) { return handleError(error); }
}
