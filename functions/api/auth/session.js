import { json, handleError } from "../../_utils/http.js";
import { getAdminSession, rotateCsrfToken } from "../../_utils/auth.js";
export async function onRequestGet({ request, env }) {
  try {
    const session = await getAdminSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    const csrfToken = await rotateCsrfToken(session, env);
    return json({ authenticated: true, displayName: "Administrador", csrfToken });
  } catch (error) { return handleError(error); }
}
