import { RequestError } from "./http.js";
import { safeWebUrl } from "./sanitize.js";

export const STORE_CATEGORIES = ["manga", "light_novel", "collectible", "digital_reading", "geek_gift", "apparel", "creators", "other"];
export const STORE_BADGES = ["none", "ryuzen_choice", "getting_started", "highlight", "recommended", "geek_gift"];
export const STORE_STATUSES = ["draft", "published", "archived"];
const AMAZON_HOST_RE = /(?:^|\.)amazon\.(?:com\.br|com|ca|co\.uk|de|es|fr|it|co\.jp|in|com\.mx|com\.au)$/;

const storeSchemaPromises = new WeakMap();

/**
 * Inicializa a estrutura base da Loja de forma idempotente.
 *
 * A revisão manual de links é habilitada somente pela migration 0005.
 * As APIs detectam se ela já foi aplicada e permanecem operacionais
 * durante a janela entre deploy e migration, sem executar ALTER TABLE
 * silencioso em requisições HTTP.
 */
export async function ensureStoreSchema(db) {
  const cached = storeSchemaPromises.get(db);
  if (cached) return cached;

  const promise = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS store_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('manga','light_novel','collectible','digital_reading','geek_gift','apparel','creators','other')),
        description TEXT NOT NULL,
        affiliate_url TEXT NOT NULL,
        asin TEXT NOT NULL DEFAULT '',
        related_title TEXT NOT NULL DEFAULT '',
        badge TEXT NOT NULL DEFAULT 'none' CHECK (badge IN ('none','ryuzen_choice','getting_started','highlight','recommended','geek_gift')),
        image_url TEXT NOT NULL,
        image_alt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
        is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 100,
        internal_notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE INDEX IF NOT EXISTS idx_store_products_public ON store_products(status, sort_order, updated_at)",
      "CREATE INDEX IF NOT EXISTS idx_store_products_category ON store_products(category, status)",
      "CREATE INDEX IF NOT EXISTS idx_store_products_order ON store_products(sort_order, id)",
      `CREATE TABLE IF NOT EXISTS store_home_banner (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
        eyebrow TEXT NOT NULL DEFAULT 'LOJA RYUZEN · SELEÇÃO DA SEMANA',
        title TEXT NOT NULL DEFAULT 'Achados para quem vive o mundo anime',
        description TEXT NOT NULL DEFAULT 'Mangás, light novels e produtos selecionados pela Ryuzen para fãs de anime.',
        button_text TEXT NOT NULL DEFAULT 'Explorar a Loja',
        button_url TEXT NOT NULL DEFAULT '/loja/',
        image_url TEXT NOT NULL DEFAULT '',
        image_alt TEXT NOT NULL DEFAULT '',
        affiliate_disclaimer TEXT NOT NULL DEFAULT 'Links afiliados. Compras e condições são processadas pela Amazon.',
        status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','archived')),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "INSERT OR IGNORE INTO store_home_banner (id) VALUES (1)",
      `CREATE TABLE IF NOT EXISTS store_clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        destination_type TEXT NOT NULL CHECK (destination_type IN ('home_banner','store_product')),
        product_id INTEGER,
        source TEXT NOT NULL CHECK (source IN ('home','loja')),
        clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES store_products(id) ON DELETE SET NULL
      )`,
      "CREATE INDEX IF NOT EXISTS idx_store_clicks_type_date ON store_clicks(destination_type, clicked_at)",
      "CREATE INDEX IF NOT EXISTS idx_store_clicks_product ON store_clicks(product_id, clicked_at)",
    ];
    for (const statement of statements) {
      await db.prepare(statement).run();
    }
  })();

  storeSchemaPromises.set(db, promise);
  try {
    return await promise;
  } catch (error) {
    storeSchemaPromises.delete(db);
    throw error;
  }
}

/**
 * Retorna recursos opcionais já aplicados na base D1.
 * Não altera schema: mudanças continuam sendo executadas via migrations.
 */
export async function getStoreCapabilities(db) {
  const tableInfo = await db.prepare("PRAGMA table_info(store_products)").all();
  const columns = tableInfo.results || [];
  return {
    linkReview: columns.some((column) => column.name === "link_review_status"),
  };
}

function clean(value, max) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function requiredText(value, max, message) {
  const text = clean(value, max);
  if (!text) throw new RequestError(message, 400);
  return text;
}

function booleanFlag(value) {
  return value === true || value === 1 || value === "1";
}

function orderValue(value) {
  const input = String(value ?? "").trim();
  if (!input) return 100;
  const parsed = Number(input);
  return Number.isInteger(parsed) ? Math.max(0, Math.min(9999, parsed)) : 100;
}

function httpsWebUrl(value, { required = false, field = "URL" } = {}) {
  const url = safeWebUrl(value, required);
  if (!url) return "";
  if (new URL(url).protocol !== "https:") {
    throw new RequestError(`${field} deve começar com https://.`, 400);
  }
  return url;
}

