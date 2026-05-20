const BLOG_REPOSITORY = "ryuzenink-cell/ryuzen-anime-hub";
const BLOG_BRANCH = "main";
const BLOG_ROOT = "blog";
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
    category: meta.category || "Editorial",
    author: meta.author || "Ryuzen Anime Hub",
    cover: meta.cover || "",
    tags,
    readingTime: estimateReadingTime(body),
    content: body,
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
  const paths = await loadBlogPaths();
  const uniquePaths = [...new Set(paths.map((item) => normalizeBlogPath(item.path || item)).filter((path) => path.endsWith(".md")))];
  const posts = await Promise.all(uniquePaths.map(async (path) => {
    try {
      const markdown = await fetchText(path);
      return parseBlogFrontMatter(markdown, path);
    } catch (error) {
      console.warn(`Não foi possível carregar o post ${path}.`, error);
      return null;
    }
  }));
  return sortBlogPosts(posts.filter(Boolean));
}

async function loadBlogPaths() {
  const manifest = await fetchJson(BLOG_MANIFEST).catch(() => []);
  const manifestPaths = Array.isArray(manifest) ? manifest : manifest.posts || [];

  const githubPaths = !isLocalBlogEnvironment()
    ? await loadBlogPathsFromGitHub().catch(() => [])
    : [];

  const paths = [...manifestPaths, ...githubPaths]
    .map((item) => normalizeBlogPath(item.path || item))
    .filter((path) => path.startsWith("blog/"))
    .filter((path) => path.endsWith(".md"));

  return [...new Set(paths)].map((path) => ({ path }));
}

function isLocalBlogEnvironment() {
  return ["localhost", "127.0.0.1"].includes(location.hostname);
}

async function loadBlogPathsFromGitHub() {
  if (!location.protocol.startsWith("http")) return [];
  const files = [];
  await collectGitHubMarkdownFiles(BLOG_ROOT, files);
  return files.map((path) => ({ path }));
}

async function collectGitHubMarkdownFiles(directory, files) {
  const url = `https://api.github.com/repos/${BLOG_REPOSITORY}/contents/${encodeURIComponent(directory).replace(/%2F/g, "/")}?ref=${encodeURIComponent(BLOG_BRANCH)}`;
  const entries = await fetchJson(url);
  if (!Array.isArray(entries)) return;

  const sortedEntries = entries.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  for (const entry of sortedEntries) {
    if (entry.type === "dir") {
      await collectGitHubMarkdownFiles(entry.path, files);
    } else if (entry.type === "file" && entry.path.endsWith(".md")) {
      files.push(entry.path);
    }
  }
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
    return `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const href = safeBlogHref(url);
    if (!href) return label;
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return html;
}

function safeBlogHref(value = "") {
  const raw = String(value).trim();
  if (!raw || raw.startsWith("javascript:") || raw.startsWith("data:")) return "";
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
