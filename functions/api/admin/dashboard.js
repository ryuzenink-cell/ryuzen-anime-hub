import { json, handleError, requireDatabase } from "../../_utils/http.js";
export async function onRequestGet({ env }) {
  try {
    const db = requireDatabase(env);
    const [statusCounts, lastPublication, categories, banners, lastLogin, activity] = await Promise.all([
      db.prepare("SELECT status, COUNT(*) AS total FROM posts GROUP BY status").all(),
      db.prepare("SELECT id, title, slug, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC, id DESC LIMIT 1").first(),
      db.prepare("SELECT COUNT(*) AS total FROM categories").first(),
      db.prepare("SELECT COUNT(*) AS total FROM banners WHERE status = 'active'").first(),
      db.prepare("SELECT created_at FROM admin_audit_logs WHERE action = 'auth.login_success' ORDER BY created_at DESC LIMIT 1").first(),
      db.prepare("SELECT action, resource_type, resource_id, metadata_json, created_at FROM admin_audit_logs ORDER BY created_at DESC, id DESC LIMIT 10").all(),
    ]);
    const counts = { draft: 0, published: 0, archived: 0, scheduled: 0 };
    for (const row of statusCounts.results || []) counts[row.status] = Number(row.total || 0);
    return json({ counts, legacyStaticPosts: 3, lastPublication: lastPublication || null, categories: Number(categories?.total || 0), activeBanners: Number(banners?.total || 0), lastLoginAt: lastLogin?.created_at || null, activity: activity.results || [] });
  } catch (error) { return handleError(error); }
}
