import { json, handleError, readJson, requireDatabase, RequestError } from "../../_utils/http.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const type = String(body.destination_type || "");
    const source = String(body.source || "");
    if (type === "home_banner") {
      if (source !== "home") throw new RequestError("Clique inválido.", 400);
      await requireDatabase(env).prepare("INSERT INTO store_clicks (destination_type, product_id, source) VALUES ('home_banner', NULL, 'home')").run();
      return json({ recorded: true }, 201);
    }
    if (type !== "store_product" || source !== "loja") throw new RequestError("Clique inválido.", 400);
    const productId = Number(body.product_id);
    if (!Number.isInteger(productId) || productId < 1) throw new RequestError("Clique inválido.", 400);
    const db = requireDatabase(env);
    const published = await db.prepare("SELECT id FROM store_products WHERE id = ? AND status = 'published' LIMIT 1").bind(productId).first();
    if (!published) return json({ recorded: false }, 202);
    await db.prepare("INSERT INTO store_clicks (destination_type, product_id, source) VALUES ('store_product', ?, 'loja')").bind(productId).run();
    return json({ recorded: true }, 201);
  } catch (error) {
    if (String(error?.message || "").includes("no such table")) return json({ recorded: false }, 202);
    return handleError(error);
  }
}
