import { getAdminSession } from "./_utils/auth.js";
import { applyAdminSecurityHeaders } from "./_utils/security.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const isLoginPage = url.pathname === "/admin/login/" || url.pathname === "/admin/login";
  const isProtectedPanel = url.pathname === "/admin/blog" || url.pathname.startsWith("/admin/blog/");
  if (!isLoginPage && !isProtectedPanel) return context.next();
  const session = await getAdminSession(context.request, context.env, { touch: isProtectedPanel });
  if (isProtectedPanel && !session) {
    const target = encodeURIComponent(`${url.pathname}${url.search}`);
    return Response.redirect(`${url.origin}/admin/login/?next=${target}`, 302);
  }
  if (isLoginPage && session) return Response.redirect(`${url.origin}/admin/blog/`, 302);
  const response = await context.next();
  return applyAdminSecurityHeaders(response, { login: isLoginPage, turnstile: Boolean(context.env?.TURNSTILE_SITE_KEY) });
}
