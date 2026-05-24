import { json, handleError } from "../../_utils/http.js";
import { clearSessionCookie, getAdminSession, revokeSession, validateCsrf, writeAudit } from "../../_utils/auth.js";
export async function onRequestPost({ request, env }) {
  try {
    const session = await getAdminSession(request, env);
    if (!session) return json({ authenticated: false }, 401, { "Set-Cookie": clearSessionCookie(request) });
    await validateCsrf(request, session, env);
    await revokeSession(session, env);
    await writeAudit(env.BLOG_DB, request, env, "auth.logout", "admin");
    return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie(request) });
  } catch (error) { return handleError(error); }
}
