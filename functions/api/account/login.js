import { json, handleError, readJson, apiError } from "../../_utils/http.js";
import {
  createUserSession, currentLock, normalizeEmail, purposeHash, recordAttempt,
  applyFailureLockIfNeeded, clearLocks, requestIp, requireAccountsConfiguration,
  requireUsersDatabase, verifyPassword, DUMMY_PASSWORD_HASH, DUMMY_PASSWORD_SALT,
} from "../../_utils/user-auth.js";

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";

export async function onRequestPost({ request, env }) {
  try {
    requireAccountsConfiguration(env);
    const db = requireUsersDatabase(env);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    const ip = requestIp(request);
    const [emailHash, ipHash] = await Promise.all([purposeHash(email, "login", env), purposeHash(ip, "login", env)]);
    if (await currentLock(db, "login", emailHash, ipHash)) {
      await recordAttempt(db, emailHash, ipHash, false, "rate_limited");
      return apiError(GENERIC_LOGIN_ERROR, 429, { code: "RATE_LIMITED" });
    }

    const user = email ? await db.prepare("SELECT id, email, password_hash, password_salt, display_name FROM users WHERE email = ? AND status = 'active' LIMIT 1").bind(email).first() : null;
    const passwordValid = user
      ? await verifyPassword(password, user.password_hash, user.password_salt)
      : await verifyPassword(password, DUMMY_PASSWORD_HASH, DUMMY_PASSWORD_SALT);

    if (!user || !passwordValid) {
      await recordAttempt(db, emailHash, ipHash, false, "invalid_credentials");
      await applyFailureLockIfNeeded(db, "login", emailHash, ipHash);
      return apiError(GENERIC_LOGIN_ERROR, 401, { code: "AUTHENTICATION_FAILED" });
    }

    await recordAttempt(db, emailHash, ipHash, true, "success");
    await clearLocks(db, "login", emailHash, ipHash);
    const session = await createUserSession(request, env, user.id);
    return json({
      authenticated: true,
      user: { email: user.email, displayName: user.display_name || null },
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    }, 200, { "Set-Cookie": session.cookie });
  } catch (error) { return handleError(error); }
}
