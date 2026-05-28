import { json, handleError, requireDatabase, RequestError } from "../../../../../_utils/http.js";
export async function onRequestGet({ params, env }) {
  try {
    const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);
    const result = await requireDatabase(env).prepare("SELECT id,revision_note,created_at,title,excerpt,content_markdown FROM post_revisions WHERE post_id=? ORDER BY created_at DESC,id DESC LIMIT 30").bind(id).all();
    return json({ revisions: result.results || [] });
  } catch (error) { return handleError(error); }
}
