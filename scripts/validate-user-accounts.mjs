import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { onRequestPost as registerAccount } from "../functions/api/account/register.js";
import { onRequestPost as loginAccount } from "../functions/api/account/login.js";
import { onRequestPost as logoutAccount } from "../functions/api/account/logout.js";
import { onRequestGet as accountSession } from "../functions/api/account/session.js";
import { onRequestGet as listItems, onRequestPost as upsertListItem } from "../functions/api/account/list/index.js";
import { onRequestPatch as patchListItem, onRequestDelete as deleteListItem } from "../functions/api/account/list/[animeId].js";
import { onRequestPatch as patchAvatar } from "../functions/api/account/avatar.js";
import { mergeAnimeListItems } from "../assets/js/storage.js";

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
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}
class TestD1 {
  constructor() { this.database = new DatabaseSync(":memory:"); }
  prepare(sql) { return new D1Statement(this.database, sql); }
  exec(sql) { this.database.exec(sql); }
}

function buildDatabase() {
  const db = new TestD1();
  db.exec(read("migrations/0007_user_accounts_and_lists.sql"));
  db.exec(read("migrations/0008_user_avatars.sql"));
  return db;
}
const SECRET = "integration-test-user-session-secret";
function envFor(db, overrides = {}) { return { USERS_DB: db, USER_SESSION_SECRET: SECRET, ...overrides }; }

function request(path, { method = "GET", body, headers = {}, cookie, origin = "https://anime.ryuzen.ink", ip = "203.0.113.10" } = {}) {
  const finalHeaders = { "User-Agent": "integration-test", "CF-Connecting-IP": ip, ...headers };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (cookie) finalHeaders.Cookie = cookie;
  if (origin !== null) finalHeaders.Origin = origin;
  return new Request(`https://anime.ryuzen.ink${path}`, { method, headers: finalHeaders, body: body !== undefined ? JSON.stringify(body) : undefined });
}
async function bodyOf(response) { return response.json(); }
function cookieFrom(response) {
  const raw = response.headers.get("Set-Cookie") || "";
  const match = raw.match(/ryuzen_user_session=([^;]+)/);
  return match ? `ryuzen_user_session=${match[1]}` : "";
}

