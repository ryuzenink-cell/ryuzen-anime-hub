#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const avatarsDir = path.join(projectRoot, "assets", "images", "avatars");
const outputPath = path.join(projectRoot, "data", "avatars.json");
const ALLOWED_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);
const SAFE_FILENAME = /^[a-z0-9][a-z0-9._-]*$/;

fs.mkdirSync(avatarsDir, { recursive: true });

const filenames = fs.readdirSync(avatarsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase()))
  .filter((name) => {
    const safe = SAFE_FILENAME.test(name);
    if (!safe) console.warn(`Ignorando avatar com nome de arquivo não seguro: ${name}`);
    return safe;
  })
  .sort((a, b) => a.localeCompare(b));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ avatars: filenames }, null, 2)}\n`, "utf8");
console.log(`Manifesto de avatares atualizado com ${filenames.length} imagem(ns): ${path.relative(projectRoot, outputPath)}`);
