import { Parser } from "htmlparser2";
import { RequestError } from "./http.js";

const ALLOWED_TAGS = new Set([
  "p", "h2", "h3", "strong", "em", "ul", "ol", "li", "a", "blockquote",
  "hr", "figure", "img", "figcaption", "span", "br",
  "table", "caption", "thead", "tbody", "tr", "th", "td"
]);
const BLOCKED_TAGS = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template"]);
const VOID_TAGS = new Set(["img", "hr", "br"]);
const ALIGN_CLASSES = new Set(["align-center", "align-right"]);
const BLOCKQUOTE_CLASSES = new Set(["callout-notice"]);
const FIGURE_CLASSES = new Set(["article-figure"]);
const FIGCAPTION_CLASSES = new Set(["article-caption"]);
const SPAN_CLASSES = new Set(["caption", "credit", "related-article-category", "related-article-description"]);
const LI_CLASSES = new Set(["related-article-card"]);
const UL_CLASSES = new Set(["related-articles-grid"]);
const SITE_HOSTNAME = "anime.ryuzen.ink";

// Filtra o atributo class de um elemento para somente os valores explicitamente permitidos,
// preservando múltiplas classes válidas simultaneamente (ex.: "badge warn").
function classAttr(attrs, allowed) {
  const classes = String(attrs.class || "").split(/\s+/).filter((value) => allowed.has(value));
  return classes.length ? ` class="${escapeAttribute(classes.join(" "))}"` : "";
}

function isInternalHref(href) {
  try { return new URL(href).hostname === SITE_HOSTNAME; } catch { return false; }
}

function normalizeTagName(original) {
  if (original === "h1") return "h2";
  if (original === "b") return "strong";
  if (original === "i") return "em";
  return original;
}

export function safeWebUrl(value = "", required = false, label = "URL", field = null) {
  const input = String(value || "").trim();
  if (!input && !required) return "";
  try {
    const parsed = new URL(input);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    return parsed.href;
  } catch {
    const preview = input.length > 120 ? `${input.slice(0, 120)}…` : input;
    throw new RequestError(`${label} inválida: "${preview}". Use uma URL completa iniciada por http:// ou https://.`, 400, { code: "VALIDATION_ERROR", field });
  }
}

export function sanitizeArticleHtml(value = "") {
  const input = String(value || "").slice(0, 500000);
  let output = "";
  let blockedDepth = 0;
  let tableDepth = 0;
  const stack = [];

  const parser = new Parser({
    onopentag(name, attributes) {
      const original = String(name || "").toLowerCase();
      if (blockedDepth || BLOCKED_TAGS.has(original)) {
        blockedDepth += 1;
        stack.push({ blocked: true, close: "" });
        return;
      }
      if (original === "table" && tableDepth > 0) {
        // Nested tables have no valid semantic structure here and could break layout, so drop them entirely.
        blockedDepth += 1;
        stack.push({ blocked: true, close: "" });
        return;
      }
      const tag = normalizeTagName(original);
      if (!ALLOWED_TAGS.has(tag)) {
        stack.push({ blocked: false, close: "" });
        return;
      }
      const serialized = serializeAllowedTag(tag, attributes || {});
      if (!serialized) {
        stack.push({ blocked: false, close: "" });
        return;
      }
      if (tag === "table") {
        tableDepth += 1;
        output += `<div class="article-table-wrapper">${serialized}`;
        stack.push({ blocked: false, close: "</table></div>", isTableRoot: true });
        return;
      }
      output += serialized;
      stack.push({ blocked: false, close: VOID_TAGS.has(tag) ? "" : `</${tag}>` });
    },
    ontext(text) {
      if (!blockedDepth) output += escapeText(text);
    },
    onclosetag() {
      const item = stack.pop();
      if (!item) return;
      if (item.blocked) {
        blockedDepth = Math.max(0, blockedDepth - 1);
        return;
      }
      if (!blockedDepth) output += item.close;
      if (item.isTableRoot) tableDepth = Math.max(0, tableDepth - 1);
    },
  }, { decodeEntities: true, lowerCaseTags: true });

  parser.write(input);
  parser.end();
  return output.trim();
}

function serializeAllowedTag(tag, attrs) {
  if (tag === "a") {
    let href = "";
    try { href = safeWebUrl(attrs.href || "", true); } catch { return ""; }
    const title = attrs.title ? ` title="${escapeAttribute(String(attrs.title).slice(0, 200))}"` : "";
    // Internal links keep normal same-tab navigation and follow behavior; only external links are hardened with nofollow/blank target.
    const navAttrs = isInternalHref(href) ? "" : ' target="_blank" rel="noopener noreferrer nofollow"';
    return `<a href="${escapeAttribute(href)}"${title}${navAttrs}>`;
  }
  if (tag === "img") {
    const src = safeWebUrl(attrs.src || "", true);
    const alt = String(attrs.alt || "").trim().slice(0, 240);
    if (!alt) throw new RequestError("Toda imagem interna precisa de URL e texto alternativo.", 400);
    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy" decoding="async">`;
  }
  if (tag === "blockquote") return `<blockquote${classAttr(attrs, BLOCKQUOTE_CLASSES)}>`;
  if (tag === "figure") return `<figure${classAttr(attrs, FIGURE_CLASSES)}>`;
  if (tag === "figcaption") return `<figcaption${classAttr(attrs, FIGCAPTION_CLASSES)}>`;
  if (tag === "span") return `<span${classAttr(attrs, SPAN_CLASSES)}>`;
  if (tag === "li") return `<li${classAttr(attrs, LI_CLASSES)}>`;
  if (tag === "ul") return `<ul${classAttr(attrs, UL_CLASSES)}>`;
  if (tag === "table") return '<table class="article-table">';
  if (tag === "th" || tag === "td") {
    const scope = tag === "th" && ["col", "row"].includes(attrs.scope) ? ` scope="${attrs.scope}"` : "";
    return `<${tag}${scope}${classAttr(attrs, ALIGN_CLASSES)}>`;
  }
  return `<${tag}>`;
}

function escapeText(value = "") {
  return String(value).replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]));
}
function escapeAttribute(value = "") {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

export function normalizeImage(image = {}, index = 0) {
  const imageUrl = safeWebUrl(image.image_url || image.imageUrl || image.url, true, "URL da imagem");
  const altText = String(image.alt_text || image.altText || "").trim().slice(0, 240);
  if (!altText) throw new RequestError("Toda imagem interna precisa de texto alternativo.", 400);
  return {
    image_url: imageUrl,
    alt_text: altText,
    caption: String(image.caption || "").trim().slice(0, 400),
    credit_text: String(image.credit_text || image.creditText || "").trim().slice(0, 240),
    source_url: safeWebUrl(image.source_url || image.sourceUrl || "", false, "URL da fonte da imagem"),
    placement: ["inline", "gallery", "highlight"].includes(image.placement) ? image.placement : "inline",
    position_order: Number.isInteger(Number(image.position_order ?? image.positionOrder)) ? Number(image.position_order ?? image.positionOrder) : index,
  };
}
