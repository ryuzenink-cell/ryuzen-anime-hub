import { json, handleError, readJson, requireDatabase, RequestError } from "../../../../_utils/http.js";
import { findPostForAdmin, replaceImages } from "../../../../_utils/posts.js";
import { normalizeImage } from "../../../../_utils/sanitize.js";
import { writeAudit } from "../../../../_utils/auth.js";
export async function onRequestPut({ params, request, env }) {
  try {
    const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);
    const db = requireDatabase(env);
    await findPostForAdmin(db, id);
    const body = await readJson(request);
    const images = Array.isArray(body.images) ? body.images.map(normalizeImage) : [];
    await replaceImages(db, id, images); await writeAudit(db, request, env, "post.images_update", "post", id, { count: images.length });
    return json({ id, images: images.length, message: "Imagens atualizadas." });
  } catch (error) { return handleError(error); }
}
