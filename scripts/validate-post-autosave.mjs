import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { onRequestPost as createPost } from "../functions/api/admin/posts/index.js";
import { onRequestGet as getPost, onRequestPut as updatePost } from "../functions/api/admin/posts/[id].js";
import { onRequestPost as publishPost } from "../functions/api/admin/posts/[id]/publish.js";
import { getPostCapabilities } from "../functions/_utils/posts.js";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const failures = [];
const expect = (value, message) => { if (!value) failures.push(message); };

class D1Statement {
  constructor(database, sql) { this.database = database; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes || 0), last_row_id: Number(result.lastInsertRowid || 0) } };
  }
}
class TestD1 {
  constructor() { this.database = new DatabaseSync(":memory:"); }
  prepare(sql) { return new D1Statement(this.database, sql); }
  exec(sql) { this.database.exec(sql); }
}

function buildDatabase({ withAutosaveMigration = false } = {}) {
  const db = new TestD1();
  db.exec(read("migrations/0000_fresh_blog_schema_reference.sql"));
  db.exec(read("migrations/0002_admin_auth_security.sql"));
  db.exec(read("migrations/0003_admin_dashboard_banners_taxonomies.sql"));
  db.exec(read("migrations/0004_store_ryuzen.sql"));
  db.exec(read("migrations/0005_admin_operations_upgrade.sql"));
  if (withAutosaveMigration) db.exec(read("migrations/0006_post_autosave_concurrency.sql"));
  return db;
}

