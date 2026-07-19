const SITE_URL = "https://anime.ryuzen.ink";
const SITE_NAME = "Ryuzen Anime Hub";
const ASSET_VERSION = "20260719-user-accounts-v1";

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character]));
}

function decodeEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)));
}

function plainText(html = "") {
  return decodeEntities(String(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function headingId(value = "") {
  return plainText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "secao";
}

export function enrichArticleContent(contentHtml = "") {
  const ids = new Map();
  const headings = [];
  const html = String(contentHtml).replace(/<h([23])>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const base = headingId(inner);
    const count = (ids.get(base) || 0) + 1;
    ids.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;
    const title = plainText(inner);
    headings.push({ level: Number(level), id, title });
    return `<h${level} id="${escapeHtml(id)}">${inner}</h${level}>`;
  });
  return { html, headings };
}

export function estimateReadingTimeFromHtml(contentHtml = "") {
  const words = plainText(contentHtml).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function formatDate(value = "") {
  if (!value) return "Data indefinida";
  const source = String(value).slice(0, 10);
  const date = new Date(`${source}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return source;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function renderToc(headings = []) {
  if (headings.length < 2) return "";
  return `<nav class="blog-toc" aria-label="Índice do artigo"><p class="blog-toc-title">Neste artigo</p><ol>${headings.map((heading) => `<li class="toc-level-${heading.level}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a></li>`).join("")}</ol></nav>`;
}

function renderCover(post) {
  if (!post.cover_image_url) return "";
  return `<img class="blog-article-cover" src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.cover_alt || `Imagem de capa do post ${post.title}`)}" loading="eager" fetchpriority="high" decoding="async">`;
}

function renderRelatedPosts(relatedPosts = []) {
  if (!relatedPosts.length) return "";
  return `<section class="section compact-section"><div class="section-head"><div><p class="eyebrow">Continue lendo</p><h2>Posts relacionados</h2></div></div><div class="blog-grid">${relatedPosts.map((post) => `<article class="blog-card">${post.cover_image_url ? `<img class="blog-card-cover" src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.cover_alt || `Imagem de capa do post ${post.title}`)}" loading="lazy">` : ""}<div class="blog-card-body"><span class="badge warn">${escapeHtml(post.category_name || "Editorial")}</span><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.excerpt || "")}</p></div><div class="blog-card-footer"><span>${Number(post.reading_time) || 1} min</span><a class="btn ghost" href="/blog/p/${escapeHtml(post.slug)}/">Abrir</a></div></article>`).join("")}</div></section>`;
}

export function renderDynamicArticlePage({ post, tags = [], contentHtml = "", headings = [], relatedPosts = [] }) {
  const canonical = post.canonical_url || `${SITE_URL}/blog/p/${post.slug}/`;
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt;
  const image = post.social_image_url || post.cover_image_url || `${SITE_URL}/assets/images/logo-placeholder.png`;
  const readingTime = estimateReadingTimeFromHtml(contentHtml);
  const published = String(post.published_at || "").slice(0, 10);
  const modified = String(post.updated_at || post.published_at || "").slice(0, 10);
  const updatedLine = modified && modified !== published ? `<span>Atualizado em ${escapeHtml(formatDate(modified))}</span>` : "";
  const schema = JSON.stringify({
    "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description,
    datePublished: published, dateModified: modified, mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Organization", name: post.author_name || SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME }, image: [image], keywords: tags.join(", "),
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | ${SITE_NAME}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="article:published_time" content="${escapeHtml(published)}">
  <meta property="article:modified_time" content="${escapeHtml(modified)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <script type="application/ld+json">${schema}</script>
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://api.jikan.moe https://cloudflareinsights.com https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com; img-src 'self' https: data:; script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), payment=(), usb=()">
  <link rel="manifest" href="/manifest.webmanifest?v=20260719-user-accounts-v1">
  <meta name="theme-color" content="#0f1220">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Ryuzen">
  <meta name="application-name" content="Ryuzen Anime Hub">
  <link rel="icon" href="/favicon.ico?v=20260719-user-accounts-v1" sizes="any">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/icon-16.png?v=20260719-user-accounts-v1">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/icon-32.png?v=20260719-user-accounts-v1">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/icon-192.png?v=20260719-user-accounts-v1">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png?v=20260719-user-accounts-v1">
  <link rel="stylesheet" href="/assets/css/global.css?v=${ASSET_VERSION}">
  <link rel="stylesheet" href="/assets/css/layout.css?v=${ASSET_VERSION}">
  <link rel="stylesheet" href="/assets/css/components.css?v=${ASSET_VERSION}">
  <link rel="stylesheet" href="/assets/css/pages.css?v=${ASSET_VERSION}">
  <link rel="stylesheet" href="/assets/css/responsive.css?v=${ASSET_VERSION}">
  <link rel="stylesheet" href="/assets/css/public-ui.css?v=${ASSET_VERSION}">
  <link rel="stylesheet" href="/assets/css/article-tables.css?v=20260703-tables-v3">
</head>
<body class="public-site" data-blog-prerendered="true">
  <div data-header></div>
  <main id="main-content" class="container blog-post-page">
    <div id="blogPostRoot"><article class="blog-article panel">
      <nav class="blog-breadcrumb" aria-label="Caminho do post">
        <a href="/">Home</a><span>/</span><a href="/blog/">Blog</a><span>/</span><span>${escapeHtml(post.category_name || "Editorial")}</span>
      </nav>
      ${renderCover(post)}
      <header class="blog-article-header">
        <p class="eyebrow">${escapeHtml(post.category_name || "Editorial")}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="meta-line blog-card-meta">
          <span>Publicado em ${escapeHtml(formatDate(published))}</span>${updatedLine}
          <span>${escapeHtml(post.author_name || SITE_NAME)}</span><span>${readingTime} min de leitura</span>
        </div>
        ${tags.length ? `<div class="blog-tag-list">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      </header>
      ${renderToc(headings)}
      <div class="blog-content">${contentHtml}</div>
      <aside class="blog-cta" aria-label="Explore o Ryuzen Anime Hub">
        <p class="eyebrow">Continue explorando</p>
        <h2>Encontre seu próximo anime</h2>
        <p>Pesquise obras no Ryuzen Anime Hub e organize seus favoritos na sua lista.</p>
        <div class="blog-cta-actions"><a class="btn primary" href="/search/">Buscar animes</a><a class="btn ghost" href="/my-list/">Minha lista</a></div>
      </aside>
    </article></div>
    <div id="relatedPosts">${renderRelatedPosts(relatedPosts)}</div>
  </main>
  <div data-footer></div>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-CW8SW35Y3N"></script>
  <script src="/assets/js/analytics.js?v=${ASSET_VERSION}"></script>
  <script src="/assets/js/storage.js?v=${ASSET_VERSION}"></script>
  <script src="/assets/js/ui.js?v=${ASSET_VERSION}"></script>
  <script src="/assets/js/blog-core.js?v=${ASSET_VERSION}"></script>
  <script src="/assets/js/blog-post.js?v=${ASSET_VERSION}"></script>
  <script src="/assets/js/public-ui.js?v=${ASSET_VERSION}"></script>
</body>
</html>`;
}
