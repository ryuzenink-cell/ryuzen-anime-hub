import { json, handleError, readJson, requireDatabase } from "../../_utils/http.js";
import { applyFailureLockIfNeeded, clearLoginLocks, createAdminSession, credentialsAreValid, currentLock, loginError, loginIdentityHash, recordLoginAttempt, requestFingerprint, requireAuthConfiguration, verifyTurnstile, writeAudit } from "../../_utils/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    requireAuthConfiguration(env);
    const db = requireDatabase(env);
    const body = await readJson(request);
    const email = String(body.email || "").trim().slice(0, 254);
    const emailHash = await loginIdentityHash(email, env);
    const { ipHash } = await requestFingerprint(request, env);
    if (await currentLock(db, emailHash, ipHash)) {
      await recordLoginAttempt(db, emailHash, ipHash, false, "rate_limited");
      return loginError(429);
    }
    const [validCredentials, validChallenge] = await Promise.all([
      credentialsAreValid(body, env), verifyTurnstile(body, request, env),
    ]);
    if (!validCredentials || !validChallenge) {
      await recordLoginAttempt(db, emailHash, ipHash, false, validChallenge ? "credentials" : "challenge");
      await applyFailureLockIfNeeded(db, emailHash, ipHash);
      await writeAudit(db, request, env, "auth.login_failed", "admin", null, { challenge: validChallenge ? "ok" : "failed" });
      return loginError();
    }
    await recordLoginAttempt(db, emailHash, ipHash, true, "success");
    await clearLoginLocks(db, emailHash, ipHash);
    const session = await createAdminSession(request, env);
    await writeAudit(db, request, env, "auth.login_success", "admin");
    return json({ authenticated: true, displayName: "Administrador", csrfToken: session.csrfToken, expiresAt: session.expiresAt }, 200, { "Set-Cookie": session.cookie });
  } catch (error) { return handleError(error); }
}
