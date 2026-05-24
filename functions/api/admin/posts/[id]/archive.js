import { json, handleError, requireDatabase, RequestError } from "../../../../_utils/http.js";
export async function onRequestPost({ params, env }) {
  try {
    const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);
    const result = await requireDatabase(env).prepare("UPDATE posts SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    if (!result.meta?.changes) throw new RequestError("Post não encontrado.", 404);
    return json({ id, status: "archived", message: "Artigo arquivado." });
  } catch (error) { return handleError(error); }
}
