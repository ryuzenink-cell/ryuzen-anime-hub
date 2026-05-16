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

const posts = walk(blogRoot)
  .map((filePath) => ({
    path: path.relative(projectRoot, filePath).replace(/\\/g, "/"),
  }))
  .sort((a, b) => b.path.localeCompare(a.path));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(posts, null, 2)}\n`, "utf8");

console.log(`Índice do blog atualizado com ${posts.length} post(s): ${path.relative(projectRoot, outputPath)}`);
