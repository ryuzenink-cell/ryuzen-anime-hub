import { json, handleError, requireDatabase, RequestError } from "../../../../_utils/http.js";
import { findPostForAdmin, slugify } from "../../../../_utils/posts.js";
import { writeAudit } from "../../../../_utils/auth.js";
async function freeSlug(db, base) {
  for (let i=1;i<=100;i+=1) { const candidate=i===1 ? `${base}-copia` : `${base}-copia-${i}`; const exists=await db.prepare("SELECT id FROM posts WHERE slug=?").bind(candidate).first(); if(!exists) return candidate; }
  throw new RequestError("Não foi possível gerar um slug livre para a cópia.",409);
}
export async function onRequestPost({ params, request, env }) {
  try {
    const id=Number(params.id); if(!Number.isInteger(id)||id<1) throw new RequestError("Identificador inválido.",400);
    const db=requireDatabase(env); const original=await findPostForAdmin(db,id); const newSlug=await freeSlug(db,slugify(original.slug || original.title));
    const created=await db.prepare(`INSERT INTO posts (title,slug,excerpt,content_markdown,content_html,status,author_name,category_id,cover_image_url,cover_alt,cover_credit,cover_source_url,social_image_url,seo_title,seo_description,canonical_url,featured,created_at,updated_at) VALUES (?,?,?,?,?,'draft',?,?,?,?,?,?,?,?,?,?,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`)
      .bind(`${original.title} (Cópia)`,newSlug,original.excerpt,original.content_markdown || "",original.content_html || "",original.author_name,original.category_id,original.cover_image_url,original.cover_alt,original.cover_credit,original.cover_source_url,original.social_image_url,original.seo_title ? `${original.seo_title} (revisar)` : "",original.seo_description || "",`https://anime.ryuzen.ink/blog/p/${newSlug}/`).first();
    await db.prepare("INSERT INTO post_tags (post_id,tag_id) SELECT ?,tag_id FROM post_tags WHERE post_id=?").bind(created.id,id).run();
    await db.prepare(`INSERT INTO post_images (post_id,image_url,alt_text,caption,credit_text,source_url,placement,position_order,created_at,updated_at) SELECT ?,image_url,alt_text,caption,credit_text,source_url,placement,position_order,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM post_images WHERE post_id=?`).bind(created.id,id).run();
    await writeAudit(db,request,env,"post.duplicate","post",created.id,{sourceId:id,slug:newSlug});
    return json({id:created.id,status:"draft",slug:newSlug,message:"Cópia criada como rascunho."},201);
  } catch(error){ return handleError(error); }
}