async function registerUser(env, email, password = "SenhaForte123", ip = "203.0.113.10") {
  const response = await registerAccount({ request: request("/api/account/register", { method: "POST", body: { email, password }, ip }), env });
  const data = await bodyOf(response);
  return { response, data, cookie: cookieFrom(response) };
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------
{
  const db = buildDatabase();
  const env = envFor(db);

  let { response, data, cookie } = await registerUser(env, "  Nova.Conta@Example.com  ");
  expect(response.status === 201 && data.authenticated === true, "Cadastro válido deve autenticar e retornar 201.");
  expect(data.user?.email === "nova.conta@example.com", "E-mail deve ser normalizado (trim + lowercase).");
  expect(Boolean(cookie), "Cadastro deve definir o cookie de sessão.");
  expect(Boolean(response.headers.get("Set-Cookie")?.includes("HttpOnly")), "Cookie de sessão deve ser HttpOnly.");
  expect(Boolean(response.headers.get("Set-Cookie")?.includes("SameSite=Strict")), "Cookie de sessão deve usar SameSite=Strict.");

  const row = await db.prepare("SELECT password_hash, password_salt FROM users WHERE email = ?").bind("nova.conta@example.com").first();
  expect(Boolean(row) && row.password_hash !== "SenhaForte123", "Senha nunca deve ser armazenada em texto puro.");
  expect(/^[0-9a-f]{64}$/.test(row.password_hash), "Hash de senha deve ser um digest hexadecimal de 256 bits (PBKDF2-SHA256).");

  response = await registerAccount({ request: request("/api/account/register", { method: "POST", body: { email: "invalido", password: "SenhaForte123" } }), env });
  expect(response.status === 400, "Cadastro deve rejeitar e-mail em formato inválido.");

  response = await registerAccount({ request: request("/api/account/register", { method: "POST", body: { email: "curta@example.com", password: "123" } }), env });
  expect(response.status === 400, "Cadastro deve rejeitar senha abaixo do tamanho mínimo.");

  response = await registerAccount({ request: request("/api/account/register", { method: "POST", body: { email: "nova.conta@example.com", password: "OutraSenha123" } }), env });
  data = await bodyOf(response);
  expect(response.status === 409 && data.code === "EMAIL_ALREADY_REGISTERED", "Cadastro deve rejeitar e-mail já registrado com 409.");

  response = await registerAccount({ request: request("/api/account/register", { method: "POST", body: { email: "sembanco@example.com", password: "SenhaForte123" } }), env: envFor(db, { USERS_DB: undefined }) });
  data = await bodyOf(response);
  expect(response.status === 503 && data.code === "DATABASE_UNAVAILABLE", "Cadastro sem USERS_DB deve responder 503 DATABASE_UNAVAILABLE, nunca lançar exceção.");
}

// Rate limit de cadastro por IP (tentativas repetidas de e-mail já usado, mesmo IP)
{
  const db = buildDatabase();
  const env = envFor(db);
  await registerUser(env, "alvo@example.com", "SenhaForte123", "198.51.100.5");
  let response;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await registerAccount({ request: request("/api/account/register", { method: "POST", body: { email: "alvo@example.com", password: "SenhaForte123" }, ip: "198.51.100.5" }), env });
  }
  expect(response.status === 409, "As 5 primeiras tentativas duplicadas devem continuar reportando conflito, não lockout ainda.");
  response = await registerAccount({ request: request("/api/account/register", { method: "POST", body: { email: "email-totalmente-novo@example.com", password: "SenhaForte123" }, ip: "198.51.100.5" }), env });
  const data = await bodyOf(response);
  expect(response.status === 429 && data.code === "RATE_LIMITED", "Cadastro deve aplicar rate limit por IP após tentativas repetidas, mesmo com e-mail novo.");
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
{
  const db = buildDatabase();
  const env = envFor(db);
  await registerUser(env, "login.valido@example.com", "SenhaForte123", "192.0.2.20");

  let response = await loginAccount({ request: request("/api/account/login", { method: "POST", body: { email: "login.valido@example.com", password: "SenhaForte123" }, ip: "192.0.2.21" }), env });
  let data = await bodyOf(response);
  expect(response.status === 200 && data.authenticated === true, "Login com credenciais válidas deve autenticar.");
  const loginCookie = cookieFrom(response);
  expect(Boolean(loginCookie), "Login deve definir cookie de sessão.");
  expect(Boolean(data.csrfToken), "Login deve fornecer csrfToken para requisições mutantes.");

  const rawToken = loginCookie.split("=")[1];
  const sessionByRawToken = await db.prepare("SELECT id FROM user_sessions WHERE session_token_hash = ?").bind(rawToken).first();
  expect(!sessionByRawToken, "O token de sessão em texto puro nunca deve bater com o valor armazenado (apenas o HMAC é salvo).");
  // Cadastro já autentica (1 sessão) + login explícito (2ª sessão): multi-dispositivo
  // é permitido de propósito para usuários públicos (diferente do admin, que revoga
  // sessões antigas a cada login).
  const sessionCount = await db.prepare("SELECT COUNT(*) AS total FROM user_sessions WHERE revoked_at IS NULL").first();
  expect(Number(sessionCount.total) === 2, "Cadastro + login devem coexistir como sessões ativas (multi-dispositivo permitido para usuários públicos).");

  response = await loginAccount({ request: request("/api/account/login", { method: "POST", body: { email: "login.valido@example.com", password: "SenhaErrada000" }, ip: "192.0.2.22" }), env });
  const wrongPasswordBody = await bodyOf(response);
  expect(response.status === 401, "Senha inválida deve retornar 401.");

  response = await loginAccount({ request: request("/api/account/login", { method: "POST", body: { email: "inexistente@example.com", password: "QualquerSenha1" }, ip: "192.0.2.23" }), env });
  const noSuchUserBody = await bodyOf(response);
  expect(response.status === 401, "E-mail inexistente deve retornar 401, nunca 404 ou mensagem distinta.");
  expect(noSuchUserBody.error === wrongPasswordBody.error, "Mensagem de erro deve ser idêntica entre senha inválida e e-mail inexistente (sem enumeração).");

  // Lockout por e-mail: mesmas credenciais erradas repetidas vezes.
  const lockoutEmail = "alvo.lockout@example.com";
  await registerUser(env, lockoutEmail, "SenhaForte123", "192.0.2.30");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await loginAccount({ request: request("/api/account/login", { method: "POST", body: { email: lockoutEmail, password: "SenhaErrada000" }, ip: "192.0.2.31" }), env });
  }
  response = await loginAccount({ request: request("/api/account/login", { method: "POST", body: { email: lockoutEmail, password: "SenhaForte123" }, ip: "192.0.2.31" }), env });
  data = await bodyOf(response);
  expect(response.status === 429 && data.code === "RATE_LIMITED", "Após 5 falhas em 15 minutos, o login (mesmo com senha certa) deve ficar bloqueado por e-mail.");

  // Lockout por IP: e-mails diferentes (inexistentes), mesmo IP.
  const lockoutIp = "192.0.2.40";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await loginAccount({ request: request("/api/account/login", { method: "POST", body: { email: `inexistente${attempt}@example.com`, password: "SenhaErrada000" }, ip: lockoutIp }), env });
  }
  const freshUserEmail = "outro.usuario@example.com";
  await registerUser(env, freshUserEmail, "SenhaForte123", "203.0.113.99");
  response = await loginAccount({ request: request("/api/account/login", { method: "POST", body: { email: freshUserEmail, password: "SenhaForte123" }, ip: lockoutIp }), env });
  data = await bodyOf(response);
  expect(response.status === 429 && data.code === "RATE_LIMITED", "Bloqueio por IP deve valer mesmo para um e-mail válido nunca tentado antes, a partir do mesmo IP.");

  // Liberação: clearLocks remove os locks associados após sucesso (não é permanente).
  const lockRowsBefore = await db.prepare("SELECT COUNT(*) AS total FROM user_login_locks").first();
  expect(Number(lockRowsBefore.total) > 0, "Deve haver locks ativos registrados após os testes de lockout acima.");
  const futureLock = await db.prepare("SELECT locked_until FROM user_login_locks LIMIT 1").first();
  expect(new Date(futureLock.locked_until).getTime() > Date.now(), "O bloqueio deve ter prazo definido no futuro, nunca permanente.");
}

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------
{
  const db = buildDatabase();
  const env = envFor(db);
  const { cookie } = await registerUser(env, "sessao@example.com", "SenhaForte123", "192.0.2.50");

  let response = await accountSession({ request: request("/api/account/session", { cookie }), env });
  let data = await bodyOf(response);
  expect(response.status === 200 && data.authenticated === true && data.user?.email === "sessao@example.com", "Sessão válida deve retornar o usuário autenticado.");
  expect(Boolean(data.csrfToken), "Consulta de sessão autenticada deve fornecer csrfToken.");

  response = await accountSession({ request: request("/api/account/session", { cookie: "ryuzen_user_session=token-invalido" }), env });
  data = await bodyOf(response);
  expect(response.status === 200 && data.authenticated === false, "Token de sessão inválido deve resultar em authenticated:false, sem erro.");

  response = await accountSession({ request: request("/api/account/session"), env });
  data = await bodyOf(response);
  expect(response.status === 200 && data.authenticated === false, "Ausência de cookie deve resultar em authenticated:false.");

  await db.prepare("UPDATE user_sessions SET expires_at = datetime('now', '-1 hour')").run();
  response = await accountSession({ request: request("/api/account/session", { cookie }), env });
  data = await bodyOf(response);
  expect(response.status === 200 && data.authenticated === false, "Sessão expirada deve ser tratada como não autenticada.");

  response = await accountSession({ request: request("/api/account/session", { cookie }), env: envFor(db, { USER_SESSION_SECRET: undefined }) });
  data = await bodyOf(response);
  expect(response.status === 503 && data.code === "DATABASE_UNAVAILABLE", "Ausência do secret deve responder 503 controlado, nunca vazar detalhes internos.");

  response = await accountSession({ request: request("/api/account/session", { cookie }), env: envFor(db, { USERS_DB: undefined }) });
  data = await bodyOf(response);
  expect(response.status === 503 && data.code === "DATABASE_UNAVAILABLE", "Ausência do binding USERS_DB deve responder 503 controlado.");
}

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------
{
  const db = buildDatabase();
  const env = envFor(db);
  const { cookie, data: registerData } = await registerUser(env, "csrf@example.com", "SenhaForte123", "192.0.2.60");
  const csrfToken = registerData.csrfToken;
  const item = { id: 101, title: "Anime CSRF", image: "", status: "watching", personalScore: 8, episodesWatched: 3, totalEpisodes: 12, notes: "" };

  let response = await upsertListItem({ request: request("/api/account/list", { method: "POST", body: item, cookie }), env });
  let data = await bodyOf(response);
  expect(response.status === 403 && data.code === "CSRF_INVALID", "Mutação sem X-CSRF-Token deve ser rejeitada.");

  response = await upsertListItem({ request: request("/api/account/list", { method: "POST", body: item, cookie, headers: { "X-CSRF-Token": "token-errado" } }), env });
  data = await bodyOf(response);
  expect(response.status === 403 && data.code === "CSRF_INVALID", "Mutação com X-CSRF-Token incorreto deve ser rejeitada.");

  response = await upsertListItem({ request: request("/api/account/list", { method: "POST", body: item, cookie, headers: { "X-CSRF-Token": csrfToken }, origin: "https://malicioso.example" }), env });
  data = await bodyOf(response);
  expect(response.status === 403 && data.code === "CSRF_INVALID", "Mutação com Origin divergente deve ser rejeitada mesmo com CSRF correto.");

  response = await upsertListItem({ request: request("/api/account/list", { method: "POST", body: item, cookie, headers: { "X-CSRF-Token": csrfToken } }), env });
  expect(response.status === 200, "Mutação com CSRF e Origin válidos deve prosseguir.");

  response = await logoutAccount({ request: request("/api/account/logout", { method: "POST", cookie }), env });
  expect(response.status === 403, "Logout sem CSRF deve ser rejeitado quando existe sessão ativa.");
  response = await logoutAccount({ request: request("/api/account/logout", { method: "POST", cookie, headers: { "X-CSRF-Token": csrfToken } }), env });
  data = await bodyOf(response);
  expect(response.status === 200 && data.authenticated === false, "Logout com CSRF correto deve encerrar a sessão.");

  response = await accountSession({ request: request("/api/account/session", { cookie }), env });
  data = await bodyOf(response);
  expect(data.authenticated === false, "Sessão deve estar inválida após logout.");
}

