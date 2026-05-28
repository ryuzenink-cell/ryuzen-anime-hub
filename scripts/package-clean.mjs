import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root=process.cwd(); const outputDir=path.join(root,"dist"); const stage=path.join(outputDir,"ryuzen-anime-hub-clean"); const zipFile=path.join(outputDir,"ryuzen-anime-hub-admin-operations-upgrade.zip");
const excluded = new Set([".git","node_modules",".wrangler",".functions-dist","dist",".DS_Store"]);
const forbiddenNames = [/^\.env(?:\..*)?$/i,/^\.dev\.vars$/i,/\.log$/i,/\.tmp$/i,/\.cache$/i,/^npm-debug\.log/i];
fs.rmSync(stage,{recursive:true,force:true}); fs.mkdirSync(stage,{recursive:true}); fs.mkdirSync(outputDir,{recursive:true});
function copy(dir, target){ for(const entry of fs.readdirSync(dir,{withFileTypes:true})){ if(excluded.has(entry.name)||forbiddenNames.some((re)=>re.test(entry.name))) continue; const src=path.join(dir,entry.name), dest=path.join(target,entry.name); if(entry.isDirectory()){fs.mkdirSync(dest,{recursive:true});copy(src,dest);} else fs.copyFileSync(src,dest); } }
copy(root,stage);
const allowedSecretGenerator = path.join(stage, "scripts", "generate-admin-secrets.mjs");
const secretPattern = /(?:SESSION_SECRET|ADMIN_PASSWORD_HASH|ADMIN_PASSWORD_SALT|BLOG_ADMIN_TOKEN_HASH|BLOG_ADMIN_TOKEN_SALT|TURNSTILE_SECRET_KEY)\s*=\s*["'`]?([A-Za-z0-9_-]{20,})/;
const suspicious = [];
function scanForEmbeddedSecrets(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const current = path.join(dir, entry.name); if (entry.isDirectory()) { scanForEmbeddedSecrets(current); continue; } if (current === allowedSecretGenerator || /\.(png|jpg|jpeg|gif|webp|ico|zip|woff2?)$/i.test(entry.name)) continue; const content = fs.readFileSync(current, "utf8"); if (secretPattern.test(content)) suspicious.push(path.relative(stage, current)); } }
scanForEmbeddedSecrets(stage);
if (suspicious.length) { console.error("Possíveis valores secretos incorporados no pacote:\n" + suspicious.join("\n")); process.exit(1); }
fs.rmSync(zipFile,{force:true}); execFileSync("zip",["-qr",zipFile,path.basename(stage)],{cwd:outputDir,stdio:"inherit"});
const listing=execFileSync("unzip",["-Z1",zipFile],{encoding:"utf8"}); const forbidden=listing.split("\n").filter((line)=>/(^|\/)(?:\.git(?:\/|$)|node_modules(?:\/|$)|\.wrangler(?:\/|$)|\.functions-dist(?:\/|$)|\.env(?:\.|$)|\.dev\.vars(?:\/|$)|[^/]*\.log$)/i.test(line));
if(forbidden.length){ console.error("Pacote contém artefatos proibidos:\n"+forbidden.join("\n")); process.exit(1); }
console.log(`Pacote limpo criado: ${path.relative(root,zipFile)}`);
