const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export function apiError(message, status = 400) {
  return json({ error: message }, status);
}

export function publicJson(data, status = 200) {
  return json(data, status, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
}

export async function readJson(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new RequestError("Envie os dados em JSON.", 415);
  try {
    return await request.json();
  } catch {
    throw new RequestError("JSON inválido.", 400);
  }
}

export class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

export function handleError(error) {
  if (error instanceof RequestError) return apiError(error.message, error.status);
  const message = String(error?.message || "");
  if (message.includes("UNIQUE constraint failed: posts.slug")) return apiError("Já existe um artigo com este slug.", 409);
  if (message.includes("UNIQUE constraint failed: categories.slug") || message.includes("UNIQUE constraint failed: categories.name")) return apiError("Já existe uma categoria com este nome ou slug.", 409);
  if (message.includes("UNIQUE constraint failed: tags.slug") || message.includes("UNIQUE constraint failed: tags.name")) return apiError("Já existe uma tag com este nome ou slug.", 409);
  console.error("Falha controlada na API editorial:", error?.message || "erro desconhecido");
  return apiError("Não foi possível concluir esta operação.", 500);
}

export function requireDatabase(env) {
  if (!env?.BLOG_DB) throw new RequestError("Banco indisponível neste ambiente.", 503);
  return env.BLOG_DB;
}

export function parseInteger(value, fallback, min, max) {
  const number = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
