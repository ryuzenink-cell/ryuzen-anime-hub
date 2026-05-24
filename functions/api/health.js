import { publicJson, handleError, requireDatabase } from "../_utils/http.js";
export async function onRequestGet({ env }) {
  try {
    const db = requireDatabase(env);
    await db.prepare("SELECT 1 AS ok").first();
    return publicJson({ ok: true, service: "ryuzen-blog-api" });
  } catch (error) { return handleError(error); }
}
