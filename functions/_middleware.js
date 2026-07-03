import { getAdminSession } from "./_utils/auth.js";
import { applyAdminSecurityHeaders } from "./_utils/security.js";

function loginRedirect(url) {
  const target = encodeURIComponent(`${url.pathname}${url.search}`);
  return Response.redirect(`${url.origin}/admin/login/?next=${target}`, 302);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const isAdmin = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
  const isLoginPage = url.pathname === "/admin/login/" || url.pathname === "/admin/login";
  if (!isAdmin) return context.next();
  const protectedPanel = !isLoginPage;

  let session = null;
  try {
    session = await getAdminSession(context.request, context.env, { touch: protectedPanel });
  } catch (error) {
    // A falha transitória (ex.: banco indisponível) nunca deve derrubar a página inteira;
    // tratamos como sessão ausente e mandamos para o login, que pode tentar de novo.
    console.error("Falha ao verificar sessão administrativa:", error?.message || "erro desconhecido");
    return protectedPanel ? loginRedirect(url) : context.next();
  }

  if (protectedPanel && !session) return loginRedirect(url);
  if (isLoginPage && session) return Response.redirect(`${url.origin}/admin/`, 302);

  let response;
  try {
    response = await context.next();
  } catch (error) {
    console.error("Falha ao carregar página administrativa:", error?.message || "erro desconhecido");
    return new Response("Não foi possível carregar o painel administrativo agora. Tente novamente em instantes.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return applyAdminSecurityHeaders(response, { login: isLoginPage, turnstile: Boolean(context.env?.TURNSTILE_SITE_KEY) });
}
