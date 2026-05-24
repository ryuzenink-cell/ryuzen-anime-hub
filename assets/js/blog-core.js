const BLOG_MANIFEST = typeof dataPath === "function" ? dataPath("blog-posts.json") : "data/blog-posts.json";

function normalizeBlogPath(path = "") {
  return String(path).replace(/^\/+/, "").replace(/\\/g, "/");
}

function getBlogSlug(path = "") {
  return normalizeBlogPath(path)
    .replace(/^blog\//, "")
    .replace(/\.md$/i, "")
    .split("/")
    .pop();
}

function blogPostCleanPath(postPath = "") {
  const normalized = normalizeBlogPath(postPath);
  if (!normalized.startsWith("blog/") || !normalized.endsWith(".md")) return "";
  return normalized.replace(/\.md$/i, "/").replace(/\/{2,}/g, "/");
}

function blogPostCleanUrl(postPath = "") {
  const cleanPath = blogPostCleanPath(postPath);
  if (!cleanPath) return "";
  return typeof sitePath === "function" ? sitePath(cleanPath) : `/${cleanPath}`;
}

function blogPostPathFromCleanUrl(pathname = "") {
  let cleanPath = String(pathname).split(/[?#]/)[0];
  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch {
    // Mantém o caminho original se houver caractere escapado inválido.
  }

  cleanPath = normalizeBlogPath(cleanPath)
    .replace(/\/index\.html$/i, "")
    .replace(/\/+$/g, "");

  const basePath = typeof RYZEN_BASE_PATH !== "undefined"
    ? normalizeBlogPath(RYZEN_BASE_PATH).replace(/\/+$/g, "")
    : "";

  if (basePath && cleanPath.startsWith(`${basePath}/`)) {
    cleanPath = cleanPath.slice(basePath.length + 1);
  }

  if (/\.md$/i.test(cleanPath)) return "";
  if (!/^blog\/\d{4}\/\d{2}\/[^/]+$/i.test(cleanPath)) return "";
  return `${cleanPath}.md`;
}

function legacyBlogPostPathFromUrl(value = "") {
  try {
    const url = new URL(String(value), window.location.href);
    const cleanPathname = normalizeBlogPath(url.pathname).replace(/\/+$/g, "");
    if (!cleanPathname.endsWith("blog/post")) return "";
    const postPath = normalizeBlogPath(url.searchParams.get("post") || "");
    if (!postPath.startsWith("blog/") || !postPath.endsWith(".md")) return "";
    return postPath;
  } catch {
    return "";
  }
}

function blogHrefToCleanUrl(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";

  const legacyPostPath = legacyBlogPostPathFromUrl(raw);
  if (legacyPostPath) return blogPostCleanUrl(legacyPostPath);

  const normalized = normalizeBlogPath(raw);
  if (normalized.startsWith("blog/") && normalized.endsWith(".md")) {
    return blogPostCleanUrl(normalized);
  }

  return "";
}


function formatBlogDate(value = "") {
  if (!value) return "Data indefinida";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function parseBlogTags(value = "") {
  if (Array.isArray(value)) return value;
  return String(value)
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((tag) => tag.trim().replace(/^['\"]|['\"]$/g, ""))
    .filter(Boolean);
}

function parseBlogFrontMatter(markdown = "", path = "") {
  const source = String(markdown).replace(/^\uFEFF/, "");
  let body = source;
  const meta = {};

  if (source.startsWith("---")) {
    const end = source.indexOf("\n---", 3);
    if (end !== -1) {
      const frontMatter = source.slice(3, end).trim();
      body = source.slice(end + 4).trim();
      Object.assign(meta, parseSimpleFrontMatter(frontMatter));
    }
  }

  const titleFromBody = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const description = meta.description || meta.excerpt || getFirstParagraph(body);
  const tags = parseBlogTags(meta.tags);

  return {
    path: normalizeBlogPath(path),
    slug: meta.slug || getBlogSlug(path),
    title: meta.title || titleFromBody || "Post sem título",
    description,
    excerpt: meta.excerpt || description,
    date: meta.date || getDateFromPath(path),
    updated: meta.updated || meta.lastmod || meta.date || getDateFromPath(path),
    category: meta.category || "Editorial",
    author: meta.author || "Ryuzen Anime Hub",
    cover: meta.cover || "",
    coverAlt: meta.coverAlt || `Imagem de capa do post ${meta.title || titleFromBody || "Ryuzen Anime Hub"}`,
    tags,
    readingTime: estimateReadingTime(body),
    content: body.replace(/^#\s+[^\n]+\n+/, "").trim(),
  };
}

function parseSimpleFrontMatter(frontMatter = "") {
  const meta = {};
  const lines = String(frontMatter).split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
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
      list.push(cleanFrontMatterValue(itemMatch[1].trim()));
      cursor += 1;
    }

    meta[key] = list.length ? list : "";
    index = cursor - 1;
  }

  return meta;
}

function cleanFrontMatterValue(value = "") {
  return String(value)
    .trim()
    .replace(/^['\"]|['\"]$/g, "");
}

function getDateFromPath(path = "") {
  const match = normalizeBlogPath(path).match(/blog\/(\d{4})\/(\d{2})\//);
  if (!match) return "";
  return `${match[1]}-${match[2]}-01`;
}

function getFirstParagraph(markdown = "") {
  const paragraph = String(markdown)
    .split(/\r?\n\r?\n/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith("#") && !part.startsWith("---") && !part.startsWith("```"));
  return paragraph ? stripMarkdown(paragraph).slice(0, 180) : "Leia este conteúdo editorial do Ryuzen Anime Hub.";
}

function stripMarkdown(value = "") {
  return String(value)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateReadingTime(markdown = "") {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function sortBlogPosts(posts = []) {
  return [...posts].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(a.title).localeCompare(String(b.title)));
}

async function loadBlogPosts() {
  const manifest = await fetchJson(BLOG_MANIFEST).catch(() => []);
  const entries = Array.isArray(manifest) ? manifest : manifest.posts || [];
  const posts = await Promise.all(entries.map(async (entry) => {
    const metadataPost = normalizeBlogManifestPost(entry);
    if (metadataPost) return metadataPost;

    const path = normalizeBlogPath(entry?.path || entry);
    if (!path.startsWith("blog/") || !path.endsWith(".md")) return null;
    try {
      const markdown = await fetchText(path);
      return parseBlogFrontMatter(markdown, path);
    } catch (error) {
      console.warn(`Não foi possível carregar o post ${path}.`, error);
      return null;
    }
  }));
  const dynamicPosts = await fetchJson("/api/posts?limit=40")
    .then((result) => (result.posts || []).map(normalizeDynamicBlogPost).filter(Boolean))
    .catch(() => []);
  const combined = [...posts.filter(Boolean), ...dynamicPosts];
  const seen = new Set();
  return sortBlogPosts(combined.filter((post) => {
    const key = post.url || post.path || post.slug;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

function getBlogPostUrl(post = {}) {
  return post.url || blogPostCleanUrl(post.path);
}

function normalizeDynamicBlogPost(entry) {
  if (!entry || !entry.slug || !entry.title) return null;
  const date = String(entry.published_at || entry.updated_at || "").slice(0, 10);
  return {
    path: "",
    url: entry.url || `/blog/p/${entry.slug}/`,
    slug: entry.slug,
    title: entry.title,
    description: entry.seo_description || entry.excerpt || "Leia este conteúdo editorial do Ryuzen Anime Hub.",
    excerpt: entry.excerpt || entry.seo_description || "Leia este conteúdo editorial do Ryuzen Anime Hub.",
    date,
    updated: String(entry.updated_at || entry.published_at || "").slice(0, 10),
    category: entry.category_name || "Editorial",
    author: entry.author_name || "Ryuzen Anime Hub",
    cover: entry.cover_image_url || "",
    coverAlt: entry.cover_alt || `Imagem de capa do post ${entry.title}`,
    tags: [],
    readingTime: 1,
    content: "",
  };
}

function normalizeBlogManifestPost(entry) {
  if (!entry || typeof entry !== "object" || !entry.path || !entry.title) return null;
  const path = normalizeBlogPath(entry.path);
  if (!path.startsWith("blog/") || !path.endsWith(".md")) return null;
  return {
    path,
    slug: entry.slug || getBlogSlug(path),
    title: entry.title,
    description: entry.description || entry.excerpt || "Leia este conteúdo editorial do Ryuzen Anime Hub.",
    excerpt: entry.excerpt || entry.description || "Leia este conteúdo editorial do Ryuzen Anime Hub.",
    date: entry.date || getDateFromPath(path),
    updated: entry.updated || entry.date || getDateFromPath(path),
    category: entry.category || "Editorial",
    author: entry.author || "Ryuzen Anime Hub",
    cover: entry.cover || "",
    coverAlt: entry.coverAlt || `Imagem de capa do post ${entry.title}`,
    tags: parseBlogTags(entry.tags),
    readingTime: Number(entry.readingTime) || 1,
    content: "",
  };
}

function resolveBlogResource(path = "") {
  const value = String(path);
  if (/^https?:\/\//i.test(value)) return value;
  return typeof sitePath === "function" ? sitePath(value) : value;
}

async function fetchJson(path) {
  const response = await fetch(resolveBlogResource(path), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Falha ao carregar ${path}: ${response.status}`);
  return response.json();
}

async function fetchText(path) {
  const response = await fetch(resolveBlogResource(path), { headers: { Accept: "text/markdown, text/plain" } });
  if (!response.ok) throw new Error(`Falha ao carregar ${path}: ${response.status}`);
  return response.text();
}

function renderMarkdown(markdown = "") {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const html = [];
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
        closeParagraph();
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      closeParagraph();
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      closeParagraph();
      const currentType = unordered ? "ul" : "ol";
      if (listType !== currentType) {
        closeList();
        listType = currentType;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${renderInline((unordered || ordered)[1])}</li>`);
      continue;
    }

    if (trimmed.startsWith(">")) {
      closeParagraph();
      closeList();
      html.push(`<blockquote>${renderInline(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  closeParagraph();
  closeList();
  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return html.join("\n");
}

function renderInline(value = "") {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    const imageSrc = safeBlogAsset(src);
    if (!imageSrc) return "";
    return `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const href = safeBlogHref(url);
    if (!href) return label;
    const external = /^https?:\/\//i.test(href) && !href.startsWith(location.origin);
    const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(href)}"${attributes}>${label}</a>`;
  });
  return html;
}

function safeBlogHref(value = "") {
  const raw = String(value).trim();
  if (!raw || raw.startsWith("javascript:") || raw.startsWith("data:")) return "";

  const cleanBlogUrl = blogHrefToCleanUrl(raw);
  if (cleanBlogUrl) return cleanBlogUrl;

  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).href;
    return typeof sitePath === "function" ? sitePath(raw) : raw;
  } catch {
    return "";
  }
}

function safeBlogAsset(value = "") {
  const raw = String(value).trim();
  if (!raw || raw.startsWith("javascript:")) return "";
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).href;
    return typeof sitePath === "function" ? sitePath(raw) : raw;
  } catch {
    return "";
  }
}
