import { json, handleError, readJson, apiError } from "../../_utils/http.js";
import {
  createUserSession, currentLock, hashPassword, isValidEmailFormat, normalizeEmail,
  publicUserFields, purposeHash, recordAttempt, applyFailureLockIfNeeded, requestIp,
  requireAccountsConfiguration, requireUsersDatabase, validatePasswordShape,
  MAX_DISPLAY_NAME_LENGTH,
} from "../../_utils/user-auth.js";

// Política de enumeração adotada para o cadastro (diferente do login, que é
// sempre genérico): informamos quando o e-mail já possui conta, pois é o
// padrão esperado em produtos de consumo e evita usuários presos tentando
// cadastrar de novo um e-mail que já é deles. Para conter automação/abuso,
// toda tentativa (inclusive e-mail duplicado) conta para o rate limit por
// IP/e-mail definido em user_login_attempts + user_login_locks.
export async function onRequestPost({ request, env }) {
  try {
    requireAccountsConfiguration(env);
    const db = requireUsersDatabase(env);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    if (!isValidEmailFormat(email)) return apiError("Informe um e-mail válido.", 400, { code: "INVALID_REQUEST", field: "email" });
    validatePasswordShape(body.password);
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) : null;

    const ip = requestIp(request);
    const [emailHash, ipHash] = await Promise.all([purposeHash(email, "register", env), purposeHash(ip, "register", env)]);
    if (await currentLock(db, "register", emailHash, ipHash)) {
      return apiError("Muitas tentativas de cadastro. Tente novamente mais tarde.", 429, { code: "RATE_LIMITED" });
    }

    const existing = await db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first();
    if (existing) {
      await recordAttempt(db, emailHash, ipHash, false, "email_taken");
      await applyFailureLockIfNeeded(db, "register", emailHash, ipHash);
      return apiError("Este e-mail já possui uma conta. Faça login ou use outro e-mail.", 409, { code: "EMAIL_ALREADY_REGISTERED", field: "email" });
    }

    const { hash, salt } = await hashPassword(body.password);
    let userId;
    try {
      const inserted = await db.prepare(`INSERT INTO users (email, password_hash, password_salt, display_name)
        VALUES (?, ?, ?, ?) RETURNING id`).bind(email, hash, salt, displayName).first();
      userId = inserted.id;
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE constraint failed: users.email")) {
        await recordAttempt(db, emailHash, ipHash, false, "email_taken");
        return apiError("Este e-mail já possui uma conta. Faça login ou use outro e-mail.", 409, { code: "EMAIL_ALREADY_REGISTERED", field: "email" });
      }
      throw error;
    }

    await recordAttempt(db, emailHash, ipHash, true, "success");
    const session = await createUserSession(request, env, userId);
    return json({
      authenticated: true,
      user: publicUserFields({ email, display_name: displayName, avatar_filename: null }),
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    }, 201, { "Set-Cookie": session.cookie });
  } catch (error) { return handleError(error); }
}
