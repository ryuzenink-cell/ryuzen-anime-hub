import { apiError, handleError } from "../../_utils/http.js";
import { getAdminSession, validateCsrf } from "../../_utils/auth.js";

export async function onRequest(context) {
  try {
    const session = await getAdminSession(context.request, context.env);
    if (!session) return apiError("Não autorizado.", 401);
    await validateCsrf(context.request, session, context.env);
    context.data.adminSession = session;
    return context.next();
  } catch (error) { return handleError(error); }
}
