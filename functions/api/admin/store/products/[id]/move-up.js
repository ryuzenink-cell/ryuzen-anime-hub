import { json, handleError, requireDatabase, RequestError } from "../../../../../_utils/http.js";
import { writeAudit } from "../../../../../_utils/auth.js";
import { ensureStoreSchema } from "../../../../../_utils/store.js";
export async function onRequestPost({ params, request, env }) {
  try {
    const id=Number(params.id); if(!Number.isInteger(id)||id<1) throw new RequestError("Identificador inválido.",400);
    const db=requireDatabase(env); await ensureStoreSchema(db); const rows=(await db.prepare("SELECT id,name FROM store_products ORDER BY sort_order ASC,id ASC").all()).results||[];
    const index=rows.findIndex((row)=>Number(row.id)===id); if(index<0) throw new RequestError("Produto não encontrado.",404); if(index===0) return json({id,moved:false,message:"Este produto já está no início."});
    [rows[index-1],rows[index]]=[rows[index],rows[index-1]]; await db.batch(rows.map((row,position)=>db.prepare("UPDATE store_products SET sort_order=?,updated_at=CASE WHEN id=? THEN CURRENT_TIMESTAMP ELSE updated_at END WHERE id=?").bind((position+1)*10,id,row.id)));
    await writeAudit(db,request,env,"store.product.move_up","store_product",id,{name:rows[index-1].name}); return json({id,moved:true,message:"Produto movido para cima."});
  } catch(error){ return handleError(error); }
}
