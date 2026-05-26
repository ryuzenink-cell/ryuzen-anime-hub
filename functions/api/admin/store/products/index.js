import { json, handleError, readJson, requireDatabase } from "../../../../_utils/http.js";
import { ensureStoreSchema, validateProductPayload, STORE_CATEGORIES, STORE_BADGES } from "../../../../_utils/store.js";
import { writeAudit } from "../../../../_utils/auth.js";
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url); const status = String(url.searchParams.get("status") || ""); const category = String(url.searchParams.get("category") || ""); const q = `%${String(url.searchParams.get("q") || "").trim().slice(0,100)}%`;
    const conditions = ["name LIKE ?"]; const values = [q];
    if (["draft","published","archived"].includes(status)) { conditions.push("status=?"); values.push(status); }
    if (STORE_CATEGORIES.includes(category)) { conditions.push("category=?"); values.push(category); }
    const db = requireDatabase(env); await ensureStoreSchema(db);
    const result = await db.prepare(`SELECT * FROM store_products WHERE ${conditions.join(" AND ")} ORDER BY sort_order ASC, updated_at DESC, id DESC`).bind(...values).all();
    return json({ products: result.results || [], categories: STORE_CATEGORIES, badges: STORE_BADGES });
  } catch (error) { return handleError(error); }
}
export async function onRequestPost({ request, env }) {
  try {
    const db = requireDatabase(env); await ensureStoreSchema(db); const p = validateProductPayload(await readJson(request));
    const created = await db.prepare(`INSERT INTO store_products (name,category,description,affiliate_url,asin,related_title,badge,image_url,image_alt,status,is_featured,sort_order,internal_notes,created_at,updated_at,last_reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`).bind(p.name,p.category,p.description,p.affiliate_url,p.asin,p.related_title,p.badge,p.image_url,p.image_alt,p.status,p.is_featured,p.sort_order,p.internal_notes).first();
    await writeAudit(db,request,env,"store.product.create","store_product",created.id,{name:p.name,status:p.status});
    return json({ id: created.id, message: "Produto salvo." }, 201);
  } catch (error) { return handleError(error); }
}
