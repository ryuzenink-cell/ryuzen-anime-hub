export function applyAdminSecurityHeaders(response, { login = false, turnstile = false } = {}) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  const script = turnstile && login ? "'self' https://challenges.cloudflare.com" : "'self'";
  const frame = turnstile && login ? " frame-src https://challenges.cloudflare.com;" : " frame-src 'none';";
  headers.set("Content-Security-Policy", `default-src 'self'; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' https:; script-src ${script}; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';${frame}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
