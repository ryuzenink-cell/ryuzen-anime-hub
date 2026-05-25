import { json, handleError, readJson, requireDatabase, RequestError } from "../../../_utils/http.js";
import { slugify } from "../../../_utils/posts.js";
import { writeAudit } from "../../../_utils/auth.js";
const text = (value, max) => String(value || "").trim().slice(0, max);
export async function onRequestPut({ params, request, env }) {
  try {
    const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);
    const body = await readJson(request); const name = text(body.name, 80); const slug = slugify(body.slug || name); const description = text(body.description, 300);
    if (!name || !slug) throw new RequestError("Informe nome e slug válidos.", 400);
    const db = requireDatabase(env); const result = await db.prepare("UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?").bind(name, slug, description, id).run();
    if (!result.meta?.changes) throw new RequestError("Categoria não encontrada.", 404);
    await writeAudit(db, request, env, "category.update", "category", id, { name, slug }); return json({ id, message: "Categoria atualizada." });
  } catch (error) { return handleError(error); }
}
