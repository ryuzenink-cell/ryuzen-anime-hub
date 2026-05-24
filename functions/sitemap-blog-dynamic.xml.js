import { requireDatabase } from "./_utils/http.js";
function escapeXml(value = "") { return String(value).replace(/[<>&'\"]/g, (c) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '"':"&quot;" }[c])); }
export async function onRequestGet({ env }) {
  try {
    const result = await requireDatabase(env).prepare("SELECT slug, updated_at, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC").all();
    const urls = (result.results || []).map((post) => {
      const lastmod = String(post.updated_at || post.published_at || "").slice(0, 10);
      return `  <url>\n    <loc>https://anime.ryuzen.ink/blog/p/${escapeXml(post.slug)}/</loc>\n${lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>\n` : ""}    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    }).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
    return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', { headers: { "Content-Type": "application/xml; charset=utf-8" } });
  }
}