// ---------------------------------------------------------------------------
// Lista de animes + isolamento entre usuários
// ---------------------------------------------------------------------------
{
  const db = buildDatabase();
  const env = envFor(db);
  const userA = await registerUser(env, "usuario.a@example.com", "SenhaForte123", "192.0.2.70");
  const userB = await registerUser(env, "usuario.b@example.com", "SenhaForte123", "192.0.2.71");
  const csrfA = userA.data.csrfToken;
  const csrfB = userB.data.csrfToken;

  const validItem = { id: 501, title: "Frieren", image: "https://example.com/frieren.jpg", status: "watching", personalScore: 9.5, episodesWatched: 5, totalEpisodes: 28, notes: "Ótimo" };
  let response = await upsertListItem({ request: request("/api/account/list", { method: "POST", body: { ...validItem, userId: 999999 }, cookie: userA.cookie, headers: { "X-CSRF-Token": csrfA } }), env });
  let data = await bodyOf(response);
  expect(response.status === 200 && data.item?.id === 501, "Criação de item deve funcionar e ignorar userId enviado pelo cliente.");
  const ownerRow = await db.prepare("SELECT user_id FROM anime_list_items WHERE anime_id = 501").first();
  const userARow = await db.prepare("SELECT id FROM users WHERE email = 'usuario.a@example.com'").first();
  expect(ownerRow.user_id === userARow.id, "Item deve pertencer ao usuário da sessão, nunca ao userId enviado no corpo.");

  response = await listItems({ request: request("/api/account/list", { cookie: userA.cookie }), env });
  data = await bodyOf(response);
  expect(data.items?.length === 1 && data.items[0].title === "Frieren", "Listagem deve retornar os itens do usuário autenticado.");

  response = await patchListItem({ request: request("/api/account/list/501", { method: "PATCH", body: { episodesWatched: 10 }, cookie: userA.cookie, headers: { "X-CSRF-Token": csrfA } }), env, params: { animeId: "501" } });
  data = await bodyOf(response);
  expect(response.status === 200 && data.item?.episodesWatched === 10, "Atualização parcial (PATCH) deve refletir apenas o campo enviado.");

  response = await upsertListItem({ request: request("/api/account/list", { method: "POST", body: { id: 502, title: "Status inválido", status: "assistindo-errado" }, cookie: userA.cookie, headers: { "X-CSRF-Token": csrfA } }), env });
  expect(response.status === 400, "Status fora do enum permitido deve ser rejeitado.");

  response = await upsertListItem({ request: request("/api/account/list", { method: "POST", body: { id: 503, title: "Episódios negativos", status: "plan", episodesWatched: -5 }, cookie: userA.cookie, headers: { "X-CSRF-Token": csrfA } }), env });
  expect(response.status === 400, "Número negativo de episódios assistidos deve ser rejeitado.");

  response = await upsertListItem({ request: request("/api/account/list", { method: "POST", body: { ...validItem, id: 501 }, cookie: userA.cookie, headers: { "X-CSRF-Token": csrfA } }), env });
  const countAfterRepeat = await db.prepare("SELECT COUNT(*) AS total FROM anime_list_items WHERE user_id = ?").bind(userARow.id).first();
  expect(Number(countAfterRepeat.total) === 1, "Reenviar o mesmo item (upsert) não deve criar duplicata (idempotência).");
  const beforeTampering = await db.prepare("SELECT episodes_watched FROM anime_list_items WHERE anime_id = 501").first();

  // Isolamento: usuário B não enxerga nem manipula o item do usuário A.
  response = await listItems({ request: request("/api/account/list", { cookie: userB.cookie }), env });
  data = await bodyOf(response);
  expect(Array.isArray(data.items) && data.items.length === 0, "Usuário B não deve listar itens do usuário A.");

  response = await patchListItem({ request: request("/api/account/list/501", { method: "PATCH", body: { episodesWatched: 1 }, cookie: userB.cookie, headers: { "X-CSRF-Token": csrfB } }), env, params: { animeId: "501" } });
  expect(response.status === 404, "Usuário B não deve conseguir atualizar item pertencente ao usuário A (404, sem revelar existência).");

  response = await deleteListItem({ request: request("/api/account/list/501", { method: "DELETE", cookie: userB.cookie, headers: { "X-CSRF-Token": csrfB } }), env, params: { animeId: "501" } });
  expect(response.status === 404, "Usuário B não deve conseguir remover item pertencente ao usuário A.");

  const stillOwned = await db.prepare("SELECT episodes_watched FROM anime_list_items WHERE anime_id = 501").first();
  expect(Number(stillOwned.episodes_watched) === Number(beforeTampering.episodes_watched), "O item do usuário A deve permanecer intacto após as tentativas indevidas do usuário B.");

  response = await deleteListItem({ request: request("/api/account/list/501", { method: "DELETE", cookie: userA.cookie, headers: { "X-CSRF-Token": csrfA } }), env, params: { animeId: "501" } });
  expect(response.status === 200, "Usuário A deve conseguir remover seu próprio item.");
  response = await deleteListItem({ request: request("/api/account/list/501", { method: "DELETE", cookie: userA.cookie, headers: { "X-CSRF-Token": csrfA } }), env, params: { animeId: "501" } });
  expect(response.status === 404, "Remover novamente um item já removido deve retornar 404 (idempotência sem erro 500).");

  response = await upsertListItem({ request: request("/api/account/list", { method: "POST", body: validItem }), env: envFor(db, { USERS_DB: undefined }) });
  data = await bodyOf(response);
  expect(response.status === 503 && data.code === "DATABASE_UNAVAILABLE", "Rotas da lista sem USERS_DB devem responder 503 controlado.");

  response = await listItems({ request: request("/api/account/list"), env });
  expect(response.status === 401, "Listar sem sessão deve exigir autenticação (401).");
}

