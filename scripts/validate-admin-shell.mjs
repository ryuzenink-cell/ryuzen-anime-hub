import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const requiredPages = ["admin/index.html","admin/blog/index.html","admin/blog/novo/index.html","admin/blog/editar/index.html","admin/taxonomias/index.html","admin/banners/index.html","admin/loja/index.html","admin/seguranca/index.html"];
const expectedLabels = ["Dashboard","Posts","Novo post","Categorias e Tags","Banners","Loja","Segurança e Auditoria","Ver site público","Sair"];
const expectedVersion = "20260703-admin-v5";
const shell = fs.readFileSync(path.join(root,"assets/js/admin-shell.js"),"utf8");
const errors = [];
for (const label of expectedLabels) if (!shell.includes(label)) errors.push(`Shell não contém o item: ${label}`);
for (const file of requiredPages) {
  if (!fs.existsSync(path.join(root,file))) { errors.push(`Página ausente: ${file}`); continue; }
  const html = fs.readFileSync(path.join(root,file),"utf8");
  for (const asset of ["/assets/js/admin-shell.js","/assets/css/admin-shell.css"]) {
    const hit = html.match(new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "\\?v=([^\"']+)"));
    if (!hit) errors.push(`${file}: não carrega ${asset}`);
    else if (hit[1] !== expectedVersion) errors.push(`${file}: versão divergente de ${asset}: ${hit[1]}`);
  }
  if (!html.includes(`/assets/js/admin-ui.js?v=${expectedVersion}`)) errors.push(`${file}: não carrega UI compartilhada`);
}
const allAdmin = fs.readdirSync(path.join(root,"admin"), { recursive:true }).filter((file) => String(file).endsWith(".html") && !String(file).includes("login"));
for (const relative of allAdmin) {
  const file = path.join("admin", String(relative)); const html = fs.readFileSync(path.join(root,file),"utf8");
  if (!html.includes(`/assets/js/admin-shell.js?v=${expectedVersion}`)) errors.push(`${file}: página autenticada sem shell versionado`);
}
const obsolete = [];
for (const relative of fs.readdirSync(path.join(root,"admin"), { recursive:true })) {
  if (!String(relative).endsWith(".html")) continue; const file=path.join(root,"admin",String(relative)); const html=fs.readFileSync(file,"utf8");
  if (/admin-center|store-operational|editor-workflow/.test(html)) obsolete.push(path.relative(root,file));
}
if (obsolete.length) errors.push(`Versões obsoletas encontradas em: ${obsolete.join(", ")}`);
if (errors.length) { console.error("Validação do shell administrativo falhou:\n- " + errors.join("\n- ")); process.exit(1); }
console.log(`Admin shell validado: ${requiredPages.length} páginas usando ${expectedVersion}; item Loja e módulos obrigatórios presentes.`);
