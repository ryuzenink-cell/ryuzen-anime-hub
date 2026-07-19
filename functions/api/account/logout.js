import { json, handleError } from "../../_utils/http.js";
import { clearSessionCookie, getUserSession, revokeSession, validateCsrf } from "../../_utils/user-auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const session = await getUserSession(request, env, { touch: false });
    if (!session) return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie(request) });
    await validateCsrf(request, session, env);
    await revokeSession(session, env);
    return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie(request) });
  } catch (error) { return handleError(error); }
}
