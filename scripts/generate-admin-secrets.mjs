import { randomBytes, webcrypto } from "node:crypto";
import readline from "node:readline";
const ITERATIONS = 100000;
const encoder = new TextEncoder();
function hex(bytes) { return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function randomValue(size = 24) { return randomBytes(size).toString("base64url"); }
async function hash(value, salt) {
  const key = await webcrypto.subtle.importKey("raw", encoder.encode(value), "PBKDF2", false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt:encoder.encode(salt), iterations:ITERATIONS }, key, 256);
  return hex(bits);
}
function hiddenPrompt(label) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) throw new Error("Execute em um terminal interativo.");
    process.stdout.write(label);
    let value = "";
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
    const handler = (character) => {
      if (character === "\r" || character === "\n") { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", handler); process.stdout.write("\n"); resolve(value); return; }
      if (character === "\u0003") process.exit(130);
      if (character === "\u007f" || character === "\b") { value = value.slice(0, -1); return; }
      value += character;
    };
    process.stdin.on("data", handler);
  });
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));
const email = (await ask("E-mail do único administrador: ")).trim().toLowerCase();
rl.close();
const password = await hiddenPrompt("Senha administrativa (não será exibida): ");
const adminKey = await hiddenPrompt("Chave administrativa adicional (não será exibida): ");
if (!email || password.length < 12 || adminKey.length < 20) { console.error("Use e-mail válido, senha com pelo menos 12 caracteres e chave com pelo menos 20 caracteres."); process.exit(1); }
const passwordSalt = randomValue(); const adminKeySalt = randomValue();
const [passwordHash, adminKeyHash] = await Promise.all([hash(password, passwordSalt), hash(adminKey, adminKeySalt)]);
console.log("\nCadastre os valores abaixo em Cloudflare Pages → Variables and Secrets → Production.");
console.log("Não salve esta saída em arquivos do repositório e não a compartilhe.\n");
console.log(`ADMIN_EMAIL=${email}`);
console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
console.log(`ADMIN_PASSWORD_SALT=${passwordSalt}`);
console.log(`BLOG_ADMIN_TOKEN_HASH=${adminKeyHash}`);
console.log(`BLOG_ADMIN_TOKEN_SALT=${adminKeySalt}`);
console.log(`SESSION_SECRET=${randomValue(48)}`);
console.log(`\nPBKDF2_ITERATIONS=${ITERATIONS} (valor já fixado no código; não cadastrar)`);
