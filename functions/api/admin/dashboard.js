import { json, handleError, requireDatabase } from "../../_utils/http.js";
import { ensureStoreSchema } from "../../_utils/store.js";
export async function onRequestGet({ env }) {
  try {
    const db = requireDatabase(env); await ensureStoreSchema(db);
    const [statusCounts, lastPublication, categories, banners, lastLogin, activity, editorialPending, featuredPost, storeCounts, storeBanner, storeClicks, topProduct, latestProduct, storePending, recentPosts, recentProducts, recentBanner] = await Promise.all([
      db.prepare("SELECT status, COUNT(*) AS total FROM posts GROUP BY status").all(),
      db.prepare("SELECT id,title,slug,published_at FROM posts WHERE status='published' ORDER BY published_at DESC,id DESC LIMIT 1").first(),
      db.prepare("SELECT COUNT(*) AS total FROM categories").first(),
      db.prepare("SELECT COUNT(*) AS total FROM banners WHERE status='active'").first(),
      db.prepare("SELECT created_at FROM admin_audit_logs WHERE action='auth.login_success' ORDER BY created_at DESC LIMIT 1").first(),
      db.prepare("SELECT action,resource_type,resource_id,metadata_json,created_at FROM admin_audit_logs ORDER BY created_at DESC,id DESC LIMIT 10").all(),
      db.prepare(`SELECT id,title,status,category_id,cover_image_url,social_image_url,seo_title,seo_description,content_html FROM posts WHERE status IN ('draft','published') ORDER BY updated_at DESC LIMIT 80`).all(),
      db.prepare("SELECT id,title,slug FROM posts WHERE status='published' AND featured=1 ORDER BY updated_at DESC LIMIT 1").first(),
      db.prepare("SELECT status,COUNT(*) AS total FROM store_products GROUP BY status").all(),
      db.prepare("SELECT enabled,status FROM store_home_banner WHERE id=1").first(),
      db.prepare("SELECT COUNT(*) AS total FROM store_clicks WHERE clicked_at >= datetime('now','-7 days')").first(),
      db.prepare("SELECT p.id,p.name,COUNT(c.id) AS clicks FROM store_products p LEFT JOIN store_clicks c ON c.product_id=p.id AND c.clicked_at >= datetime('now','-7 days') WHERE p.status='published' GROUP BY p.id ORDER BY clicks DESC,p.name ASC LIMIT 1").first(),
      db.prepare("SELECT id,name,updated_at FROM store_products ORDER BY updated_at DESC,id DESC LIMIT 1").first(),
      db.prepare("SELECT id,name,status,image_url,image_alt,last_reviewed_at,link_review_status FROM store_products WHERE status IN ('draft','published') ORDER BY updated_at DESC LIMIT 80").all(),
      db.prepare("SELECT id,title,updated_at,status FROM posts ORDER BY updated_at DESC,id DESC LIMIT 4").all(),
      db.prepare("SELECT id,name,updated_at,status FROM store_products ORDER BY updated_at DESC,id DESC LIMIT 3").all(),
      db.prepare("SELECT id,name,updated_at,status FROM banners ORDER BY updated_at DESC,id DESC LIMIT 1").first(),
    ]);
    const counts = { draft: 0, published: 0, archived: 0, scheduled: 0 }; for (const row of statusCounts.results || []) counts[row.status] = Number(row.total || 0);
    const products = { draft: 0, published: 0, archived: 0 }; for (const row of storeCounts.results || []) products[row.status] = Number(row.total || 0);
    const pending = [];
    for (const p of editorialPending.results || []) {
      if (p.status === 'draft') pending.push({ level:'attention', title:`Rascunho: ${p.title}`, action:'Editar post', url:`/admin/blog/editar/?id=${p.id}` });
      if (!p.cover_image_url) pending.push({ level:'attention', title:`Post sem capa: ${p.title}`, action:'Adicionar capa', url:`/admin/blog/editar/?id=${p.id}` });
      if (!p.social_image_url || !p.seo_title || !p.seo_description) pending.push({ level:'recommendation', title:`SEO/social incompleto: ${p.title}`, action:'Revisar SEO', url:`/admin/blog/editar/?id=${p.id}` });
      if (p.status === 'published' && !p.category_id) pending.push({ level:'attention', title:`Publicado sem categoria: ${p.title}`, action:'Categorizar', url:`/admin/blog/editar/?id=${p.id}` });
    }
    for (const p of storePending.results || []) {
      if (p.status === 'draft') pending.push({ level:'attention', title:`Produto em rascunho: ${p.name}`, action:'Abrir Loja', url:'/admin/loja/' });
      if (!p.image_url || !p.image_alt) pending.push({ level:'critical', title:`Produto sem imagem acessível: ${p.name}`, action:'Corrigir produto', url:'/admin/loja/' });
      if (p.status === 'published' && (p.link_review_status !== 'reviewed' || !p.last_reviewed_at || new Date(`${p.last_reviewed_at.replace(' ','T')}Z`) < new Date(Date.now() - 30*864e5))) pending.push({ level:'attention', title:`Revisar link afiliado: ${p.name}`, action:'Revisar link', url:'/admin/loja/' });
    }
    if (!storeBanner || !storeBanner.enabled || storeBanner.status !== 'active') pending.push({ level:'recommendation', title:'Banner da Loja está inativo', action:'Configurar banner', url:'/admin/loja/' });
    return json({ counts, legacyStaticPosts: 3, lastPublication: lastPublication || null, categories: Number(categories?.total || 0), activeBanners: Number(banners?.total || 0), publishedStoreProducts: products.published, lastLoginAt: lastLogin?.created_at || null, activity: activity.results || [], pending: pending.slice(0,18), featuredPost: featuredPost || null, storeSummary: { products, bannerActive: Boolean(storeBanner?.enabled && storeBanner?.status === 'active'), clicks7days: Number(storeClicks?.total || 0), topProduct: topProduct?.clicks ? topProduct : null, latestProduct: latestProduct || null }, recent: { posts: recentPosts.results || [], products: recentProducts.results || [], banner: recentBanner || null } });
  } catch (error) { return handleError(error); }
}
