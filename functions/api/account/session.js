import { json, handleError } from "../../_utils/http.js";
import { getAuthenticatedUser, publicUserFields, requireAccountsConfiguration, rotateCsrfToken } from "../../_utils/user-auth.js";

export async function onRequestGet({ request, env }) {
  try {
    requireAccountsConfiguration(env);
    const auth = await getAuthenticatedUser(request, env);
    if (!auth) return json({ authenticated: false }, 200);
    const csrfToken = await rotateCsrfToken(auth.session, env);
    return json({
      authenticated: true,
      user: publicUserFields(auth.user),
      csrfToken,
    }, 200);
  } catch (error) { return handleError(error); }
}
