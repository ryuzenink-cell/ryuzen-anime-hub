import { json, handleError, requireDatabase, RequestError } from "../../../../../../_utils/http.js";
import { findPostForAdmin } from "../../../../../../_utils/posts.js";
import { writeAudit } from "../../../../../../_utils/auth.js";
import { sanitizeArticleHtml } from "../../../../../../_utils/sanitize.js";
export async function onRequestPost({ params, request, env }) {
  try {
    const id = Number(params.id); const revisionId = Number(params.revisionId);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(revisionId) || revisionId < 1) throw new RequestError("Identificador inválido.", 400);
    const db = requireDatabase(env); const current = await findPostForAdmin(db, id);
    const revision = await db.prepare("SELECT * FROM post_revisions WHERE id=? AND post_id=? LIMIT 1").bind(revisionId,id).first();
    if (!revision) throw new RequestError("Revisão não encontrada.", 404);
    await db.prepare("INSERT INTO post_revisions (post_id,title,excerpt,content_markdown,revision_note,created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)").bind(id,current.title,current.excerpt,current.content_html || current.content_markdown || "","Backup automático antes da restauração").run();
    await db.prepare("UPDATE posts SET title=?,excerpt=?,content_html=?,content_markdown='',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(revision.title,revision.excerpt,sanitizeArticleHtml(revision.content_markdown || ""),id).run();
    await writeAudit(db,request,env,"post.revision.restore","post",id,{revisionId});
    return json({ id, message:"Versão restaurada mantendo o status atual da publicação." });
  } catch (error) { return handleError(error); }
}
