import { getAdminSession } from "./_utils/auth.js";
import { applyAdminSecurityHeaders } from "./_utils/security.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const isAdmin = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
  const isLoginPage = url.pathname === "/admin/login/" || url.pathname === "/admin/login";
  if (!isAdmin) return context.next();
  const protectedPanel = !isLoginPage;
  const session = await getAdminSession(context.request, context.env, { touch: protectedPanel });
  if (protectedPanel && !session) {
    const target = encodeURIComponent(`${url.pathname}${url.search}`);
    return Response.redirect(`${url.origin}/admin/login/?next=${target}`, 302);
  }
  if (isLoginPage && session) return Response.redirect(`${url.origin}/admin/`, 302);
  const response = await context.next();
  return applyAdminSecurityHeaders(response, { login: isLoginPage, turnstile: Boolean(context.env?.TURNSTILE_SITE_KEY) });
}
