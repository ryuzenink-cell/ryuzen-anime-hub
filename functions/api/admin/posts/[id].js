import { json, handleError, readJson, requireDatabase, RequestError } from "../../../_utils/http.js";
import { findPostForAdmin, getPostCapabilities, replaceImages, replaceTags, validatePostPayload } from "../../../_utils/posts.js";
import { writeAudit } from "../../../_utils/auth.js";

function postId(params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) throw new RequestError("Identificador de post inválido.", 400, { code: "VALIDATION_ERROR", field: "id" });
  return id;
}

export async function onRequestGet({ params, env }) {
  try { return json({ post: await findPostForAdmin(requireDatabase(env), postId(params)) }); }
  catch (error) { return handleError(error); }
}

export async function onRequestPut({ params, request, env }) {
  try {
    const db = requireDatabase(env);
    const id = postId(params);
    const capabilities = await getPostCapabilities(db);
    const existing = await findPostForAdmin(db, id);
    const body = await readJson(request);
    const payload = validatePostPayload(body);

    let clientVersion = null;
    if (capabilities.versioning) {
      clientVersion = Number(body.version);
      if (!Number.isInteger(clientVersion) || clientVersion < 1) {
        throw new RequestError(
          "Não foi possível confirmar a versão deste post. Recarregue a página para carregar a versão mais recente antes de salvar.",
          400,
          { code: "VERSION_MISSING", field: "version" },
        );
      }
      if (clientVersion !== existing.version) {
        throw new RequestError(
          "O post foi alterado em outra aba ou sessão. Recarregue a versão mais recente antes de salvar novamente.",
          409,
          { code: "VERSION_CONFLICT", field: "version" },
        );
      }
    }

    let updatedAt = null;
    let newVersion = null;
    if (capabilities.versioning) {
      const result = await db.prepare(`UPDATE posts SET title = ?, slug = ?, excerpt = ?, content_markdown = ?, content_html = ?, author_name = ?, category_id = ?, cover_image_url = ?, cover_alt = ?, cover_credit = ?, cover_source_url = ?, social_image_url = ?, seo_title = ?, seo_description = ?, canonical_url = ?, updated_at = CURRENT_TIMESTAMP, version = version + 1 WHERE id = ? AND version = ?`)
        .bind(payload.title, payload.slug, payload.excerpt, payload.content_markdown, payload.content_html, payload.author_name, payload.category_id, payload.cover_image_url, payload.cover_alt, payload.cover_credit, payload.cover_source_url, payload.social_image_url, payload.seo_title, payload.seo_description, payload.canonical_url, id, clientVersion)
        .run();
      if (!result?.meta || Number(result.meta.changes || 0) === 0) {
        // Outra requisição venceu a corrida entre a checagem acima e este UPDATE; nada foi sobrescrito.
        throw new RequestError(
          "O post foi alterado em outra aba ou sessão. Recarregue a versão mais recente antes de salvar novamente.",
          409,
          { code: "VERSION_CONFLICT", field: "version" },
        );
      }
      newVersion = clientVersion + 1;
      const updated = await db.prepare("SELECT updated_at FROM posts WHERE id = ?").bind(id).first();
      updatedAt = updated?.updated_at || null;
    } else {
      await db.prepare(`UPDATE posts SET title = ?, slug = ?, excerpt = ?, content_markdown = ?, content_html = ?, author_name = ?, category_id = ?, cover_image_url = ?, cover_alt = ?, cover_credit = ?, cover_source_url = ?, social_image_url = ?, seo_title = ?, seo_description = ?, canonical_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(payload.title, payload.slug, payload.excerpt, payload.content_markdown, payload.content_html, payload.author_name, payload.category_id, payload.cover_image_url, payload.cover_alt, payload.cover_credit, payload.cover_source_url, payload.social_image_url, payload.seo_title, payload.seo_description, payload.canonical_url, id)
        .run();
    }

    // Snapshot capturado ANTES da atualização, guardado somente depois de confirmar que a escrita foi aceita.
    await db.prepare(`INSERT INTO post_revisions (post_id, title, excerpt, content_markdown, revision_note, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(id, existing.title, existing.excerpt, existing.content_html || existing.content_markdown || "", "Versão salva antes da edição pelo painel").run();

    await replaceTags(db, id, payload.tags);
    await replaceImages(db, id, payload.images);
    await writeAudit(db, request, env, "post.update", "post", id, { slug: payload.slug });

    return json({ id, version: newVersion, updated_at: updatedAt, message: "Post atualizado com sucesso." });
  } catch (error) { return handleError(error); }
}
