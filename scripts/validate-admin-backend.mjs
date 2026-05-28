import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { onRequestGet as getDashboard } from "../functions/api/admin/dashboard.js";
import { onRequestGet as listProducts } from "../functions/api/admin/store/products/index.js";
import { onRequestPut as updateProduct } from "../functions/api/admin/store/products/[id].js";
import { onRequestPost as reviewLink } from "../functions/api/admin/store/products/[id]/mark-link-reviewed.js";
import { onRequestGet as exportEditorial } from "../functions/api/admin/export/editorial.js";
import { onRequestGet as searchAdmin } from "../functions/api/admin/search.js";
import { onRequestPost as featurePost } from "../functions/api/admin/posts/[id]/feature.js";
import { onRequestPost as restoreRevision } from "../functions/api/admin/posts/[id]/revisions/[revisionId]/restore.js";
import { ensureStoreSchema, getStoreCapabilities } from "../functions/_utils/store.js";
import { createAdminSession } from "../functions/_utils/auth.js";
import { onRequest as adminApiMiddleware } from "../functions/api/admin/_middleware.js";
import { onRequest as adminPageMiddleware } from "../functions/_middleware.js";
import { onRequestPost as createProduct } from "../functions/api/admin/store/products/index.js";
import { onRequestPost as publishProduct } from "../functions/api/admin/store/products/[id]/publish.js";
import { onRequestPost as unpublishProduct } from "../functions/api/admin/store/products/[id]/unpublish.js";
import { onRequestPost as archiveProduct } from "../functions/api/admin/store/products/[id]/archive.js";
import { onRequestPost as moveProductUp } from "../functions/api/admin/store/products/[id]/move-up.js";
import { onRequestPost as moveProductDown } from "../functions/api/admin/store/products/[id]/move-down.js";
import { onRequestGet as storeMetrics } from "../functions/api/admin/store/metrics.js";
import { onRequestPut as saveStoreBanner } from "../functions/api/admin/store/banner/index.js";
import { onRequestPost as createCategory } from "../functions/api/admin/categories/index.js";
import { onRequestPut as updateCategory } from "../functions/api/admin/categories/[id].js";
import { onRequestPost as createTag } from "../functions/api/admin/tags/index.js";
import { onRequestPut as updateTag } from "../functions/api/admin/tags/[id].js";
import { onRequestPost as createBanner } from "../functions/api/admin/banners/index.js";
import { onRequestPut as updateBanner } from "../functions/api/admin/banners/[id].js";
import { onRequestPost as activateBanner } from "../functions/api/admin/banners/[id]/activate.js";
import { onRequestPost as deactivateBanner } from "../functions/api/admin/banners/[id]/deactivate.js";
import { onRequestPost as archiveBanner } from "../functions/api/admin/banners/[id]/archive.js";
import { onRequestPost as createPost, onRequestGet as listPosts } from "../functions/api/admin/posts/index.js";
import { onRequestPost as publishPost } from "../functions/api/admin/posts/[id]/publish.js";
import { onRequestPost as duplicatePost } from "../functions/api/admin/posts/[id]/duplicate.js";
import { onRequestPost as archivePost } from "../functions/api/admin/posts/[id]/archive.js";
import { onRequestPut as updatePostImages } from "../functions/api/admin/posts/[id]/images.js";
import { onRequestGet as publicProducts } from "../functions/api/store/products.js";
import { onRequestGet as publicStoreBanner } from "../functions/api/store/banner.js";
import { onRequestPost as recordStoreClick } from "../functions/api/store/click.js";
import { onRequestGet as publicPosts } from "../functions/api/posts/index.js";
import { onRequestGet as publicPost } from "../functions/api/posts/[slug].js";
import { onRequestGet as publicBanners } from "../functions/api/banners.js";
import { onRequestGet as publicCategories } from "../functions/api/categories.js";


const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const failures = [];
const expect = (value, message) => { if (!value) failures.push(message); };

class D1Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.values = [];
  }
  bind(...values) {
    this.values = values;
    return this;
  }
  async all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }
  async first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}

