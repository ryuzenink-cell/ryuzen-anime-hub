import { json, handleError, requireDatabase, RequestError } from "../../../../_utils/http.js";
import { writeAudit } from "../../../../_utils/auth.js";
export async function onRequestPost({ params, request, env }) {
  try {
    const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);
    const db = requireDatabase(env); const post = await db.prepare("SELECT id,title,slug,status FROM posts WHERE id=?").bind(id).first();
    if (!post) throw new RequestError("Post não encontrado.", 404); if (post.status !== 'published') throw new RequestError("Somente posts publicados podem ser destaque.", 409);
    await db.batch([db.prepare("UPDATE posts SET featured=0 WHERE featured=1 AND id<>?").bind(id), db.prepare("UPDATE posts SET featured=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id)]);
    await writeAudit(db,request,env,"post.feature","post",id,{slug:post.slug}); return json({ id, featured:true, message:"Artigo definido como destaque editorial." });
  } catch (error) { return handleError(error); }
}
