import { apiError, handleError, json, readJson } from "../../_utils/http.js";
import {
  fetchAllowedAvatarFilenames, isSafeAvatarFilename, publicUserFields,
  requireAuthenticatedUser, requireUsersDatabase, validateCsrf,
} from "../../_utils/user-auth.js";

// Só aceita nomes de arquivo presentes na galeria curada (data/avatars.json,
// gerado a partir de assets/images/avatars/). Nunca aceita upload/URL arbitrária.
export async function onRequestPatch({ request, env }) {
  try {
    const { user, session } = await requireAuthenticatedUser(request, env);
    await validateCsrf(request, session, env);
    const db = requireUsersDatabase(env);
    const body = await readJson(request);
    const requested = body.avatarFilename;

    let avatarFilename = null;
    if (requested !== null && requested !== undefined && requested !== "") {
      if (!isSafeAvatarFilename(requested)) {
        return apiError("Avatar inválido.", 400, { code: "INVALID_REQUEST", field: "avatarFilename" });
      }
      const allowed = await fetchAllowedAvatarFilenames(request);
      if (!allowed.includes(requested)) {
        return apiError("Este avatar não está disponível.", 400, { code: "INVALID_REQUEST", field: "avatarFilename" });
      }
      avatarFilename = requested;
    }

    const updated = await db.prepare(`UPDATE users SET avatar_filename = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? RETURNING email, display_name, avatar_filename`).bind(avatarFilename, user.id).first();
    return json({ user: publicUserFields(updated) });
  } catch (error) { return handleError(error); }
}
