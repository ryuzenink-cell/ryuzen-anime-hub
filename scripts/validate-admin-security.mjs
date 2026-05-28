import fs from "node:fs";
import path from "node:path";
const errors=[];
const files=[];
function walk(dir){ for(const entry of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,entry.name); if(entry.isDirectory()) walk(p); else if(/\.(js|html)$/.test(entry.name)) files.push(p); } }
walk("assets/js"); walk("admin"); walk("functions");
for (const file of files) { const body=fs.readFileSync(file,"utf8"); if (/BLOG_ADMIN_TOKEN/.test(body) && !file.includes("functions")) errors.push(`${file}: token administrativo referenciado no frontend`); if (/(localStorage|sessionStorage)\s*\.\s*(setItem|getItem)\s*\(\s*["'`](?:token|auth|session|csrf)/i.test(body)) errors.push(`${file}: possível credencial em storage`); }
const middleware=fs.readFileSync("functions/api/admin/_middleware.js","utf8"); if(!middleware.includes("getAdminSession")||!middleware.includes("validateCsrf")) errors.push("Middleware de API admin não valida sessão/CSRF.");
const pageMiddleware=fs.readFileSync("functions/_middleware.js","utf8"); if(!pageMiddleware.includes("protectedPanel")||!pageMiddleware.includes("getAdminSession")) errors.push("Proteção das páginas admin não identificada.");
const exportApi=fs.readFileSync("functions/api/admin/export/editorial.js","utf8"); for(const forbidden of ["admin_sessions","admin_login_attempts","admin_audit_logs","PASSWORD","TOKEN"]) if(exportApi.includes(forbidden)) errors.push(`Exportação contém referência proibida: ${forbidden}`);
if(errors.length){console.error("Validação estática de segurança falhou:\n- "+errors.join("\n- "));process.exit(1);} console.log("Validação estática de segurança aprovada: sessão/CSRF preservados e exportação sem tabelas sensíveis.");
