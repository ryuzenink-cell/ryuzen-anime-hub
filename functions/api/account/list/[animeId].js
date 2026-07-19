import { apiError, handleError, json, readJson } from "../../../_utils/http.js";
import {
  mapAnimeListRow, normalizeAnimeListInput, parseAnimeId, requireAuthenticatedUser,
  requireUsersDatabase, validateCsrf,
} from "../../../_utils/user-auth.js";

const ALLOWED_COLUMNS = new Set(["title", "image", "status", "personal_score", "episodes_watched", "total_episodes", "notes"]);

export async function onRequestPatch({ request, env, params }) {
  try {
    const { user, session } = await requireAuthenticatedUser(request, env);
    await validateCsrf(request, session, env);
    const db = requireUsersDatabase(env);
    const animeId = parseAnimeId(params.animeId);
    const body = await readJson(request);
    const fields = normalizeAnimeListInput(body, { partial: true });
    const columns = Object.keys(fields).filter((column) => ALLOWED_COLUMNS.has(column));
    if (!columns.length) return apiError("Nenhum campo para atualizar foi informado.", 400, { code: "INVALID_REQUEST" });
    const setClause = columns.map((column) => `${column} = ?`).join(", ");
    const values = columns.map((column) => fields[column]);
    const row = await db.prepare(`UPDATE anime_list_items SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND anime_id = ?
      RETURNING anime_id, title, image, status, personal_score, episodes_watched, total_episodes, notes, created_at, updated_at`)
      .bind(...values, user.id, animeId).first();
    if (!row) return apiError("Item não encontrado na sua lista.", 404, { code: "NOT_FOUND" });
    return json({ item: mapAnimeListRow(row) });
  } catch (error) { return handleError(error); }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    const { user, session } = await requireAuthenticatedUser(request, env);
    await validateCsrf(request, session, env);
    const db = requireUsersDatabase(env);
    const animeId = parseAnimeId(params.animeId);
    const result = await db.prepare("DELETE FROM anime_list_items WHERE user_id = ? AND anime_id = ?").bind(user.id, animeId).run();
    if (!result.meta?.changes) return apiError("Item não encontrado na sua lista.", 404, { code: "NOT_FOUND" });
    return json({ deleted: true });
  } catch (error) { return handleError(error); }
}
