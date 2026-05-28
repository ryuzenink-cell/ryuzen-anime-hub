import { json, handleError, parseInteger, readJson, requireDatabase } from "../../../_utils/http.js";
import { replaceImages, replaceTags, validatePostPayload } from "../../../_utils/posts.js";
import { writeAudit } from "../../../_utils/auth.js";
export async function onRequestGet({ request, env }) {
  try {
    const db = requireDatabase(env); const url = new URL(request.url);
    const status = url.searchParams.get("status") || ""; const search = `%${String(url.searchParams.get("q") || "").slice(0,100)}%`;
    const category = Number(url.searchParams.get("category") || 0); const tag = String(url.searchParams.get("tag") || "").slice(0,50);
    const seo = url.searchParams.get("seo") || ""; const cover = url.searchParams.get("cover") || ""; const order = url.searchParams.get("order") || "updated_desc";
    const page=parseInteger(url.searchParams.get("page"),1,1,10000); const limit=parseInteger(url.searchParams.get("limit"),30,1,100);
    const conditions=["p.title LIKE ?"]; const bindings=[search];
    if (["draft","published","archived","scheduled"].includes(status)) { conditions.push("p.status = ?"); bindings.push(status); }
    if (Number.isInteger(category) && category > 0) { conditions.push("p.category_id = ?"); bindings.push(category); }
    if (tag) { conditions.push("EXISTS (SELECT 1 FROM post_tags px INNER JOIN tags tx ON tx.id=px.tag_id WHERE px.post_id=p.id AND tx.slug=?)"); bindings.push(tag); }
    if (seo === "missing") conditions.push("(COALESCE(p.seo_title,'') = '' OR COALESCE(p.seo_description,'') = '' OR COALESCE(p.cover_alt,'') = '' OR COALESCE(p.content_html,'') = '' OR p.category_id IS NULL)");
    if (cover === "missing") conditions.push("COALESCE(p.cover_image_url,'') = ''");
    const orderMap={updated_desc:"p.updated_at DESC, p.id DESC",published_desc:"p.published_at DESC, p.id DESC",title_asc:"p.title ASC",title_desc:"p.title DESC",oldest:"p.created_at ASC, p.id ASC"};
    const result=await db.prepare(`SELECT p.id,p.title,p.slug,p.status,p.updated_at,p.published_at,p.created_at,p.category_id,p.cover_image_url,p.cover_alt,p.seo_title,p.seo_description,p.content_html,c.name AS category_name, GROUP_CONCAT(DISTINCT t.name) AS tags_csv FROM posts p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN post_tags pt ON pt.post_id=p.id LEFT JOIN tags t ON t.id=pt.tag_id WHERE ${conditions.join(" AND ")} GROUP BY p.id ORDER BY ${orderMap[order] || orderMap.updated_desc} LIMIT ? OFFSET ?`).bind(...bindings,limit,(page-1)*limit).all();
    const posts=(result.results||[]).map((p)=>({...p,tags:p.tags_csv ? p.tags_csv.split(",") : [],seo_incomplete:!p.seo_title || !p.seo_description || !p.cover_alt || !p.content_html || !p.category_id}));
    return json({posts});
  } catch(error){ return handleError(error); }
}
export async function onRequestPost({ request, env }) {
  try { const db=requireDatabase(env); const payload=validatePostPayload(await readJson(request)); const result=await db.prepare(`INSERT INTO posts (title,slug,excerpt,content_markdown,content_html,status,author_name,category_id,cover_image_url,cover_alt,cover_credit,cover_source_url,social_image_url,seo_title,seo_description,canonical_url,featured,created_at,updated_at) VALUES (?,?,?,?,?,'draft',?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`).bind(payload.title,payload.slug,payload.excerpt,payload.content_markdown,payload.content_html,payload.author_name,payload.category_id,payload.cover_image_url,payload.cover_alt,payload.cover_credit,payload.cover_source_url,payload.social_image_url,payload.seo_title,payload.seo_description,payload.canonical_url,0).first(); await replaceTags(db,result.id,payload.tags); await replaceImages(db,result.id,payload.images); await writeAudit(db,request,env,"post.create_draft","post",result.id,{slug:payload.slug}); return json({id:result.id,status:"draft",message:"Rascunho salvo com sucesso."},201); }
  catch(error){ return handleError(error); }
}
