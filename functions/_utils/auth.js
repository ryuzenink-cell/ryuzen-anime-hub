import { apiError, RequestError, requireDatabase } from "./http.js";

export const SESSION_COOKIE_NAME = "ryuzen_admin_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const PBKDF2_ITERATIONS = 100000;
const GENERIC_LOGIN_ERROR = "E-mail ou credenciais inválidos.";

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
function normalizedEmail(value = "") { return String(value).trim().toLowerCase().slice(0, 254); }
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
export async function verifySecret(value, expectedHash, salt) {
  const calculated = await pbkdf2Hex(value, salt);
  return constantTimeEqual(calculated, String(expectedHash || ""));
}
export function requireAuthConfiguration(env) {
  const required = ["ADMIN_EMAIL", "ADMIN_PASSWORD_HASH", "ADMIN_PASSWORD_SALT", "BLOG_ADMIN_TOKEN_HASH", "BLOG_ADMIN_TOKEN_SALT", "SESSION_SECRET"];
  if (required.some((key) => !String(env?.[key] || "").trim())) throw new RequestError("Autenticação administrativa indisponível.", 503);
}
export async function requestFingerprint(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const userAgent = request.headers.get("User-Agent") || "unknown";
  return {
    ipHash: await keyedHash(ip, env.SESSION_SECRET),
    userAgentHash: await keyedHash(userAgent, env.SESSION_SECRET),
  };
}
export async function loginIdentityHash(email, env) { return keyedHash(normalizedEmail(email), env.SESSION_SECRET); }
export function loginError(status = 401) { return apiError(GENERIC_LOGIN_ERROR, status); }

export async function credentialsAreValid(body, env) {
  requireAuthConfiguration(env);
  const emailValid = constantTimeEqual(normalizedEmail(body.email), normalizedEmail(env.ADMIN_EMAIL));
  const [passwordValid, keyValid] = await Promise.all([
    verifySecret(String(body.password || ""), env.ADMIN_PASSWORD_HASH, env.ADMIN_PASSWORD_SALT),
    verifySecret(String(body.adminKey || ""), env.BLOG_ADMIN_TOKEN_HASH, env.BLOG_ADMIN_TOKEN_SALT),
  ]);
  return emailValid && passwordValid && keyValid;
}

export async function getAdminSession(request, env, { touch = true } = {}) {
  if (!env?.BLOG_DB || !env?.SESSION_SECRET) return null;
  const rawToken = parseCookie(request, SESSION_COOKIE_NAME);
  if (!rawToken) return null;
  const tokenHash = await keyedHash(rawToken, env.SESSION_SECRET);
  const session = await env.BLOG_DB.prepare(`SELECT id, csrf_token_hash, expires_at, revoked_at
    FROM admin_sessions WHERE session_token_hash = ? AND revoked_at IS NULL
    AND datetime(expires_at) > CURRENT_TIMESTAMP LIMIT 1`).bind(tokenHash).first();
  if (!session) return null;
  if (touch) await env.BLOG_DB.prepare("UPDATE admin_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id).run();
  return session;
}

export async function createAdminSession(request, env) {
  const db = requireDatabase(env);
  const rawSessionToken = randomToken(36);
  const rawCsrfToken = randomToken(32);
  const fingerprint = await requestFingerprint(request, env);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const [sessionTokenHash, csrfTokenHash] = await Promise.all([
    keyedHash(rawSessionToken, env.SESSION_SECRET), keyedHash(rawCsrfToken, env.SESSION_SECRET),
  ]);
  await db.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL").run();
  await db.prepare(`INSERT INTO admin_sessions
    (session_token_hash, csrf_token_hash, created_at, last_seen_at, expires_at, user_agent_hash, ip_hash)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?)`).bind(sessionTokenHash, csrfTokenHash, expiresAt, fingerprint.userAgentHash, fingerprint.ipHash).run();
  await db.prepare("DELETE FROM admin_sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP OR revoked_at IS NOT NULL").run();
  return { cookie: cookieString(rawSessionToken, request), csrfToken: rawCsrfToken, expiresAt };
}

export async function rotateCsrfToken(session, env) {
  const csrfToken = randomToken(32);
  const csrfHash = await keyedHash(csrfToken, env.SESSION_SECRET);
  await env.BLOG_DB.prepare("UPDATE admin_sessions SET csrf_token_hash = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(csrfHash, session.id).run();
  return csrfToken;
}
export async function revokeSession(session, env) {
  if (session?.id) await env.BLOG_DB.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id).run();
}
export async function validateCsrf(request, session, env) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) return;
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new RequestError("Solicitação não autorizada.", 403);
  const token = request.headers.get("X-CSRF-Token") || "";
  const tokenHash = token ? await keyedHash(token, env.SESSION_SECRET) : "";
  if (!token || !constantTimeEqual(tokenHash, session.csrf_token_hash)) throw new RequestError("Solicitação não autorizada.", 403);
}

