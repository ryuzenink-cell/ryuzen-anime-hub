import { apiError } from "./http.js";

function equalInConstantTime(left = "", right = "") {
  const a = String(left);
  const b = String(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export function authorizeAdmin(request, env) {
  const secret = String(env?.BLOG_ADMIN_TOKEN || "");
  if (!secret) return apiError("Área administrativa indisponível.", 503);
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !equalInConstantTime(token, secret)) return apiError("Não autorizado.", 401);
  return null;
}
