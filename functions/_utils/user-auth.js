// Ryuzen Anime Hub — autenticação de contas públicas (usuários finais).
// Isolado de functions/_utils/auth.js (autenticação administrativa) de propósito:
// secrets, cookies, tabelas e sessões nunca se cruzam entre os dois sistemas.
import { RequestError } from "./http.js";

export const SESSION_COOKIE_NAME = "ryuzen_user_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 dias — usuários públicos, não admin.
export const PBKDF2_ITERATIONS = 100000;
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_DISPLAY_NAME_LENGTH = 80;
const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function bytesToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function randomToken(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function parseCookie(request, name) {
  const input = request.headers.get("Cookie") || "";
  const pair = input.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!pair) return "";
  try { return decodeURIComponent(pair.slice(name.length + 1)); } catch { return ""; }
}

export function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);
}
export function isValidEmailFormat(email) {
  return typeof email === "string" && email.length > 3 && email.length <= MAX_EMAIL_LENGTH && EMAIL_FORMAT.test(email);
}
export function validatePasswordShape(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new RequestError(`A senha deve ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres.`, 400, { code: "INVALID_PASSWORD", field: "password" });
  }
}

function isLocalRequest(request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
}
function cookieString(token, request, maxAge = SESSION_MAX_AGE_SECONDS) {
  const parts = [`${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`, "Path=/", `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Strict"];
  if (!isLocalRequest(request)) parts.push("Secure");
  return parts.join("; ");
}
export function clearSessionCookie(request) { return cookieString("", request, 0); }

async function importHmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
export async function keyedHash(value, secret) {
  const key = await importHmacKey(String(secret || ""));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(value || "")));
  return bytesToHex(signature);
}
async function pbkdf2Hex(value, salt, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(value || "")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(String(salt || "")), iterations }, material, 256);
  return bytesToHex(bits);
}
function constantTimeEqual(left = "", right = "") {
  const a = String(left); const b = String(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  return difference === 0;
}

export async function hashPassword(password) {
  const salt = randomToken(24);
  const hash = await pbkdf2Hex(password, salt);
  return { hash, salt };
}
export async function verifyPassword(password, expectedHash, salt) {
  const calculated = await pbkdf2Hex(password, salt);
  return constantTimeEqual(calculated, String(expectedHash || ""));
}

export function requireUsersDatabase(env) {
  if (!env?.USERS_DB) throw new RequestError("O sistema de contas está indisponível neste ambiente.", 503, { code: "DATABASE_UNAVAILABLE" });
  return env.USERS_DB;
}
export function requireSessionSecret(env) {
  if (!String(env?.USER_SESSION_SECRET || "").trim()) {
    throw new RequestError("O sistema de contas está indisponível neste ambiente.", 503, { code: "DATABASE_UNAVAILABLE" });
  }
  return env.USER_SESSION_SECRET;
}
export function requireAccountsConfiguration(env) {
  requireUsersDatabase(env);
  requireSessionSecret(env);
}
export function requestIp(request) { return request.headers.get("CF-Connecting-IP") || "local"; }
export async function requestFingerprint(request, env) {
  const secret = requireSessionSecret(env);
  return {
    ip: requestIp(request),
    ipHash: await keyedHash(requestIp(request), secret),
    userAgentHash: await keyedHash(request.headers.get("User-Agent") || "unknown", secret),
  };
}

// Lockout/rate-limit por "propósito" (login vs. cadastro), reaproveitando as
// mesmas tabelas user_login_attempts/user_login_locks sem alterar o schema:
// o hash guardado já inclui o propósito, então login e cadastro nunca colidem
// nem compartilham contadores entre si.
export async function purposeHash(value, purpose, env) {
  const secret = requireSessionSecret(env);
  return keyedHash(`${purpose}:${String(value || "")}`, secret);
}
export async function currentLock(db, purpose, emailHash, ipHash) {
  return db.prepare(`SELECT lock_key, locked_until FROM user_login_locks
    WHERE (lock_key = ? OR lock_key = ?) AND datetime(locked_until) > CURRENT_TIMESTAMP LIMIT 1`)
    .bind(`${purpose}:email:${emailHash}`, `${purpose}:ip:${ipHash}`).first();
}
export async function recordAttempt(db, emailHash, ipHash, success, reason) {
  await db.prepare(`INSERT INTO user_login_attempts
    (attempted_email_hash, ip_hash, success, failure_reason, attempted_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(emailHash, ipHash, success ? 1 : 0, String(reason || "").slice(0, 40)).run();
}
export async function applyFailureLockIfNeeded(db, purpose, emailHash, ipHash, { maxFailures = 5, windowMinutes = 15, lockMinutes = 30 } = {}) {
  const recent = await db.prepare(`SELECT COUNT(*) AS total FROM user_login_attempts
    WHERE success = 0 AND attempted_at >= datetime('now', ?)
    AND (attempted_email_hash = ? OR ip_hash = ?)`).bind(`-${windowMinutes} minutes`, emailHash, ipHash).first();
  if (Number(recent?.total || 0) < maxFailures) return;
  for (const key of [`${purpose}:email:${emailHash}`, `${purpose}:ip:${ipHash}`]) {
    await db.prepare(`INSERT INTO user_login_locks (lock_key, locked_until, created_at)
      VALUES (?, datetime('now', ?), CURRENT_TIMESTAMP)
      ON CONFLICT(lock_key) DO UPDATE SET locked_until = excluded.locked_until`).bind(key, `+${lockMinutes} minutes`).run();
  }
}
export async function clearLocks(db, purpose, emailHash, ipHash) {
  await db.prepare("DELETE FROM user_login_locks WHERE lock_key = ? OR lock_key = ?")
    .bind(`${purpose}:email:${emailHash}`, `${purpose}:ip:${ipHash}`).run();
}
export function loginError(status = 401) {
  return { message: GENERIC_LOGIN_ERROR, status, code: status === 429 ? "RATE_LIMITED" : "AUTHENTICATION_FAILED" };
}

export async function createUserSession(request, env, userId) {
  const db = requireUsersDatabase(env);
  const secret = requireSessionSecret(env);
  const rawSessionToken = randomToken(36);
  const rawCsrfToken = randomToken(32);
  const fingerprint = await requestFingerprint(request, env);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const [sessionTokenHash, csrfTokenHash] = await Promise.all([
    keyedHash(rawSessionToken, secret), keyedHash(rawCsrfToken, secret),
  ]);
  await db.prepare(`INSERT INTO user_sessions
    (user_id, session_token_hash, csrf_token_hash, created_at, last_seen_at, expires_at, user_agent_hash, ip_hash)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?)`)
    .bind(userId, sessionTokenHash, csrfTokenHash, expiresAt, fingerprint.userAgentHash, fingerprint.ipHash).run();
  // Limpeza oportunística: nunca deixa sessões expiradas/revogadas acumulando.
  await db.prepare("DELETE FROM user_sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP OR revoked_at IS NOT NULL").run();
  return { cookie: cookieString(rawSessionToken, request), csrfToken: rawCsrfToken, expiresAt };
}

export async function getUserSession(request, env, { touch = true } = {}) {
  if (!env?.USERS_DB || !env?.USER_SESSION_SECRET) return null;
  const rawToken = parseCookie(request, SESSION_COOKIE_NAME);
  if (!rawToken) return null;
  const tokenHash = await keyedHash(rawToken, env.USER_SESSION_SECRET);
  const session = await env.USERS_DB.prepare(`SELECT id, user_id, csrf_token_hash, expires_at, revoked_at
    FROM user_sessions WHERE session_token_hash = ? AND revoked_at IS NULL
    AND datetime(expires_at) > CURRENT_TIMESTAMP LIMIT 1`).bind(tokenHash).first();
  if (!session) return null;
  if (touch) await env.USERS_DB.prepare("UPDATE user_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id).run();
  return session;
}

export async function getAuthenticatedUser(request, env, options) {
  const session = await getUserSession(request, env, options);
  if (!session) return null;
  const user = await env.USERS_DB.prepare("SELECT id, email, display_name, avatar_filename, status, created_at FROM users WHERE id = ? AND status = 'active' LIMIT 1")
    .bind(session.user_id).first();
  if (!user) return null;
  return { session, user };
}

// Galeria de avatares é uma lista curada (arquivos em assets/images/avatars/,
// publicada em /data/avatars.json pelo build). Nenhum upload de usuário é aceito.
const AVATAR_FILENAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
export function isSafeAvatarFilename(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && AVATAR_FILENAME_PATTERN.test(value);
}
export function buildAvatarUrl(filename) {
  return filename ? `/assets/images/avatars/${encodeURIComponent(filename)}` : null;
}
export async function fetchAllowedAvatarFilenames(request) {
  try {
    const response = await fetch(new URL("/data/avatars.json", request.url));
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.avatars) ? data.avatars : [];
  } catch { return []; }
}
export function publicUserFields(user) {
  return {
    email: user.email,
    displayName: user.display_name || null,
    avatarFilename: user.avatar_filename || null,
    avatarUrl: buildAvatarUrl(user.avatar_filename),
  };
}

// Usado pelas rotas protegidas de /api/account/**: garante binding disponível
// (503 controlado) e sessão válida (401) antes de qualquer leitura/escrita.
export async function requireAuthenticatedUser(request, env, options) {
  requireAccountsConfiguration(env);
  const auth = await getAuthenticatedUser(request, env, options);
  if (!auth) throw new RequestError("Faça login para continuar.", 401, { code: "AUTHENTICATION_REQUIRED" });
  return auth;
}

// Comparação de custo equivalente ao PBKDF2 real, usada quando o e-mail não
// existe, para não vazar a existência da conta por diferença de tempo de resposta.
export const DUMMY_PASSWORD_SALT = "ryuzen-dummy-salt-constant-timing";
export const DUMMY_PASSWORD_HASH = "0".repeat(64);

export async function rotateCsrfToken(session, env) {
  const secret = requireSessionSecret(env);
  const csrfToken = randomToken(32);
  const csrfHash = await keyedHash(csrfToken, secret);
  await env.USERS_DB.prepare("UPDATE user_sessions SET csrf_token_hash = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(csrfHash, session.id).run();
  return csrfToken;
}
export async function revokeSession(session, env) {
  if (session?.id) await env.USERS_DB.prepare("UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id).run();
}
export async function validateCsrf(request, session, env) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) return;
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new RequestError("Solicitação não autorizada (origem inválida).", 403, { code: "CSRF_INVALID" });
  }
  const secret = requireSessionSecret(env);
  const token = request.headers.get("X-CSRF-Token") || "";
  const tokenHash = token ? await keyedHash(token, secret) : "";
  if (!token || !constantTimeEqual(tokenHash, session.csrf_token_hash)) {
    throw new RequestError("Sua sessão expirou ou o token de segurança é inválido. Recarregue a página e tente novamente.", 403, { code: "CSRF_INVALID" });
  }
}

const LIST_STATUSES = ["plan", "watching", "completed", "paused", "dropped", "favorite"];
export const ANIME_LIST_STATUSES = LIST_STATUSES;

function toBoundedInt(value, { min, max, fallback = null }) {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    throw new RequestError("Valor numérico inválido.", 400, { code: "INVALID_REQUEST" });
  }
  if (number < min || (max !== undefined && number > max)) {
    throw new RequestError("Valor numérico fora do intervalo permitido.", 400, { code: "INVALID_REQUEST" });
  }
  return number;
}
function toBoundedScore(value, fallback = null) {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10) {
    throw new RequestError("Nota inválida (use um valor entre 0 e 10).", 400, { code: "INVALID_REQUEST", field: "personalScore" });
  }
  return number;
}
function toBoundedString(value, maxLength, { required = false, fallback = "" } = {}) {
  if (value === undefined) {
    if (required) throw new RequestError("Campo obrigatório ausente.", 400, { code: "INVALID_REQUEST" });
    return fallback;
  }
  if (typeof value !== "string") throw new RequestError("Campo de texto inválido.", 400, { code: "INVALID_REQUEST" });
  const trimmed = value.trim();
  if (required && !trimmed) throw new RequestError("Campo obrigatório ausente.", 400, { code: "INVALID_REQUEST" });
  return trimmed.slice(0, maxLength);
}