export async function writeAudit(db, request, env, action, resourceType = null, resourceId = null, metadata = null) {
  const fingerprint = await requestFingerprint(request, env);
  const safeMetadata = metadata ? JSON.stringify(metadata).slice(0, 1000) : null;
  await db.prepare(`INSERT INTO admin_audit_logs
    (action, resource_type, resource_id, ip_hash, user_agent_hash, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(action, resourceType, resourceId ? String(resourceId) : null, fingerprint.ipHash, fingerprint.userAgentHash, safeMetadata).run();
}

export async function currentLock(db, emailHash, ipHash) {
  return db.prepare(`SELECT lock_key, locked_until FROM admin_login_locks
    WHERE (lock_key = ? OR lock_key = ?) AND datetime(locked_until) > CURRENT_TIMESTAMP LIMIT 1`)
    .bind(`email:${emailHash}`, `ip:${ipHash}`).first();
}
export async function recordLoginAttempt(db, emailHash, ipHash, success, reason) {
  await db.prepare(`INSERT INTO admin_login_attempts
    (attempted_email_hash, ip_hash, success, failure_reason, attempted_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(emailHash, ipHash, success ? 1 : 0, String(reason || "").slice(0, 40)).run();
}
export async function applyFailureLockIfNeeded(db, emailHash, ipHash) {
  const recent = await db.prepare(`SELECT COUNT(*) AS total FROM admin_login_attempts
    WHERE success = 0 AND attempted_at >= datetime('now', '-15 minutes')
    AND (attempted_email_hash = ? OR ip_hash = ?)`).bind(emailHash, ipHash).first();
  if (Number(recent?.total || 0) < 5) return;
  for (const key of [`email:${emailHash}`, `ip:${ipHash}`]) {
    await db.prepare(`INSERT INTO admin_login_locks (lock_key, locked_until, created_at)
      VALUES (?, datetime('now', '+30 minutes'), CURRENT_TIMESTAMP)
      ON CONFLICT(lock_key) DO UPDATE SET locked_until = datetime('now', '+30 minutes')`).bind(key).run();
  }
}
export async function clearLoginLocks(db, emailHash, ipHash) {
  await db.prepare("DELETE FROM admin_login_locks WHERE lock_key = ? OR lock_key = ?").bind(`email:${emailHash}`, `ip:${ipHash}`).run();
}

export async function verifyTurnstile(body, request, env) {
  const siteKey = String(env?.TURNSTILE_SITE_KEY || "").trim();
  const secret = String(env?.TURNSTILE_SECRET_KEY || "").trim();
  if (Boolean(siteKey) !== Boolean(secret)) throw new RequestError("Autenticação administrativa indisponível.", 503);
  if (!secret) return true;
  const responseToken = String(body.turnstileToken || "").trim();
  if (!responseToken) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", responseToken);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const result = await response.json();
    return Boolean(result.success);
  } catch { return false; }
}
