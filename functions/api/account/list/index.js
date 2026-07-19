import { json, handleError, readJson } from "../../../_utils/http.js";
import {
  mapAnimeListRow, normalizeAnimeListInput, parseAnimeId, requireAuthenticatedUser,
  requireUsersDatabase, validateCsrf,
} from "../../../_utils/user-auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const { user } = await requireAuthenticatedUser(request, env);
    const db = requireUsersDatabase(env);
    const rows = await db.prepare(`SELECT anime_id, title, image, status, personal_score, episodes_watched, total_episodes, notes, created_at, updated_at
      FROM anime_list_items WHERE user_id = ? ORDER BY updated_at DESC`).bind(user.id).all();
    return json({ items: (rows.results || []).map(mapAnimeListRow) });
  } catch (error) { return handleError(error); }
}

// Upsert idempotente: reenviar o mesmo item não cria duplicata, apenas
// atualiza o registro existente vinculado a (user_id, anime_id).
export async function onRequestPost({ request, env }) {
  try {
    const { user, session } = await requireAuthenticatedUser(request, env);
    await validateCsrf(request, session, env);
    const db = requireUsersDatabase(env);
    const body = await readJson(request);
    const animeId = parseAnimeId(body.id ?? body.animeId);
    const fields = normalizeAnimeListInput(body, { partial: false });
    const row = await db.prepare(`INSERT INTO anime_list_items
        (user_id, anime_id, title, image, status, personal_score, episodes_watched, total_episodes, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, anime_id) DO UPDATE SET
        title = excluded.title, image = excluded.image, status = excluded.status,
        personal_score = excluded.personal_score, episodes_watched = excluded.episodes_watched,
        total_episodes = excluded.total_episodes, notes = excluded.notes, updated_at = CURRENT_TIMESTAMP
      RETURNING anime_id, title, image, status, personal_score, episodes_watched, total_episodes, notes, created_at, updated_at`)
      .bind(user.id, animeId, fields.title, fields.image, fields.status, fields.personal_score, fields.episodes_watched, fields.total_episodes, fields.notes)
      .first();
    return json({ item: mapAnimeListRow(row) }, 200);
  } catch (error) { return handleError(error); }
}
