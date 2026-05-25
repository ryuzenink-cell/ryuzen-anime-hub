import { json, handleError, readJson, requireDatabase, RequestError } from "../../../_utils/http.js";
import { slugify } from "../../../_utils/posts.js";
import { writeAudit } from "../../../_utils/auth.js";
export async function onRequestPut({ params, request, env }) {
  try { const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400); const body = await readJson(request); const name = String(body.name || "").trim().slice(0,50); const slug = slugify(body.slug || name); if (!name || !slug) throw new RequestError("Informe nome e slug válidos.", 400); const db = requireDatabase(env); const result = await db.prepare("UPDATE tags SET name = ?, slug = ? WHERE id = ?").bind(name, slug, id).run(); if (!result.meta?.changes) throw new RequestError("Tag não encontrada.",404); await writeAudit(db, request, env, "tag.update", "tag", id, { name, slug }); return json({ id, message:"Tag atualizada." }); }
  catch (error) { return handleError(error); }
}
