import { json, handleError, requireDatabase, RequestError } from "../../../../../_utils/http.js";
import { validateStoredProductForPublishing } from "../../../../../_utils/store.js";
import { writeAudit } from "../../../../../_utils/auth.js";

export async function onRequestPost({ params, request, env }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);
    const db = requireDatabase(env);
    const stored = await db.prepare("SELECT * FROM store_products WHERE id = ? LIMIT 1").bind(id).first();
    const product = validateStoredProductForPublishing(stored);
    const result = await db.prepare("UPDATE store_products SET status='published', updated_at=CURRENT_TIMESTAMP, last_reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status<>'archived'").bind(id).run();
    if (!result.meta?.changes) throw new RequestError("Produto não encontrado ou arquivado.", 404);
    await writeAudit(db, request, env, "store.product.publish", "store_product", id, { name: product.name, status: "published" });
    return json({ id, status: "published", message: "Produto publicado." });
  } catch (error) {
    return handleError(error);
  }
}
