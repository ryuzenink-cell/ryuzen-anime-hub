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

export function apiError(message, status = 400, extra = {}) {
  return json({ error: message, ...extra }, status);
}

export function publicJson(data, status = 200) {
  return json(data, status, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
}

export async function readJson(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new RequestError("Envie os dados em JSON.", 415, { code: "INVALID_CONTENT_TYPE" });
  try {
    return await request.json();
  } catch {
    throw new RequestError("O corpo da requisição não é um JSON válido.", 400, { code: "INVALID_JSON" });
  }
}

export class RequestError extends Error {
  constructor(message, status = 400, { code = null, field = null } = {}) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

function errorId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function handleError(error) {
  if (error instanceof RequestError) {
    const extra = {};
    if (error.code) extra.code = error.code;
    if (error.field) extra.field = error.field;
    return apiError(error.message, error.status, extra);
  }
  const message = String(error?.message || "");
  if (message.includes("UNIQUE constraint failed: posts.slug")) {
    return apiError("Este slug já está sendo utilizado por outro artigo.", 409, { code: "SLUG_ALREADY_EXISTS", field: "slug" });
  }
  if (message.includes("UNIQUE constraint failed: categories.slug") || message.includes("UNIQUE constraint failed: categories.name")) {
    return apiError("Já existe uma categoria com este nome ou slug.", 409, { code: "CATEGORY_ALREADY_EXISTS" });
  }
  if (message.includes("UNIQUE constraint failed: tags.slug") || message.includes("UNIQUE constraint failed: tags.name")) {
    return apiError("Já existe uma tag com este nome ou slug.", 409, { code: "TAG_ALREADY_EXISTS" });
  }
  const id = errorId();
  console.error(`Falha interna [${id}]:`, error?.message || "erro desconhecido", error?.stack || "");
  return apiError("O servidor encontrou um erro inesperado. Tente novamente em instantes.", 500, { code: "INTERNAL_ERROR", errorId: id });
}

export function requireDatabase(env) {
  if (!env?.BLOG_DB) throw new RequestError("O banco de dados está indisponível neste ambiente.", 503, { code: "DATABASE_UNAVAILABLE" });
  return env.BLOG_DB;
}

export function parseInteger(value, fallback, min, max) {
  const number = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
