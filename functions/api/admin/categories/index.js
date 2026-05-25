import { json, handleError, readJson, requireDatabase, RequestError } from "../../../_utils/http.js";
import { slugify } from "../../../_utils/posts.js";
import { writeAudit } from "../../../_utils/auth.js";
const text = (value, max) => String(value || "").trim().slice(0, max);
export async function onRequestGet({ env }) {
  try { const result = await requireDatabase(env).prepare(`SELECT c.id, c.name, c.slug, c.description, COUNT(p.id) AS posts_count FROM categories c LEFT JOIN posts p ON p.category_id = c.id GROUP BY c.id ORDER BY c.name`).all(); return json({ categories: result.results || [] }); }
  catch (error) { return handleError(error); }
}
export async function onRequestPost({ request, env }) {
  try {
    const db = requireDatabase(env); const body = await readJson(request); const name = text(body.name, 80); const slug = slugify(body.slug || name); const description = text(body.description, 300);
    if (!name || !slug) throw new RequestError("Informe nome e slug válidos.", 400);
    const result = await db.prepare("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?) RETURNING id").bind(name, slug, description).first();
    await writeAudit(db, request, env, "category.create", "category", result.id, { name, slug });
    return json({ id: result.id, message: "Categoria criada." }, 201);
  } catch (error) { return handleError(error); }
}
