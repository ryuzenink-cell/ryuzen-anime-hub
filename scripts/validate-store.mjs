import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureStoreSchema, safeAffiliateUrl, safeStoreImageUrl, validateHomeBannerPayload, validateProductPayload } from "../functions/_utils/store.js";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const storeHtml = read("loja/index.html");
const adminHtml = read("admin/loja/index.html");
const home = read("index.html");
const storeJs = read("assets/js/store.js");
const homeStoreJs = read("assets/js/home-store.js");
const uiJs = read("assets/js/ui.js");
const adminProductsApi = read("functions/api/admin/store/products/index.js");
const adminBannerApi = read("functions/api/admin/store/banner/index.js");
const adminMetricsApi = read("functions/api/admin/store/metrics.js");
const serviceWorker = read("service-worker.js");
const storeUtils = read("functions/_utils/store.js");
const productsApi = read("functions/api/store/products.js");
const publishApi = read("functions/api/admin/store/products/[id]/publish.js");
const redirects = read("_redirects");
const sitemap = read("sitemap.xml");

expect(storeHtml.includes("Produtos selecionados para fãs de anime"), "A página Loja deve preservar seu título editorial.");
expect(storeHtml.includes("Programa de Associados da Amazon"), "A página Loja deve informar a participação no programa afiliado.");
expect(storeHtml.includes('id="storeFilters"') && storeHtml.includes('id="storeContent"'), "A página Loja deve possuir filtros e área dinâmica de produtos.");
expect(storeJs.includes('link.rel = "noopener noreferrer sponsored"'), "Links de produto devem declarar atributos seguros e sponsored.");
expect(storeJs.includes("AMAZON_HOST_RE") && storeJs.includes('url.protocol === "https:"'), "O front-end deve validar defensivamente links Amazon HTTPS.");
expect(!productsApi.includes("internal_notes") && !productsApi.includes("asin"), "A API pública não deve expor campos internos do produto.");
expect(productsApi.includes("WHERE status = 'published'"), "A API pública deve retornar somente produtos publicados.");
expect(storeUtils.includes("safeStoreImageUrl") && storeUtils.includes("httpsWebUrl"), "O backend da Loja deve validar URLs HTTPS.");
expect(storeUtils.includes("ensureStoreSchema") && adminProductsApi.includes("ensureStoreSchema") && adminBannerApi.includes("ensureStoreSchema") && adminMetricsApi.includes("ensureStoreSchema"), "O admin deve inicializar de forma segura a estrutura da Loja quando a migration ainda não foi aplicada.");
expect(publishApi.includes("validateStoredProductForPublishing"), "Publicação administrativa deve validar o registro antes de publicá-lo.");
expect(home.includes('id="homeStoreBanner"'), "A home deve manter o ponto de montagem do banner da Loja.");
expect(uiJs.includes('data-route="store"') && uiJs.includes("Loja Ryuzen"), "A navegação pública compartilhada deve exibir a Loja em desktop e mobile.");
expect(home.includes("20260526-store-operational-v3") && serviceWorker.includes("v1.6.2-store-operational-hotfix"), "A home e o service worker devem invalidar caches da navegação anterior.");
expect(homeStoreJs.includes('action.href = "/loja/"'), "O banner deve direcionar somente para a Loja interna.");
expect(adminHtml.includes('data-store-tab="products"') && adminHtml.includes('id="homeBannerPreview"'), "O admin deve oferecer organização e prévia do banner.");
expect(adminHtml.includes('id="storeConfirmDialog"'), "Ações destrutivas da Loja devem ter confirmação acessível.");
expect(redirects.includes("/loja /loja/ 301"), "A rota limpa /loja deve funcionar em produção.");
expect(sitemap.includes("https://anime.ryuzen.ink/loja/"), "O sitemap deve conter a Loja.");

function throwsRequestError(callback) {
  try { callback(); return false; } catch { return true; }
}
expect(safeAffiliateUrl("https://www.amazon.com.br/dp/B000000000?tag=ryuzen-20").startsWith("https://"), "Links HTTPS da Amazon devem ser aceitos.");
expect(safeAffiliateUrl("https://amzn.to/example").startsWith("https://"), "Links HTTPS amzn.to devem ser aceitos.");
expect(throwsRequestError(() => safeAffiliateUrl("http://www.amazon.com.br/dp/B000000000")), "Links afiliados sem HTTPS devem ser rejeitados.");
expect(throwsRequestError(() => safeAffiliateUrl("javascript:alert(1)")), "Protocolos perigosos devem ser rejeitados.");
expect(throwsRequestError(() => safeStoreImageUrl("http://example.com/capa.jpg", true)), "Imagens sem HTTPS devem ser rejeitadas.");
expect(throwsRequestError(() => validateHomeBannerPayload({ enabled: true, status: "active", eyebrow: "Loja", title: "Título", description: "Descrição", button_text: "Abrir", button_url: "https://amazon.com.br", affiliate_disclaimer: "Afiliado" })), "O banner da home não pode apontar diretamente para a Amazon.");
expect(validateHomeBannerPayload({ enabled: "false", status: "active", eyebrow: "Loja", title: "Título", description: "Descrição", button_text: "Abrir", button_url: "/loja/", affiliate_disclaimer: "Afiliado" }).enabled === 0, "Strings arbitrárias não devem ativar o banner.");
expect(throwsRequestError(() => validateProductPayload({ status: "published", name: "Produto", category: "manga", description: "Descrição", affiliate_url: "https://example.com/item", image_url: "https://example.com/capa.jpg", image_alt: "Capa" })), "Produtos publicados devem exigir link Amazon legítimo.");


const prepared = [];
await ensureStoreSchema({
  prepare(statement) {
    prepared.push(statement);
    return { async run() { return { success: true }; } };
  },
});
expect(prepared.some((statement) => statement.includes("CREATE TABLE IF NOT EXISTS store_products")), "A inicialização automática deve criar a tabela de produtos.");
expect(prepared.some((statement) => statement.includes("INSERT OR IGNORE INTO store_home_banner")), "A inicialização automática deve criar a configuração padrão do banner.");

if (failures.length) {
  console.error("\nFalha na validação da Loja Ryuzen:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}
console.log("Loja Ryuzen validada: exposição pública, segurança de links, admin e integração da home preservados.");
