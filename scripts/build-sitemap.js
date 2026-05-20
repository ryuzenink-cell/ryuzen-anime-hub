#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const siteUrl = "https://anime.ryuzen.ink";
const blogRoot = path.join(projectRoot, "blog");
const outputPath = path.join(projectRoot, "sitemap.xml");

const staticRoutes = [
  { path: "", file: "index.html", changefreq: "daily", priority: "1.0" },
  { path: "anime/", file: "anime/index.html", changefreq: "weekly", priority: "0.7" },
  { path: "search/", file: "search/index.html", changefreq: "weekly", priority: "0.7" },
  { path: "season/", file: "season/index.html", changefreq: "daily", priority: "0.8" },
  { path: "ranking/", file: "ranking/index.html", changefreq: "daily", priority: "0.8" },
  { path: "guides/", file: "guides/index.html", changefreq: "weekly", priority: "0.8" },
  { path: "guides/proximos-animes/", file: "guides/proximos-animes/index.html", changefreq: "daily", priority: "0.9" },
  { path: "vendas-mangas/", file: "vendas-mangas/index.html", changefreq: "monthly", priority: "0.7" },
  { path: "blog/", file: "blog/index.html", changefreq: "daily", priority: "0.9" },
  { path: "my-list/", file: "my-list/index.html", changefreq: "monthly", priority: "0.5" },
];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    if (entry.isFile() && entry.name.endsWith(".md")) return [entryPath];
    return [];
  });
}

function parseFrontMatter(markdown = "") {
  const source = String(markdown).replace(/^\uFEFF/, "");
  if (!source.startsWith("---")) return {};

  const end = source.indexOf("\n---", 3);
  if (end === -1) return {};

  const meta = {};
  const lines = source.slice(3, end).trim().split(/\r?\n/);

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
    meta[key] = list;
    index = cursor - 1;
  }

  return meta;
}

function cleanFrontMatterValue(value = "") {
  return String(value).trim().replace(/^["']|["']$/g, "");
}

function getDateFromPath(relativePath = "") {
  const match = relativePath.match(/blog\/(\d{4})\/(\d{2})\//);
  if (!match) return "";
  return `${match[1]}-${match[2]}-01`;
}

function toIsoDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function fileLastModified(relativeFile) {
  const filePath = path.join(projectRoot, relativeFile);
  if (!fs.existsSync(filePath)) return "";
  return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
}

function absoluteUrl(route = "") {
  return `${siteUrl}/${String(route).replace(/^\/+/, "")}`;
}

function blogPostUrl(relativePath) {
  const cleanPath = String(relativePath)
    .replace(/^\/+/, "")
    .replace(/\.md$/i, "/");
  return `${siteUrl}/${cleanPath}`;
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderUrl({ loc, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : "",
    changefreq ? `    <changefreq>${escapeXml(changefreq)}</changefreq>` : "",
    priority ? `    <priority>${escapeXml(priority)}</priority>` : "",
    "  </url>",
  ].filter(Boolean).join("\n");
}

const staticUrls = staticRoutes
  .filter((route) => !route.file || fs.existsSync(path.join(projectRoot, route.file)))
  .map((route) => ({
    loc: absoluteUrl(route.path),
    lastmod: fileLastModified(route.file),
    changefreq: route.changefreq,
    priority: route.priority,
  }));

const blogUrls = walk(blogRoot)
  .map((filePath) => {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
    const markdown = fs.readFileSync(filePath, "utf8");
    const meta = parseFrontMatter(markdown);
    return {
      loc: blogPostUrl(relativePath),
      lastmod: toIsoDate(meta.updated || meta.lastmod || meta.date || getDateFromPath(relativePath)) || fs.statSync(filePath).mtime.toISOString().slice(0, 10),
      changefreq: "monthly",
      priority: "0.8",
      sortDate: meta.date || getDateFromPath(relativePath),
      sortPath: relativePath,
    };
  })
  .sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)) || String(a.sortPath).localeCompare(String(b.sortPath)))
  .map(({ sortDate, sortPath, ...url }) => url);

const seen = new Set();
const urls = [...staticUrls, ...blogUrls].filter((url) => {
  if (seen.has(url.loc)) return false;
  seen.add(url.loc);
  return true;
});

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  "",
  urls.map(renderUrl).join("\n\n"),
  "",
  "</urlset>",
  "",
].join("\n");

fs.writeFileSync(outputPath, xml, "utf8");
console.log(`Sitemap atualizado com ${urls.length} URL(s): ${path.relative(projectRoot, outputPath)}`);
