import { json, handleError, requireDatabase } from "../../../_utils/http.js";
import { ensureStoreSchema } from "../../../_utils/store.js";
export async function onRequestGet({ env }) {
  try {
    const db=requireDatabase(env);
    await ensureStoreSchema(db);
    const [totals, popular, counts]=await Promise.all([
      db.prepare(`SELECT SUM(CASE WHEN destination_type='home_banner' THEN 1 ELSE 0 END) AS banner_clicks,SUM(CASE WHEN destination_type='store_product' THEN 1 ELSE 0 END) AS product_clicks FROM store_clicks`).first(),
      db.prepare(`SELECT p.id,p.name,COUNT(c.id) AS clicks FROM store_products p LEFT JOIN store_clicks c ON c.product_id=p.id GROUP BY p.id ORDER BY clicks DESC,p.name ASC LIMIT 5`).all(),
      db.prepare(`SELECT status, COUNT(*) AS total FROM store_products GROUP BY status`).all()
    ]);
    const products={draft:0,published:0,archived:0,total:0}; for(const row of counts.results||[]){ products[row.status]=Number(row.total||0); products.total+=Number(row.total||0); }
    return json({ totals: totals || {banner_clicks:0,product_clicks:0}, products, popular: popular.results || [] });
  } catch(error){ if(String(error?.message||"").includes("no such table")) return json({totals:{banner_clicks:0,product_clicks:0},products:{draft:0,published:0,archived:0,total:0},popular:[]}); return handleError(error); }
}
