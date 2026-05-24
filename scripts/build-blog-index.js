#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const blogRoot = path.join(projectRoot, "blog");
const outputPath = path.join(projectRoot, "data", "blog-posts.json");
const readerPath = path.join(blogRoot, "post", "index.html");
const SITE_URL = "https://anime.ryuzen.ink";
const SITE_NAME = "Ryuzen Anime Hub";

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    if (entry.isFile() && entry.name.endsWith(".md")) return [entryPath];
    return [];
  });
}

function parseFrontMatter(markdown = "") {
  const source = String(markdown).replace(/^\uFEFF/, "");
  let body = source;
  const meta = {};
  if (!source.startsWith("---")) return { meta, body };

  const end = source.indexOf("\n---", 3);
  if (end === -1) return { meta, body };

  const lines = source.slice(3, end).trim().split(/\r?\n/);
  body = source.slice(end + 4).trim();
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const rawValue = match[2].trim();
    if (rawValue) {
      meta[key] = cleanFrontMatterValue(rawValue);
      continue;
    }
    const list = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const itemMatch = lines[cursor].match(/^\s*-\s+(.+)$/);
      if (!itemMatch) break;
      list.push(cleanFrontMatterValue(itemMatch[1]));
      cursor += 1;
    }
    meta[key] = list;
    index = cursor - 1;
  }
  return { meta, body };
}