export function safeAffiliateUrl(value) {
  const url = httpsWebUrl(value, { required: true, field: "O link afiliado" });
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname !== "amzn.to" && !AMAZON_HOST_RE.test(hostname)) {
    throw new RequestError("Informe um link de produto da Amazon ou link afiliado amzn.to.", 400);
  }
  return url;
}

export function safeStoreImageUrl(value, required = true) {
  return httpsWebUrl(value, { required, field: "A URL da imagem" });
}

export function validateProductPayload(payload = {}, { publishing = false } = {}) {
  const requestedStatus = String(payload.status || "draft");
  if (!STORE_STATUSES.includes(requestedStatus)) throw new RequestError("Selecione um status válido.", 400);
  const shouldPublish = publishing || requestedStatus === "published";
  const rawAffiliate = String(payload.affiliate_url || payload.affiliateUrl || "").trim();
  const rawImage = String(payload.image_url || payload.imageUrl || "").trim();
  const rawAlt = String(payload.image_alt || payload.imageAlt || "").trim();
  const category = STORE_CATEGORIES.includes(payload.category) ? payload.category : "other";
  const product = {
    name: shouldPublish ? requiredText(payload.name, 140, "Informe o nome do produto.") : clean(payload.name, 140),
    category,
    description: shouldPublish ? requiredText(payload.description, 180, "Informe uma descrição curta.") : clean(payload.description, 180),
    affiliate_url: shouldPublish ? safeAffiliateUrl(rawAffiliate) : (rawAffiliate ? safeAffiliateUrl(rawAffiliate) : ""),
    asin: clean(payload.asin, 20), related_title: clean(payload.related_title || payload.relatedTitle, 100),
    badge: STORE_BADGES.includes(payload.badge) ? payload.badge : "none",
    image_url: shouldPublish ? safeStoreImageUrl(rawImage, true) : (rawImage ? safeStoreImageUrl(rawImage, true) : ""),
    image_alt: shouldPublish || rawImage ? requiredText(rawAlt, 240, "Informe o texto alternativo da imagem.") : clean(rawAlt, 240),
    status: publishing ? "published" : requestedStatus,
    is_featured: booleanFlag(payload.is_featured ?? payload.isFeatured) ? 1 : 0,
    sort_order: orderValue(payload.sort_order ?? payload.sortOrder), internal_notes: cleanMultiline(payload.internal_notes || payload.internalNotes, 1000),
  };
  return product;
}

export function validateStoredProductForPublishing(row) {
  if (!row) throw new RequestError("Produto não encontrado.", 404);
  if (row.status === "archived") throw new RequestError("Produtos arquivados não podem ser publicados.", 409);
  return validateProductPayload({ ...row, status: "published" }, { publishing: true });
}

export function validateHomeBannerPayload(payload = {}) {
  const rawButtonUrl = String(payload.button_url || payload.buttonUrl || "/loja/").trim();
  if (!/^\/loja\/?(?:[?#].*)?$/.test(rawButtonUrl)) throw new RequestError("O botão da home deve direcionar para /loja/.", 400);
  if (!["active", "inactive", "archived"].includes(payload.status)) throw new RequestError("Selecione um status válido para o banner.", 400);
  const imageUrl = String(payload.image_url || payload.imageUrl || "").trim();
  return {
    enabled: booleanFlag(payload.enabled) && payload.status === "active" ? 1 : 0,
    eyebrow: requiredText(payload.eyebrow, 80, "Informe a etiqueta do banner."),
    title: requiredText(payload.title, 100, "Informe o título do banner."),
    description: requiredText(payload.description, 180, "Informe a descrição do banner."),
    button_text: requiredText(payload.button_text || payload.buttonText, 42, "Informe o texto do botão."),
    button_url: "/loja/",
    image_url: imageUrl ? safeStoreImageUrl(imageUrl, true) : "",
    image_alt: imageUrl ? requiredText(payload.image_alt || payload.imageAlt, 240, "Informe o texto alternativo da imagem.") : clean(payload.image_alt || payload.imageAlt, 240),
    affiliate_disclaimer: requiredText(payload.affiliate_disclaimer || payload.affiliateDisclaimer, 180, "Informe o aviso de afiliado."),
    status: payload.status,
  };
}
