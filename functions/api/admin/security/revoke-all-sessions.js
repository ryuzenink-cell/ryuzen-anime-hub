import { json, handleError, requireDatabase } from "../../../_utils/http.js";
import { clearSessionCookie, writeAudit } from "../../../_utils/auth.js";
export async function onRequestPost({ request, env }) {
  try { const db=requireDatabase(env); await db.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE revoked_at IS NULL").run(); await writeAudit(db,request,env,"security.revoke_all_sessions","admin"); return json({message:"Todas as sessões foram encerradas."},200,{"Set-Cookie":clearSessionCookie(request)}); }
  catch(error){ return handleError(error); }
}
