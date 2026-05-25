import { json, handleError, readJson, requireDatabase, RequestError } from "../../../_utils/http.js";
import { slugify } from "../../../_utils/posts.js";
import { writeAudit } from "../../../_utils/auth.js";
const text = (value, max) => String(value || "").trim().slice(0, max);
export async function onRequestGet({ request, env }) {
  try { const q = `%${text(new URL(request.url).searchParams.get("q"), 60)}%`; const result = await requireDatabase(env).prepare(`SELECT t.id, t.name, t.slug, COUNT(pt.post_id) AS posts_count FROM tags t LEFT JOIN post_tags pt ON pt.tag_id = t.id WHERE t.name LIKE ? OR t.slug LIKE ? GROUP BY t.id ORDER BY t.name`).bind(q, q).all(); return json({ tags: result.results || [] }); }
  catch (error) { return handleError(error); }
}
export async function onRequestPost({ request, env }) {
  try { const db = requireDatabase(env); const body = await readJson(request); const name = text(body.name, 50); const slug = slugify(body.slug || name); if (!name || !slug) throw new RequestError("Informe nome e slug válidos.", 400); const result = await db.prepare("INSERT INTO tags (name, slug) VALUES (?, ?) RETURNING id").bind(name, slug).first(); await writeAudit(db, request, env, "tag.create", "tag", result.id, { name, slug }); return json({ id: result.id, message: "Tag criada." }, 201); }
  catch (error) { return handleError(error); }
}