function cleanFrontMatterValue(value = "") {
  return String(value).trim().replace(/^["']|["']$/g, "");
}

function parseTags(value = "") {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((tag) => cleanFrontMatterValue(tag))
    .filter(Boolean);
}

function getDateFromPath(relativePath = "") {
  const match = relativePath.match(/blog\/(\d{4})\/(\d{2})\//);
  return match ? `${match[1]}-${match[2]}-01` : "";
}

function stripMarkdown(value = "") {
  return String(value)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFirstParagraph(markdown = "") {
  const paragraph = String(markdown)
    .split(/\r?\n\r?\n/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith("#") && !part.startsWith("```"));
  return paragraph ? stripMarkdown(paragraph).slice(0, 180) : `Artigo editorial do ${SITE_NAME}.`;
}

function estimateReadingTime(markdown = "") {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function removeInitialTitle(body = "") {
  return String(body).replace(/^#\s+[^\n]+\n+/, "").trim();
}

function normalizePost(filePath) {
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
  const markdown = fs.readFileSync(filePath, "utf8");
  const { meta, body } = parseFrontMatter(markdown);
  const content = removeInitialTitle(body);
  const titleFromBody = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const date = meta.date || getDateFromPath(relativePath);
  const updated = meta.updated || meta.lastmod || date;
  const url = `/${relativePath.replace(/\.md$/i, "/")}`;
  return {
    path: relativePath,
    url,
    slug: meta.slug || path.basename(filePath, ".md"),
    title: meta.title || titleFromBody || path.basename(filePath, ".md"),
    description: meta.description || meta.excerpt || getFirstParagraph(content),
    excerpt: meta.excerpt || meta.description || getFirstParagraph(content),
    date,
    updated,
    category: meta.category || "Editorial",
    author: meta.author || SITE_NAME,
    tags: parseTags(meta.tags),
    cover: meta.cover || "",
    coverAlt: meta.coverAlt || `Imagem de capa do post ${meta.title || titleFromBody || path.basename(filePath, ".md")}`,
    readingTime: estimateReadingTime(content),
    content,
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(url = "") {
  if (!url) return "";
  try {
    return new URL(url, `${SITE_URL}/`).href;
  } catch {
    return "";
  }
}

function safeAssetUrl(value = "") {
  const raw = String(value).trim();
  if (!raw || /^(javascript|data):/i.test(raw)) return "";
  if (/^https?:\/\//i.test(raw)) {
    try { return new URL(raw).href; } catch { return ""; }
  }
  return raw.startsWith("/") ? raw : `/${raw.replace(/^\/+/, "")}`;
}

function safeHref(value = "") {
  const raw = String(value).trim();
  if (!raw || /^(javascript|data):/i.test(raw)) return "";
  try {
    const parsed = new URL(raw, `${SITE_URL}/`);
    if (parsed.pathname.replace(/\/+$/, "") === "/blog/post" && parsed.searchParams.get("post")) {
      const postPath = parsed.searchParams.get("post").replace(/^\/+/, "");
      if (/^blog\/\d{4}\/\d{2}\/[^/]+\.md$/i.test(postPath)) return `/${postPath.replace(/\.md$/i, "/")}`;
    }
    if (parsed.origin === SITE_URL) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return parsed.href;
  } catch {
    return "";
  }
}

function isExternalUrl(url = "") {
  return /^https?:\/\//i.test(url) && !url.startsWith(SITE_URL);
}

function headingPlainText(value = "") {
  return String(value).replace(/[\*_`]/g, "").replace(/\s+/g, " ").trim();
}

function slugifyHeading(value = "") {
  const slug = headingPlainText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return slug || "secao";
}

function makeHeadingIds() {
  const used = new Map();
  return (title) => {
    const base = slugifyHeading(title);
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };
}

function extractHeadings(markdown = "") {
  const nextId = makeHeadingIds();
  return String(markdown).split(/\r?\n/).flatMap((line) => {
    const match = line.trim().match(/^(#{1,3})\s+(.+)$/);
    if (!match) return [];
    const level = Math.max(2, match[1].length);
    return [{ level, title: headingPlainText(match[2]), id: nextId(match[2]) }];
  });
}

function renderInline(value = "") {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    const imageSrc = safeAssetUrl(src);
    return imageSrc ? `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">` : "";
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const href = safeHref(url);
    if (!href) return label;
    const externalAttrs = isExternalUrl(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(href)}"${externalAttrs}>${label}</a>`;
  });
  return html;
}

function renderMarkdown(markdown = "") {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const nextId = makeHeadingIds();
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let codeLines = [];

  const closeParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        closeParagraph(); closeList(); inCode = true;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    const trimmed = line.trim();
    if (!trimmed) { closeParagraph(); closeList(); continue; }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeParagraph(); closeList();
      const level = Math.max(2, heading[1].length);
      const id = ` id="${escapeHtml(nextId(heading[2]))}"`;
      html.push(`<h${level}${id}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^---+$/.test(trimmed)) { closeParagraph(); closeList(); html.push("<hr>"); continue; }
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      closeParagraph();
      const currentType = unordered ? "ul" : "ol";
      if (listType !== currentType) { closeList(); listType = currentType; html.push(`<${listType}>`); }
      html.push(`<li>${renderInline((unordered || ordered)[1])}</li>`);
      continue;
    }
    if (trimmed.startsWith(">")) { closeParagraph(); closeList(); html.push(`<blockquote>${renderInline(trimmed.replace(/^>\s?/, ""))}</blockquote>`); continue; }
    paragraph.push(trimmed);
  }
  closeParagraph(); closeList();
  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return html.join("\n");
}

function formatDate(value = "") {
  if (!value) return "Data indefinida";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function renderToc(post) {
  const allHeadings = extractHeadings(post.content);
  if (allHeadings.length < 4) return "";
  const headings = allHeadings.length > 20 ? allHeadings.filter((heading) => heading.level === 2) : allHeadings;
  return `<nav class="blog-toc" aria-label="Índice do artigo"><p class="blog-toc-title">Neste artigo</p><ol>${headings.map((heading) => `<li class="toc-level-${heading.level}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a></li>`).join("")}</ol></nav>`;
}

function renderArticleCover(post) {
  const cover = safeAssetUrl(post.cover);
  if (!cover) return "";
  return `<img class="blog-article-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(post.coverAlt)}" loading="eager" fetchpriority="high" decoding="async">`;
}

function renderArticle(post) {
  const updateLine = post.updated && post.updated !== post.date
    ? `<span>Atualizado em ${escapeHtml(formatDate(post.updated))}</span>`
    : "";
  const toc = renderToc(post);
  return `<article class="blog-article panel">
      <nav class="blog-breadcrumb" aria-label="Caminho do post">
        <a href="/">Home</a><span>/</span><a href="/blog/">Blog</a><span>/</span><span>${escapeHtml(post.category)}</span>
      </nav>
      ${renderArticleCover(post)}
      <header class="blog-article-header">
        <p class="eyebrow">${escapeHtml(post.category)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p>${escapeHtml(post.description)}</p>
        <div class="meta-line blog-card-meta">
          <span>Publicado em ${escapeHtml(formatDate(post.date))}</span>${updateLine}
          <span>${escapeHtml(post.author)}</span><span>${post.readingTime} min de leitura</span>
        </div>
        ${post.tags.length ? `<div class="blog-tag-list">${post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      </header>
${toc ? `      ${toc}\n` : ""}      <div class="blog-content">${renderMarkdown(post.content)}</div>
      <aside class="blog-cta" aria-label="Explore o Ryuzen Anime Hub">
        <p class="eyebrow">Continue explorando</p>
        <h2>Encontre seu próximo anime</h2>
        <p>Pesquise obras no Ryuzen Anime Hub e organize seus favoritos na sua lista.</p>
        <div class="blog-cta-actions"><a class="btn primary" href="/search/">Buscar animes</a><a class="btn ghost" href="/my-list/">Minha lista</a></div>
      </aside>
    </article>`;
}

function renderRelatedPosts(currentPost, posts) {
  const related = posts
    .filter((post) => post.path !== currentPost.path)
    .filter((post) => post.category === currentPost.category || post.tags.some((tag) => currentPost.tags.includes(tag)))
    .slice(0, 3);
  if (!related.length) return "";
  return `<section class="section compact-section"><div class="section-head"><div><p class="eyebrow">Continue lendo</p><h2>Posts relacionados</h2></div></div><div class="blog-grid">${related.map((post) => `<article class="blog-card"><div class="blog-card-body"><span class="badge warn">${escapeHtml(post.category)}</span><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.excerpt)}</p></div><div class="blog-card-footer"><span>${post.readingTime} min</span><a class="btn ghost" href="${escapeHtml(post.url)}">Abrir</a></div></article>`).join("")}</div></section>`;
}

function renderSeo(post) {
  const canonical = absoluteUrl(post.url);
  const image = absoluteUrl(post.cover);
  const published = String(post.date).slice(0, 10);
  const modified = String(post.updated || post.date).slice(0, 10);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: published,
    dateModified: modified,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: SITE_NAME },
    ...(image ? { image: [image] } : {}),
    keywords: post.tags.join(", "),
  };
  return [
    `  <meta name="robots" content="index,follow,max-image-preview:large">`,
    `  <link rel="canonical" href="${escapeHtml(canonical)}">`,
    `  <meta property="og:type" content="article">`,
    `  <meta property="og:site_name" content="${SITE_NAME}">`,
    `  <meta property="og:title" content="${escapeHtml(post.title)}">`,
    `  <meta property="og:description" content="${escapeHtml(post.description)}">`,
    `  <meta property="og:url" content="${escapeHtml(canonical)}">`,
    image ? `  <meta property="og:image" content="${escapeHtml(image)}">` : "",
    `  <meta property="article:published_time" content="${escapeHtml(published)}">`,
    `  <meta property="article:modified_time" content="${escapeHtml(modified)}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeHtml(post.title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(post.description)}">`,
    image ? `  <meta name="twitter:image" content="${escapeHtml(image)}">` : "",
    `  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
  ].filter(Boolean).join("\n");
}

function writeCleanPostPages(posts) {
  if (!fs.existsSync(readerPath)) return;
  const template = fs.readFileSync(readerPath, "utf8");
  for (const post of posts) {
    let html = template
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(post.title)} | ${SITE_NAME}</title>`)
      .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(post.description)}">`)
      .replace(/\s*<meta name="robots" content="[^"]*">\s*/i, "\n")
      .replace("</head>", `${renderSeo(post)}\n</head>`)
      .replace(/<body(?:\s+[^>]*)?>/i, '<body data-blog-prerendered="true">')
      .replace('<div id="blogPostRoot"></div>', `<div id="blogPostRoot">${renderArticle(post)}</div>`)
      .replace('<div id="relatedPosts"></div>', `<div id="relatedPosts">${renderRelatedPosts(post, posts)}</div>`);
    const cleanDirectory = path.join(projectRoot, post.path.replace(/\.md$/i, ""));
    fs.mkdirSync(cleanDirectory, { recursive: true });
    fs.writeFileSync(path.join(cleanDirectory, "index.html"), html, "utf8");
  }
}

const posts = walk(blogRoot)
  .map(normalizePost)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.title).localeCompare(String(b.title)));
const publicPosts = posts.map(({ content, ...post }) => post);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(publicPosts, null, 2)}\n`, "utf8");
writeCleanPostPages(posts);
console.log(`Índice e páginas estáticas do blog atualizados com ${posts.length} post(s): ${path.relative(projectRoot, outputPath)}`);
