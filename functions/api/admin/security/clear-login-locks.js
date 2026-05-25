import { json, handleError, requireDatabase } from "../../../_utils/http.js";
import { writeAudit } from "../../../_utils/auth.js";
export async function onRequestPost({ request, env }) {
  try { const db=requireDatabase(env); const result=await db.prepare("DELETE FROM admin_login_locks").run(); await writeAudit(db,request,env,"security.clear_login_locks","admin",null,{cleared:Number(result.meta?.changes || 0)}); return json({message:"Bloqueios temporários removidos.",cleared:Number(result.meta?.changes || 0)}); }
  catch(error){ return handleError(error); }
}
