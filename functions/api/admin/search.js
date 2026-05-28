import { json, handleError, requireDatabase, RequestError } from "../../_utils/http.js";
import { ensureStoreSchema } from "../../_utils/store.js";
export async function onRequestGet({ request, env }) {
  try {
    const q = String(new URL(request.url).searchParams.get("q") || "").trim().slice(0, 80);
    if (q.length < 2) throw new RequestError("Digite ao menos dois caracteres.", 400);
    const db = requireDatabase(env); const like = `%${q}%`; await ensureStoreSchema(db);
    const [posts, products, categories, tags, banners] = await Promise.all([
      db.prepare("SELECT id,title,status FROM posts WHERE title LIKE ? ORDER BY updated_at DESC LIMIT 5").bind(like).all(),
      db.prepare("SELECT id,name,status FROM store_products WHERE name LIKE ? ORDER BY updated_at DESC LIMIT 5").bind(like).all(),
      db.prepare("SELECT c.id,c.name,COUNT(p.id) AS total FROM categories c LEFT JOIN posts p ON p.category_id=c.id WHERE c.name LIKE ? GROUP BY c.id ORDER BY c.name LIMIT 5").bind(like).all(),
      db.prepare("SELECT t.id,t.name,COUNT(pt.post_id) AS total FROM tags t LEFT JOIN post_tags pt ON pt.tag_id=t.id WHERE t.name LIKE ? GROUP BY t.id ORDER BY t.name LIMIT 5").bind(like).all(),
      db.prepare("SELECT id,name,placement,status FROM banners WHERE name LIKE ? ORDER BY updated_at DESC LIMIT 5").bind(like).all(),
    ]);
    const groups = [
      { label: "Posts", items: (posts.results || []).map((p) => ({ title: p.title, meta: p.status, url: `/admin/blog/editar/?id=${p.id}` })) },
      { label: "Loja", items: (products.results || []).map((p) => ({ title: p.name, meta: p.status, url: "/admin/loja/" })) },
      { label: "Categorias", items: (categories.results || []).map((c) => ({ title: c.name, meta: `${c.total || 0} posts`, url: "/admin/taxonomias/" })) },
      { label: "Tags", items: (tags.results || []).map((t) => ({ title: t.name, meta: `${t.total || 0} posts`, url: "/admin/taxonomias/" })) },
      { label: "Banners", items: (banners.results || []).map((b) => ({ title: b.name, meta: `${b.placement} · ${b.status}`, url: "/admin/banners/" })) },
    ].filter((group) => group.items.length);
    return json({ results: groups });
  } catch (error) { return handleError(error); }
}
