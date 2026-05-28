import { json, handleError, readJson, requireDatabase, RequestError } from "../../../../../_utils/http.js";
import { writeAudit } from "../../../../../_utils/auth.js";
import { ensureStoreSchema, getStoreCapabilities } from "../../../../../_utils/store.js";

export async function onRequestPost({ params, request, env }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);

    const body = await readJson(request).catch(() => ({}));
    const status = String(body.status || "reviewed");
    if (!["reviewed", "needs_check", "not_reviewed"].includes(status)) {
      throw new RequestError("Status de revisão inválido.", 400);
    }

    const db = requireDatabase(env);
    await ensureStoreSchema(db);
    const capabilities = await getStoreCapabilities(db);
    if (!capabilities.linkReview) {
      throw new RequestError("Revisão de links indisponível até aplicar a migration 0005 no banco D1.", 409);
    }

    const result = await db.prepare(`UPDATE store_products SET link_review_status=?,
      last_reviewed_at=CASE WHEN ?='reviewed' THEN CURRENT_TIMESTAMP ELSE last_reviewed_at END,
      updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status, status, id).run();
    if (!result.meta?.changes) throw new RequestError("Produto não encontrado.", 404);

    await writeAudit(db, request, env, "store.product.link_review", "store_product", id, { status });
    return json({ id, status, message: status === "reviewed" ? "Link revisado hoje." : "Status de revisão atualizado." });
  } catch (error) {
    return handleError(error);
  }
}
