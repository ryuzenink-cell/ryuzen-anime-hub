import { publicJson, handleError, requireDatabase } from "../_utils/http.js";
export async function onRequestGet({ env }) {
  try {
    const result = await requireDatabase(env).prepare("SELECT id, name, slug, description FROM categories ORDER BY name").all();
    return publicJson({ categories: result.results || [] });
  } catch (error) { return handleError(error); }
}