class TestD1 {
  constructor() {
    this.database = new DatabaseSync(":memory:");
  }
  prepare(sql) {
    return new D1Statement(this.database, sql);
  }
  async batch(statements) {
    this.database.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
  exec(sql) {
    this.database.exec(sql);
  }
}

function buildDatabase({ operationsUpgrade = false } = {}) {
  const db = new TestD1();
  db.exec(read("migrations/0000_fresh_blog_schema_reference.sql"));
  db.exec(read("migrations/0002_admin_auth_security.sql"));
  db.exec(read("migrations/0003_admin_dashboard_banners_taxonomies.sql"));
  db.exec(read("migrations/0004_store_ryuzen.sql"));
  if (operationsUpgrade) db.exec(read("migrations/0005_admin_operations_upgrade.sql"));

  db.exec(`INSERT INTO posts
    (title,slug,excerpt,content_html,status,category_id,cover_image_url,cover_alt,social_image_url,seo_title,seo_description,featured,published_at)
    VALUES ('Artigo publicado','artigo-publicado','Resumo','<h2>Conteúdo</h2>','published',1,'https://example.com/capa.jpg','Capa','https://example.com/social.jpg','SEO','Descrição',0,CURRENT_TIMESTAMP);
    INSERT INTO posts
    (title,slug,excerpt,content_html,status,category_id,featured)
    VALUES ('Rascunho editorial','rascunho','Resumo','','draft',NULL,0);
    INSERT INTO post_revisions (post_id,title,excerpt,content_markdown,revision_note)
    VALUES (1,'Versão anterior','Resumo antigo','<h2>Versão restaurada</h2>','Revisão de teste');
    INSERT INTO banners (name,placement,image_url,alt_text,target_url,status)
    VALUES ('Banner teste','blog_sidebar_left','https://example.com/banner.jpg','Banner','https://example.com','active');
    INSERT INTO store_products
    (name,category,description,affiliate_url,image_url,image_alt,status,sort_order,last_reviewed_at)
    VALUES ('Mangá teste','manga','Descrição','https://www.amazon.com.br/dp/B000000000','https://example.com/manga.jpg','Capa','published',10,datetime('now','-40 days'));
    INSERT INTO store_clicks (destination_type,product_id,source) VALUES ('store_product',1,'loja');
    INSERT INTO admin_audit_logs (action,resource_type,resource_id,created_at)
    VALUES ('auth.login_success','auth',NULL,CURRENT_TIMESTAMP);`);
  return db;
}

function envFor(db) {
  return { BLOG_DB: db, SESSION_SECRET: "integration-test-session-secret" };
}
function request(path, method = "GET", body = undefined) {
  return new Request(`https://anime.ryuzen.ink${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json", "User-Agent": "integration-test" } : { "User-Agent": "integration-test" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function body(response) {
  return response.json();
}

const autoSchemaA = new TestD1();
const autoSchemaB = new TestD1();
await ensureStoreSchema(autoSchemaA);
await ensureStoreSchema(autoSchemaB);
const tableA = await autoSchemaA.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='store_products'").first();
const tableB = await autoSchemaB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='store_products'").first();
expect(Boolean(tableA && tableB), "Inicialização da Loja deve ocorrer para cada binding D1, não apenas para o primeiro isolate.");
expect((await getStoreCapabilities(autoSchemaA)).linkReview === false, "Inicialização base não deve executar migration 0005 implicitamente.");

const beforeMigration = buildDatabase();
const beforeEnv = envFor(beforeMigration);

let response = await getDashboard({ env: beforeEnv });
let data = await body(response);
expect(response.status === 200, "Dashboard deve funcionar mesmo antes da migration 0005.");
expect(data.storeSummary?.capabilities?.linkReview === false, "Dashboard deve informar revisão de links indisponível antes da migration.");
expect(data.pending?.some((item) => item.title.includes("migration 0005")), "Dashboard deve orientar sobre a migration pendente.");

response = await listProducts({ request: request("/api/admin/store/products"), env: beforeEnv });
data = await body(response);
expect(response.status === 200, "Listagem da Loja deve funcionar antes da migration 0005.");
expect(data.capabilities?.linkReview === false, "Listagem deve expor capacidade de revisão desabilitada sem quebrar.");
expect(data.products?.[0]?.link_review_status === "not_reviewed", "Listagem deve fornecer status compatível sem a coluna nova.");

const productPayload = {
  name: "Mangá atualizado",
  category: "manga",
  description: "Descrição atualizada",
  affiliate_url: "https://www.amazon.com.br/dp/B000000001",
  image_url: "https://example.com/manga-nova.jpg",
  image_alt: "Nova capa",
  status: "published",
  sort_order: 10,
};
response = await updateProduct({ params: { id: "1" }, request: request("/api/admin/store/products/1", "PUT", productPayload), env: beforeEnv });
expect(response.status === 200, "Atualização de produto não deve falhar antes da migration 0005.");

response = await exportEditorial({ env: beforeEnv });
data = await body(response);
expect(response.status === 200, "Exportação editorial deve funcionar antes da migration 0005.");
expect(data.capabilities?.store_link_review === false, "Backup deve registrar capacidade de revisão ainda indisponível.");

response = await reviewLink({ params: { id: "1" }, request: request("/api/admin/store/products/1/mark-link-reviewed", "POST", { status: "reviewed" }), env: beforeEnv });
data = await body(response);
expect(response.status === 409 && data.error.includes("migration 0005"), "Revisão sem migration deve retornar orientação segura, nunca erro 500.");

const afterMigration = buildDatabase({ operationsUpgrade: true });
const afterEnv = envFor(afterMigration);

response = await getDashboard({ env: afterEnv });
data = await body(response);
expect(response.status === 200 && data.storeSummary.capabilities.linkReview === true, "Dashboard deve habilitar revisão após migration.");

response = await reviewLink({ params: { id: "1" }, request: request("/api/admin/store/products/1/mark-link-reviewed", "POST", { status: "reviewed" }), env: afterEnv });
data = await body(response);
expect(response.status === 200 && data.status === "reviewed", "Marcação manual de link deve funcionar após migration.");

response = await updateProduct({ params: { id: "1" }, request: request("/api/admin/store/products/1", "PUT", productPayload), env: afterEnv });
expect(response.status === 200, "Edição de produto deve funcionar após migration.");
const productAfterUrlChange = await afterMigration.prepare("SELECT link_review_status FROM store_products WHERE id=1").first();
expect(productAfterUrlChange.link_review_status === "not_reviewed", "Alterar URL afiliada deve redefinir revisão do link.");

response = await searchAdmin({ request: request("/api/admin/search?q=Mang"), env: afterEnv });
data = await body(response);
expect(response.status === 200 && data.results.some((group) => group.label === "Loja"), "Busca administrativa deve localizar produtos.");

response = await featurePost({ params: { id: "1" }, request: request("/api/admin/posts/1/feature", "POST"), env: afterEnv });
expect(response.status === 200, "Destaque editorial deve funcionar para artigo publicado.");

response = await restoreRevision({ params: { id: "1", revisionId: "1" }, request: request("/api/admin/posts/1/revisions/1/restore", "POST"), env: afterEnv });
expect(response.status === 200, "Restauração de revisão deve concluir sem falha.");
const revisions = await afterMigration.prepare("SELECT COUNT(*) AS total FROM post_revisions WHERE post_id=1").first();
expect(Number(revisions.total) === 2, "Restauração deve salvar backup antes de substituir o conteúdo.");

const completedProduct = {
  name: "Light novel nova",
  category: "light_novel",
  description: "Volume recomendado",
  affiliate_url: "https://www.amazon.com.br/dp/B000000002",
  image_url: "https://example.com/ln.jpg",
  image_alt: "Capa da light novel",
  status: "draft",
  sort_order: 30,
};
response = await createProduct({ request: request("/api/admin/store/products", "POST", completedProduct), env: afterEnv });
data = await body(response);
const createdProductId = data.id;
expect(response.status === 201 && createdProductId, "Criação de produto deve concluir.");

response = await publishProduct({ params: { id: String(createdProductId) }, request: request(`/api/admin/store/products/${createdProductId}/publish`, "POST"), env: afterEnv });
expect(response.status === 200, "Publicação de produto válido deve concluir.");

response = await moveProductUp({ params: { id: String(createdProductId) }, request: request(`/api/admin/store/products/${createdProductId}/move-up`, "POST"), env: afterEnv });
expect(response.status === 200, "Ordenação para cima deve concluir.");

response = await moveProductDown({ params: { id: String(createdProductId) }, request: request(`/api/admin/store/products/${createdProductId}/move-down`, "POST"), env: afterEnv });
expect(response.status === 200, "Ordenação para baixo deve concluir.");

response = await unpublishProduct({ params: { id: String(createdProductId) }, request: request(`/api/admin/store/products/${createdProductId}/unpublish`, "POST"), env: afterEnv });
expect(response.status === 200, "Despublicação de produto deve concluir.");

response = await archiveProduct({ params: { id: String(createdProductId) }, request: request(`/api/admin/store/products/${createdProductId}/archive`, "POST"), env: afterEnv });
expect(response.status === 200, "Arquivamento de produto deve concluir.");

response = await storeMetrics({ env: afterEnv });
expect(response.status === 200, "Métricas da Loja devem carregar.");

response = await saveStoreBanner({ request: request("/api/admin/store/banner", "PUT", {
  enabled: true,
  eyebrow: "LOJA",
  title: "Seleção da semana",
  description: "Produtos escolhidos",
  button_text: "Abrir Loja",
  button_url: "/loja/",
  image_url: "https://example.com/banner-loja.jpg",
  image_alt: "Banner da loja",
  affiliate_disclaimer: "Links afiliados.",
  status: "active",
}), env: afterEnv });
expect(response.status === 200, "Configuração de banner da Loja deve salvar.");

response = await createCategory({ request: request("/api/admin/categories", "POST", { name: "Notícias", slug: "noticias", description: "Novidades" }), env: afterEnv });
data = await body(response);
const categoryId = data.id;
expect(response.status === 201 && categoryId, "Categoria deve ser criada.");
response = await updateCategory({ params: { id: String(categoryId) }, request: request(`/api/admin/categories/${categoryId}`, "PUT", { name: "Notícias Atualizadas", slug: "noticias-atualizadas", description: "Novidades atualizadas" }), env: afterEnv });
expect(response.status === 200, "Categoria deve ser atualizada.");

response = await createTag({ request: request("/api/admin/tags", "POST", { name: "Isekai", slug: "isekai" }), env: afterEnv });
data = await body(response);
const tagId = data.id;
expect(response.status === 201 && tagId, "Tag deve ser criada.");
response = await updateTag({ params: { id: String(tagId) }, request: request(`/api/admin/tags/${tagId}`, "PUT", { name: "Fantasia", slug: "fantasia" }), env: afterEnv });
expect(response.status === 200, "Tag deve ser atualizada.");

const bannerPayload = {
  name: "Banner novo",
  placement: "blog_sidebar_right",
  image_url: "https://example.com/banner-2.jpg",
  alt_text: "Banner novo",
  target_url: "https://anime.ryuzen.ink/blog/",
  status: "inactive",
};
response = await createBanner({ request: request("/api/admin/banners", "POST", bannerPayload), env: afterEnv });
data = await body(response);
const bannerId = data.id;
expect(response.status === 201 && bannerId, "Banner promocional deve ser criado.");
response = await updateBanner({ params: { id: String(bannerId) }, request: request(`/api/admin/banners/${bannerId}`, "PUT", { ...bannerPayload, name: "Banner editado" }), env: afterEnv });
expect(response.status === 200, "Banner promocional deve ser atualizado.");
response = await activateBanner({ params: { id: String(bannerId) }, request: request(`/api/admin/banners/${bannerId}/activate`, "POST"), env: afterEnv });
expect(response.status === 200, "Banner promocional deve ser ativado.");
response = await deactivateBanner({ params: { id: String(bannerId) }, request: request(`/api/admin/banners/${bannerId}/deactivate`, "POST"), env: afterEnv });
expect(response.status === 200, "Banner promocional deve ser desativado.");
response = await archiveBanner({ params: { id: String(bannerId) }, request: request(`/api/admin/banners/${bannerId}/archive`, "POST"), env: afterEnv });
expect(response.status === 200, "Banner promocional deve ser arquivado.");

const postPayload = {
  title: "Novo artigo teste",
  slug: "novo-artigo-teste",
  excerpt: "Resumo de teste",
  content_html: "<h2>Texto de teste</h2><p>Conteúdo seguro.</p>",
  category_id: 1,
  cover_image_url: "https://example.com/post.jpg",
  cover_alt: "Capa",
  social_image_url: "https://example.com/social-post.jpg",
  seo_title: "Novo artigo",
  seo_description: "Descrição SEO",
  tags: ["Anime"],
  images: [],
};
response = await createPost({ request: request("/api/admin/posts", "POST", postPayload), env: afterEnv });
data = await body(response);
const postId = data.id;
expect(response.status === 201 && postId, "Rascunho editorial deve ser criado.");
response = await publishPost({ params: { id: String(postId) }, request: request(`/api/admin/posts/${postId}/publish`, "POST"), env: afterEnv });
expect(response.status === 200, "Publicação editorial deve concluir.");
response = await duplicatePost({ params: { id: String(postId) }, request: request(`/api/admin/posts/${postId}/duplicate`, "POST"), env: afterEnv });
expect(response.status === 201, "Duplicação editorial deve criar rascunho.");
response = await updatePostImages({ params: { id: "9999" }, request: request("/api/admin/posts/9999/images", "PUT", { images: [] }), env: afterEnv });
expect(response.status === 404, "Atualização de imagens não deve auditar post inexistente.");
response = await archivePost({ params: { id: String(postId) }, request: request(`/api/admin/posts/${postId}/archive`, "POST"), env: afterEnv });
expect(response.status === 200, "Arquivamento editorial deve concluir.");
response = await listPosts({ request: request("/api/admin/posts?q=Novo"), env: afterEnv });
expect(response.status === 200, "Listagem editorial deve carregar após operações.");

response = await publicProducts({ env: afterEnv });
data = await body(response);
expect(response.status === 200 && data.products.some((product) => product.name === "Mangá atualizado"), "Loja pública deve retornar apenas produtos publicados válidos.");

response = await publicStoreBanner({ env: afterEnv });
data = await body(response);
expect(response.status === 200 && data.banner?.button_url === "/loja/", "Banner público da Loja deve manter destino interno seguro.");

response = await recordStoreClick({ request: request("/api/store/click", "POST", { destination_type: "store_product", product_id: 1, source: "loja" }), env: afterEnv });
data = await body(response);
expect(response.status === 201 && data.recorded === true, "Clique público de produto publicado deve ser registrado.");

response = await publicPosts({ request: request("/api/posts"), env: afterEnv });
data = await body(response);
expect(response.status === 200 && data.posts.some((post) => post.slug === "artigo-publicado"), "Feed público deve carregar artigo publicado.");

response = await publicPost({ params: { slug: "artigo-publicado" }, env: afterEnv });
data = await body(response);
expect(response.status === 200 && data.post?.slug === "artigo-publicado", "Página pública dinâmica de artigo deve carregar.");

response = await publicBanners({ env: afterEnv });
expect(response.status === 200, "API pública de banners deve carregar.");

response = await publicCategories({ env: afterEnv });
expect(response.status === 200, "API pública de categorias deve carregar.");

response = await adminApiMiddleware({
  request: request("/api/admin/dashboard"),
  env: afterEnv,
  data: {},
  next: () => new Response("next"),
});
expect(response.status === 401, "API administrativa deve rejeitar acesso sem sessão.");

response = await adminPageMiddleware({
  request: request("/admin/"),
  env: afterEnv,
  next: () => new Response("admin"),
});
expect(response.status === 302 && response.headers.get("Location")?.includes("/admin/login/"), "Página administrativa deve redirecionar sem sessão.");

const securedSession = await createAdminSession(request("/api/auth/login", "POST", {}), afterEnv);
const cookie = securedSession.cookie;
response = await adminApiMiddleware({
  request: new Request("https://anime.ryuzen.ink/api/admin/store/products/1/publish", { method: "POST", headers: { Cookie: cookie } }),
  env: afterEnv,
  data: {},
  next: () => new Response("next"),
});
expect(response.status === 403, "Mutação administrativa deve rejeitar requisição sem CSRF.");

response = await adminApiMiddleware({
  request: new Request("https://anime.ryuzen.ink/api/admin/store/products/1/publish", { method: "POST", headers: { Cookie: cookie, "X-CSRF-Token": securedSession.csrfToken, Origin: "https://anime.ryuzen.ink" } }),
  env: afterEnv,
  data: {},
  next: () => new Response("next", { status: 200 }),
});
expect(response.status === 200, "Mutação administrativa deve prosseguir com sessão e CSRF válidos.");

if (failures.length) {
  console.error("\\nFalha na validação das APIs administrativas:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("APIs administrativas validadas: dashboard e Loja funcionam antes/depois da migration 0005; CRUD editorial/comercial, APIs públicas, sessão/CSRF, destaque, busca, backup e revisões preservados.");