// Normaliza um item de lista vindo do cliente. `partial=true` (PATCH) só valida
// os campos presentes; `partial=false` (criação) exige os campos essenciais.
export function normalizeAnimeListInput(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError("Corpo da requisição inválido.", 400, { code: "INVALID_REQUEST" });
  }
  const result = {};
  if (!partial || body.title !== undefined) result.title = toBoundedString(body.title, 180, { required: !partial, fallback: "Anime sem título" });
  if (!partial || body.image !== undefined) result.image = toBoundedString(body.image, 500);
  if (!partial || body.status !== undefined) {
    const status = typeof body.status === "string" ? body.status : "plan";
    if (!LIST_STATUSES.includes(status)) throw new RequestError("Status inválido.", 400, { code: "INVALID_REQUEST", field: "status" });
    result.status = status;
  }
  if (!partial || body.personalScore !== undefined) result.personal_score = toBoundedScore(body.personalScore);
  if (!partial || body.episodesWatched !== undefined) result.episodes_watched = toBoundedInt(body.episodesWatched, { min: 0, max: 100000, fallback: 0 }) ?? 0;
  if (!partial || body.totalEpisodes !== undefined) result.total_episodes = toBoundedInt(body.totalEpisodes, { min: 0, max: 100000, fallback: 0 }) ?? 0;
  if (!partial || body.notes !== undefined) result.notes = toBoundedString(body.notes, 1000);
  return result;
}
export function mapAnimeListRow(row) {
  if (!row) return null;
  return {
    id: row.anime_id,
    title: row.title,
    image: row.image || "",
    status: row.status,
    personalScore: row.personal_score,
    episodesWatched: row.episodes_watched,
    totalEpisodes: row.total_episodes,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function parseAnimeId(value) {
  const id = Number(value);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
    throw new RequestError("Identificador de anime inválido.", 400, { code: "INVALID_REQUEST", field: "animeId" });
  }
  return id;
}
