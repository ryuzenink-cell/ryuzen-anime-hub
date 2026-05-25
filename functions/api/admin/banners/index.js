import { json, handleError, readJson, requireDatabase } from "../../../_utils/http.js";
import { validateBannerPayload, enforceSingleActiveBanner } from "../../../_utils/banners.js";
import { writeAudit } from "../../../_utils/auth.js";
export async function onRequestGet({ request, env }) {
  try { const url = new URL(request.url); const placement = String(url.searchParams.get("placement") || ""); const status = String(url.searchParams.get("status") || ""); const cond = []; const args=[]; if (placement) {cond.push("placement = ?"); args.push(placement);} if(status){cond.push("status = ?"); args.push(status);} const where=cond.length ? `WHERE ${cond.join(" AND ")}` : ""; const result=await requireDatabase(env).prepare(`SELECT * FROM banners ${where} ORDER BY updated_at DESC, id DESC`).bind(...args).all(); return json({ banners: result.results || [] }); }
  catch(error){ return handleError(error); }
}
export async function onRequestPost({ request, env }) {
  try { const db=requireDatabase(env); const banner=validateBannerPayload(await readJson(request)); if(banner.status === "active") await enforceSingleActiveBanner(db,banner.placement); const created=await db.prepare(`INSERT INTO banners (name, placement, image_url, alt_text, target_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`).bind(banner.name,banner.placement,banner.image_url,banner.alt_text,banner.target_url,banner.status).first(); await writeAudit(db,request,env,"banner.create","banner",created.id,{name:banner.name,placement:banner.placement,status:banner.status}); return json({id:created.id,message:"Banner criado."},201); }
  catch(error){ return handleError(error); }
}
