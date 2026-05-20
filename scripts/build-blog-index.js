#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const blogRoot = path.join(projectRoot, "blog");
const outputPath = path.join(projectRoot, "data", "blog-posts.json");

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
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    meta[match[1].trim()] = cleanFrontMatterValue(match[2]);
  }
  return meta;
}

function cleanFrontMatterValue(value = "") {
  return String(value).trim().replace(/^["']|["']$/g, "");
}

const postEntries = walk(blogRoot)
  .map((filePath) => {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
    const markdown = fs.readFileSync(filePath, "utf8");
    const meta = parseFrontMatter(markdown);
    return {
      path: relativePath,
      date: meta.date || "",
      title: meta.title || path.basename(filePath, ".md"),
    };
  })
  .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.title).localeCompare(String(b.title)));

const posts = postEntries.map(({ path }) => ({ path }));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
writeCleanPostPages(postEntries);

console.log(`Índice do blog atualizado com ${posts.length} post(s): ${path.relative(projectRoot, outputPath)}`);

function writeCleanPostPages(entries) {
  const readerPath = path.join(blogRoot, "post", "index.html");
  if (!fs.existsSync(readerPath)) return;

  const readerHtml = fs.readFileSync(readerPath, "utf8");
  for (const entry of entries) {
    const cleanDirectory = path.join(projectRoot, entry.path.replace(/\.md$/i, ""));
    const cleanIndexPath = path.join(cleanDirectory, "index.html");
    fs.mkdirSync(cleanDirectory, { recursive: true });
    fs.writeFileSync(cleanIndexPath, readerHtml, "utf8");
  }
}
