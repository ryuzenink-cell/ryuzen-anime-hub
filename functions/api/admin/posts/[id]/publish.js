import { json, handleError, requireDatabase, RequestError } from "../../../../_utils/http.js";
import { findPostForAdmin, validatePostPayload } from "../../../../_utils/posts.js";
import { writeAudit } from "../../../../_utils/auth.js";
export async function onRequestPost({ params, request, env }) {
  try {
    const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);
    const db = requireDatabase(env); const current = await findPostForAdmin(db, id); validatePostPayload(current, { publishing: true });
    await db.prepare(`UPDATE posts SET status = 'published', published_at = COALESCE(published_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
    await writeAudit(db, request, env, "post.publish", "post", id, { slug: current.slug });
    return json({ id, status: "published", url: `/blog/p/${current.slug}/`, message: "Artigo publicado." });
  } catch (error) { return handleError(error); }
}
