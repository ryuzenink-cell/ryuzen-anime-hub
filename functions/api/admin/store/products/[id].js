import { json, handleError, readJson, requireDatabase, RequestError } from "../../../../_utils/http.js";
import { validateProductPayload } from "../../../../_utils/store.js";
import { writeAudit } from "../../../../_utils/auth.js";
export async function onRequestPut({ params, request, env }) {
  try {
    const id = Number(params.id); if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador inválido.",400);
    const db = requireDatabase(env); const p = validateProductPayload(await readJson(request));
    const result = await db.prepare(`UPDATE store_products SET name=?,category=?,description=?,affiliate_url=?,asin=?,related_title=?,badge=?,image_url=?,image_alt=?,status=?,is_featured=?,sort_order=?,internal_notes=?,updated_at=CURRENT_TIMESTAMP,last_reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(p.name,p.category,p.description,p.affiliate_url,p.asin,p.related_title,p.badge,p.image_url,p.image_alt,p.status,p.is_featured,p.sort_order,p.internal_notes,id).run();
    if (!result.meta?.changes) throw new RequestError("Produto não encontrado.",404);
    await writeAudit(db,request,env,"store.product.update","store_product",id,{name:p.name,status:p.status});
    return json({ id, message: "Produto atualizado." });
  } catch (error) { return handleError(error); }
}
