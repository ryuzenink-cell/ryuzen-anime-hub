import { json, handleError, readJson, requireDatabase, RequestError } from "../../../_utils/http.js";
import { validateBannerPayload, enforceSingleActiveBanner } from "../../../_utils/banners.js";
import { writeAudit } from "../../../_utils/auth.js";
export async function onRequestPut({ params, request, env }) {
  try { const id=Number(params.id); if(!Number.isInteger(id)||id<1) throw new RequestError("Identificador inválido.",400); const db=requireDatabase(env); const banner=validateBannerPayload(await readJson(request)); if(banner.status === "active") await enforceSingleActiveBanner(db,banner.placement,id); const result=await db.prepare(`UPDATE banners SET name=?, placement=?, image_url=?, alt_text=?, target_url=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(banner.name,banner.placement,banner.image_url,banner.alt_text,banner.target_url,banner.status,id).run(); if(!result.meta?.changes) throw new RequestError("Banner não encontrado.",404); await writeAudit(db,request,env,"banner.update","banner",id,{name:banner.name,placement:banner.placement,status:banner.status}); return json({id,message:"Banner atualizado."}); }
  catch(error){ return handleError(error); }
}
