import { json, handleError, readJson, requireDatabase, RequestError } from "../../../../_utils/http.js";
import { replaceImages } from "../../../../_utils/posts.js";
import { normalizeImage } from "../../../../_utils/sanitize.js";
export async function onRequestPut({ params, request, env }) {
  try {
    const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);
    const body = await readJson(request); const images = Array.isArray(body.images) ? body.images.map(normalizeImage) : [];
    await replaceImages(requireDatabase(env), id, images);
    return json({ id, images: images.length, message: "Imagens atualizadas." });
  } catch (error) { return handleError(error); }
}
