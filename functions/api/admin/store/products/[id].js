import { json, handleError, readJson, requireDatabase, RequestError } from "../../../../_utils/http.js";
import { ensureStoreSchema, getStoreCapabilities, validateProductPayload } from "../../../../_utils/store.js";
import { writeAudit } from "../../../../_utils/auth.js";

export async function onRequestPut({ params, request, env }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.", 400);

    const db = requireDatabase(env);
    await ensureStoreSchema(db);
    const capabilities = await getStoreCapabilities(db);
    const product = validateProductPayload(await readJson(request));

    const statement = capabilities.linkReview
      ? `UPDATE store_products SET name=?,category=?,description=?,
        link_review_status=CASE WHEN affiliate_url<>? THEN 'not_reviewed' ELSE link_review_status END,
        affiliate_url=?,asin=?,related_title=?,badge=?,image_url=?,image_alt=?,status=?,is_featured=?,sort_order=?,
        internal_notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
      : `UPDATE store_products SET name=?,category=?,description=?,
        affiliate_url=?,asin=?,related_title=?,badge=?,image_url=?,image_alt=?,status=?,is_featured=?,sort_order=?,
        internal_notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`;

    const values = capabilities.linkReview
      ? [product.name, product.category, product.description, product.affiliate_url, product.affiliate_url, product.asin,
        product.related_title, product.badge, product.image_url, product.image_alt, product.status, product.is_featured,
        product.sort_order, product.internal_notes, id]
      : [product.name, product.category, product.description, product.affiliate_url, product.asin, product.related_title,
        product.badge, product.image_url, product.image_alt, product.status, product.is_featured, product.sort_order,
        product.internal_notes, id];

    const result = await db.prepare(statement).bind(...values).run();
    if (!result.meta?.changes) throw new RequestError("Produto não encontrado.", 404);

    await writeAudit(db, request, env, "store.product.update", "store_product", id, { name: product.name, status: product.status });
    return json({ id, message: "Produto atualizado." });
  } catch (error) {
    return handleError(error);
  }
}
