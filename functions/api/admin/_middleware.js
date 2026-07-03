import { apiError, handleError } from "../../_utils/http.js";
import { getAdminSession, validateCsrf } from "../../_utils/auth.js";

export async function onRequest(context) {
  try {
    const session = await getAdminSession(context.request, context.env);
    if (!session) return apiError("Sua sessão expirou. Faça login novamente para continuar.", 401, { code: "SESSION_EXPIRED" });
    await validateCsrf(context.request, session, context.env);
    context.data.adminSession = session;
    return context.next();
  } catch (error) { return handleError(error); }
}