function env(db) { return { BLOG_DB: db, SESSION_SECRET: "integration-test-secret" }; }
function req(path, method = "GET", body) {
  return new Request(`https://anime.ryuzen.ink${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function body(response) { return response.json(); }

function post(title = "Post de teste", overrides = {}) {
  return { title, slug: title, excerpt: "Resumo de teste com conteúdo suficiente.", content_html: "<p>Conteúdo de teste.</p>", ...overrides };
}

// ---------------------------------------------------------------------------
// 1) Detecção de capability: antes e depois da migration 0006
// ---------------------------------------------------------------------------
{
  const dbBefore = buildDatabase({ withAutosaveMigration: false });
  const dbAfter = buildDatabase({ withAutosaveMigration: true });
  const capsBefore = await getPostCapabilities(dbBefore);
  const capsAfter = await getPostCapabilities(dbAfter);
  expect(capsBefore.versioning === false, "Capability de versionamento não deveria existir antes da migration 0006.");
  expect(capsAfter.versioning === true, "Capability de versionamento deveria existir depois da migration 0006.");
}

// ---------------------------------------------------------------------------
// 2) Criar um rascunho novo: deve retornar id + version=1, e criar exatamente 1 linha
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: true });
  const e = env(db);
  const response = await createPost({ request: req("/api/admin/posts", "POST", post("Artigo autosave 1")), env: e });
  const data = await body(response);
  expect(response.status === 201, "Criação de rascunho deve retornar 201.");
  expect(Number.isInteger(data.id), "Resposta de criação deve conter um id numérico.");
  expect(data.version === 1, `Novo rascunho deveria nascer com version=1 (recebido: ${data.version}).`);
  const count = await db.prepare("SELECT COUNT(*) AS total FROM posts").first();
  expect(Number(count.total) === 1, `Deveria existir exatamente 1 post após a criação (encontrado: ${count.total}).`);
}

// ---------------------------------------------------------------------------
// 3) Atualizar com a versão correta: sucesso, version incrementa, revisão é criada
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: true });
  const e = env(db);
  const created = await body(await createPost({ request: req("/api/admin/posts", "POST", post("Artigo versao correta")), env: e }));
  const updateResponse = await updatePost({
    params: { id: String(created.id) },
    request: req(`/api/admin/posts/${created.id}`, "PUT", { ...post("Artigo versao correta", { excerpt: "Resumo atualizado com conteúdo suficiente." }), version: created.version }),
    env: e,
  });
  const updated = await body(updateResponse);
  expect(updateResponse.status === 200, `Atualização com versão correta deveria retornar 200 (recebido: ${updateResponse.status}).`);
  expect(updated.version === 2, `Version deveria incrementar para 2 (recebido: ${updated.version}).`);
  const row = await db.prepare("SELECT excerpt, version FROM posts WHERE id = ?").bind(created.id).first();
  expect(row.excerpt === "Resumo atualizado com conteúdo suficiente.", "O conteúdo atualizado deveria estar persistido no banco.");
  expect(row.version === 2, "A coluna version no banco deveria refletir o novo valor.");
  const revisions = await db.prepare("SELECT COUNT(*) AS total FROM post_revisions WHERE post_id = ?").bind(created.id).first();
  expect(Number(revisions.total) === 1, "Uma revisão deveria ter sido registrada com o conteúdo anterior à edição.");
}

// ---------------------------------------------------------------------------
// 4) Atualizar com versão desatualizada (conflito): rejeitado com 409, nada é sobrescrito
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: true });
  const e = env(db);
  const created = await body(await createPost({ request: req("/api/admin/posts", "POST", post("Artigo conflito")), env: e }));
  // Simula duas abas: ambas carregam version=1. A aba A salva primeiro (version vira 2).
  await updatePost({ params: { id: String(created.id) }, request: req(`/api/admin/posts/${created.id}`, "PUT", { ...post("Artigo conflito", { excerpt: "Editado pela aba A com texto suficiente." }), version: 1 }), env: e });
  // A aba B, ainda com version=1 em memória, tenta salvar por cima.
  const staleResponse = await updatePost({ params: { id: String(created.id) }, request: req(`/api/admin/posts/${created.id}`, "PUT", { ...post("Artigo conflito", { excerpt: "Editado pela aba B, desatualizada." }), version: 1 }), env: e });
  const staleBody = await body(staleResponse);
  expect(staleResponse.status === 409, `Salvamento com versão desatualizada deveria retornar 409 (recebido: ${staleResponse.status}).`);
  expect(staleBody.code === "VERSION_CONFLICT", `Erro deveria ter code VERSION_CONFLICT (recebido: ${staleBody.code}).`);
  const row = await db.prepare("SELECT excerpt, version FROM posts WHERE id = ?").bind(created.id).first();
  expect(row.excerpt === "Editado pela aba A com texto suficiente.", "A versão da aba B (desatualizada) NÃO deveria ter sobrescrito a da aba A.");
  expect(row.version === 2, "Version deveria ter avançado apenas uma vez (pela aba A), não duas.");
}

// ---------------------------------------------------------------------------
// 5) Atualizar sem informar version: rejeitado com 400 VERSION_MISSING
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: true });
  const e = env(db);
  const created = await body(await createPost({ request: req("/api/admin/posts", "POST", post("Artigo sem version")), env: e }));
  const rawPayload = post("Artigo sem version");
  delete rawPayload.version;
  const response = await updatePost({ params: { id: String(created.id) }, request: req(`/api/admin/posts/${created.id}`, "PUT", rawPayload), env: e });
  const data = await body(response);
  expect(response.status === 400, `Salvamento sem version deveria retornar 400 (recebido: ${response.status}).`);
  expect(data.code === "VERSION_MISSING", `Erro deveria ter code VERSION_MISSING (recebido: ${data.code}).`);
}

// ---------------------------------------------------------------------------
// 6) Sem a migration aplicada: comportamento antigo preservado (sem exigir version)
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: false });
  const e = env(db);
  const created = await body(await createPost({ request: req("/api/admin/posts", "POST", post("Artigo pre-migration")), env: e }));
  expect(created.version === null, "Sem a migration 0006, a resposta não deveria expor version.");
  const response = await updatePost({ params: { id: String(created.id) }, request: req(`/api/admin/posts/${created.id}`, "PUT", post("Artigo pre-migration", { excerpt: "Editado sem exigir version." })), env: e });
  expect(response.status === 200, "Sem a migration, atualizar sem version deveria continuar funcionando normalmente (compatibilidade retroativa).");
}

// ---------------------------------------------------------------------------
// 7) Slug duplicado na criação: 409 estruturado com code e field
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: true });
  const e = env(db);
  await createPost({ request: req("/api/admin/posts", "POST", post("Mesmo Slug")), env: e });
  const conflictResponse = await createPost({ request: req("/api/admin/posts", "POST", post("Mesmo Slug")), env: e });
  const conflictBody = await body(conflictResponse);
  expect(conflictResponse.status === 409, `Slug duplicado na criação deveria retornar 409 (recebido: ${conflictResponse.status}).`);
  expect(conflictBody.code === "SLUG_ALREADY_EXISTS", `Erro deveria ter code SLUG_ALREADY_EXISTS (recebido: ${conflictBody.code}).`);
  expect(conflictBody.field === "slug", "Erro deveria identificar o campo slug.");
}

// ---------------------------------------------------------------------------
// 8) Editar um post mantendo o próprio slug: NÃO deve ser tratado como conflito
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: true });
  const e = env(db);
  const created = await body(await createPost({ request: req("/api/admin/posts", "POST", post("Slug Estavel")), env: e }));
  const response = await updatePost({ params: { id: String(created.id) }, request: req(`/api/admin/posts/${created.id}`, "PUT", { ...post("Slug Estavel", { excerpt: "Editando o próprio post sem trocar o slug." }), version: created.version }), env: e });
  expect(response.status === 200, "Editar um post mantendo seu próprio slug não deveria ser rejeitado como duplicado.");
}

// ---------------------------------------------------------------------------
// 9) Publicar duas vezes (clique duplo): idempotente, sem duplicar published_at
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: true });
  const e = env(db);
  const created = await body(await createPost({ request: req("/api/admin/posts", "POST", post("Artigo publicar 2x", { category_id: null })), env: e }));
  const category = await db.prepare("SELECT id FROM categories LIMIT 1").first();
  await updatePost({ params: { id: String(created.id) }, request: req(`/api/admin/posts/${created.id}`, "PUT", { ...post("Artigo publicar 2x", { category_id: category.id }), version: created.version }), env: e });

  const [firstPublish, secondPublish] = await Promise.all([
    publishPost({ params: { id: String(created.id) }, request: req(`/api/admin/posts/${created.id}/publish`, "POST"), env: e }),
    publishPost({ params: { id: String(created.id) }, request: req(`/api/admin/posts/${created.id}/publish`, "POST"), env: e }),
  ]);
  expect(firstPublish.status === 200 && secondPublish.status === 200, "Ambas as chamadas de publicação concorrentes deveriam retornar sucesso (idempotente).");
  const row = await db.prepare("SELECT status, published_at FROM posts WHERE id = ?").bind(created.id).first();
  expect(row.status === "published", "Post deveria estar publicado após o clique duplo.");
  const countPosts = await db.prepare("SELECT COUNT(*) AS total FROM posts").first();
  expect(Number(countPosts.total) === 1, "Clique duplo em publicar não deveria criar nenhum registro adicional.");
}

// ---------------------------------------------------------------------------
// 10) Post inexistente: 404 estruturado
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: true });
  const e = env(db);
  const response = await getPost({ params: { id: "999999" }, env: e });
  const data = await body(response);
  expect(response.status === 404, `Post inexistente deveria retornar 404 (recebido: ${response.status}).`);
  expect(data.code === "POST_NOT_FOUND", `Erro deveria ter code POST_NOT_FOUND (recebido: ${data.code}).`);
}

// ---------------------------------------------------------------------------
// 11) Validação por campo: título vazio, categoria inválida, URL de capa inválida
// ---------------------------------------------------------------------------
{
  const db = buildDatabase({ withAutosaveMigration: true });
  const e = env(db);
  const noTitle = await body(await createPost({ request: req("/api/admin/posts", "POST", post("", { title: "" })), env: e }));
  expect(noTitle.code === "REQUIRED_FIELD_MISSING" && noTitle.field === "title", `Título vazio deveria apontar o campo title (recebido: ${noTitle.code}/${noTitle.field}).`);

  const badCategory = await body(await createPost({ request: req("/api/admin/posts", "POST", post("Categoria invalida", { category_id: "abc" })), env: e }));
  expect(badCategory.code === "VALIDATION_ERROR" && badCategory.field === "category_id", `Categoria inválida deveria apontar o campo category_id (recebido: ${badCategory.code}/${badCategory.field}).`);

  const badCover = await body(await createPost({ request: req("/api/admin/posts", "POST", post("Capa invalida", { cover_image_url: "www.sem-protocolo.com/imagem.jpg" })), env: e }));
  expect(badCover.code === "VALIDATION_ERROR" && badCover.field === "cover_image_url", `URL de capa inválida deveria apontar o campo cover_image_url (recebido: ${badCover.code}/${badCover.field}).`);
}

// ---------------------------------------------------------------------------
if (failures.length) {
  console.error("Validação de autosave/concorrência de posts falhou:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Autosave e concorrência de posts validados: capability detection, criação sem duplicar, versionamento otimista, conflito entre abas, compatibilidade retroativa sem a migration, slug duplicado, edição preservando o próprio slug, publicação idempotente e erros estruturados por campo.");