// ---------------------------------------------------------------------------
// Avatar (galeria curada, sem upload)
// ---------------------------------------------------------------------------
{
  const db = buildDatabase();
  const env = envFor(db);
  const { cookie, data: registerData } = await registerUser(env, "avatar@example.com", "SenhaForte123", "192.0.2.80");
  const csrfToken = registerData.csrfToken;
  expect(registerData.user?.avatarUrl === null, "Usuário recém-criado não deve ter avatar por padrão.");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/data/avatars.json")) {
      return new Response(JSON.stringify({ avatars: ["mio.webp", "yui.webp"] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(input);
  };
  try {
    let response = await patchAvatar({ request: request("/api/account/avatar", { method: "POST", body: { avatarFilename: "mio.webp" }, cookie, headers: { "X-CSRF-Token": csrfToken } }), env });
    let data = await bodyOf(response);
    expect(response.status === 200 && data.user?.avatarFilename === "mio.webp", "Deve aceitar avatar presente na galeria.");
    expect(data.user?.avatarUrl === "/assets/images/avatars/mio.webp", "Deve construir a URL pública do avatar a partir do filename.");

    response = await patchAvatar({ request: request("/api/account/avatar", { method: "POST", body: { avatarFilename: "nao-existe.webp" }, cookie, headers: { "X-CSRF-Token": csrfToken } }), env });
    expect(response.status === 400, "Deve rejeitar avatar fora da galeria disponível.");

    response = await patchAvatar({ request: request("/api/account/avatar", { method: "POST", body: { avatarFilename: "../../etc/passwd" }, cookie, headers: { "X-CSRF-Token": csrfToken } }), env });
    expect(response.status === 400, "Deve rejeitar nome de arquivo com caracteres não seguros (path traversal).");

    response = await patchAvatar({ request: request("/api/account/avatar", { method: "POST", body: { avatarFilename: "mio.webp" }, cookie }), env });
    expect(response.status === 403, "Definir avatar sem CSRF deve ser rejeitado.");

    response = await patchAvatar({ request: request("/api/account/avatar", { method: "POST", body: { avatarFilename: null }, cookie, headers: { "X-CSRF-Token": csrfToken } }), env });
    data = await bodyOf(response);
    expect(response.status === 200 && data.user?.avatarFilename === null, "Deve permitir remover o avatar (voltar ao padrão) enviando null.");

    const row = await db.prepare("SELECT avatar_filename FROM users WHERE email = 'avatar@example.com'").first();
    expect(row.avatar_filename === null, "O avatar removido deve refletir no banco.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ---------------------------------------------------------------------------
// Merge local/servidor (assets/js/storage.js)
// ---------------------------------------------------------------------------
{
  const local = [
    { id: 1, title: "Conflito - remoto mais novo", updatedAt: "2026-01-01T00:00:00Z" },
    { id: 2, title: "Apenas local" },
    { id: 3, title: "Conflito - local mais novo", updatedAt: "2026-03-01T00:00:00Z" },
    { id: 4, title: "Local sem updatedAt" },
  ];
  const remote = [
    { id: 1, title: "Remoto vence", updatedAt: "2026-02-01T00:00:00Z" },
    { id: 3, title: "Conflito - local mais novo (remoto antigo)", updatedAt: "2026-02-01T00:00:00Z" },
    { id: 4, title: "Remoto vence (local sem timestamp)", updatedAt: "2026-01-01T00:00:00Z" },
    { id: 5, title: "Apenas remoto" },
  ];
  const { items, toUpload } = mergeAnimeListItems(local, remote);
  const byId = new Map(items.map((item) => [item.id, item]));
  expect(items.length === 5, "Merge deve preservar todos os IDs distintos das duas fontes, sem duplicatas.");
  expect(byId.get(1).title === "Remoto vence", "Em conflito, o item com updated_at mais recente deve vencer (servidor mais novo).");
  expect(byId.get(2).title === "Apenas local", "Item existente só localmente deve ser preservado no merge.");
  expect(byId.get(3).title === "Conflito - local mais novo", "Em conflito, o item local mais recente deve vencer.");
  expect(byId.get(4).title === "Remoto vence (local sem timestamp)", "Item local sem updated_at válido deve ser tratado como mais antigo, nunca vencer arbitrariamente.");
  expect(byId.get(5).title === "Apenas remoto", "Item existente só no servidor deve ser preservado no merge.");
  expect(toUpload.some((item) => item.id === 2) && toUpload.some((item) => item.id === 3) && toUpload.length === 2, "Apenas os itens que o servidor ainda não tem (ou estão desatualizados) devem ser marcados para envio.");

  const repeated = mergeAnimeListItems(items, remote);
  expect(repeated.items.length === items.length, "Repetir o merge com o mesmo resultado não deve gerar duplicatas (idempotência).");
}

if (failures.length) {
  console.error("\nFalha na validação de contas públicas e lista de animes:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Contas públicas validadas: cadastro, login, lockout, sessão, CSRF, lista de animes e isolamento entre usuários.");
