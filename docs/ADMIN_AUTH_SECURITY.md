# Segurança do Painel Editorial — Login administrativo

## Fluxo implementado

O painel editorial deixou de utilizar a chave administrativa no navegador para autenticar cada requisição. O fluxo atual é:

1. O visitante acessa qualquer página protegida, como `/admin/` ou `/admin/blog/`.
2. O middleware de Pages Functions verifica o cookie de sessão.
3. Sem sessão válida, o servidor redireciona para `/admin/login/` antes de servir o HTML do painel.
4. No login, o único administrador informa e-mail, senha e chave administrativa adicional.
5. O backend compara hashes PBKDF2-SHA-256 e, se configurado, valida Cloudflare Turnstile via Siteverify.
6. O backend cria uma sessão aleatória, grava apenas o hash HMAC do token no D1 e entrega o token em cookie `HttpOnly`.
7. Requisições de mutação exigem também `X-CSRF-Token`, vinculado à sessão.
8. O logout revoga a sessão no D1 e remove o cookie.

Não existe cadastro, recuperação pública de senha ou credencial administrativa armazenada em `localStorage`/`sessionStorage`.

## Migration obrigatória

Execute **uma única vez** no banco D1 `ryuzen-anime-hub-prod`, depois da migration do CMS editorial:

```sql
-- arquivo: migrations/0002_admin_auth_security.sql
```

No painel Cloudflare, abra `D1 SQL Database → ryuzen-anime-hub-prod → Studio`, copie o conteúdo de `migrations/0002_admin_auth_security.sql` e execute. Ela cria apenas:

- `admin_sessions`;
- `admin_login_attempts`;
- `admin_login_locks`;
- `admin_audit_logs`;
- índices de autenticação e auditoria.

A migration não apaga nem altera posts existentes.

## Variables e Secrets no Cloudflare Pages

No projeto `ryuzen-anime-hub`, em **Settings → Variables and Secrets → Production**, configure:

| Nome | Tipo recomendado | Função |
|---|---|---|
| `BLOG_DB` | Binding D1 existente | Banco `ryuzen-anime-hub-prod` |
| `ADMIN_EMAIL` | Secret | E-mail único autorizado |
| `ADMIN_PASSWORD_HASH` | Secret | Hash PBKDF2 da senha |
| `ADMIN_PASSWORD_SALT` | Secret | Salt da senha |
| `BLOG_ADMIN_TOKEN_HASH` | Secret | Hash PBKDF2 da chave adicional |
| `BLOG_ADMIN_TOKEN_SALT` | Secret | Salt da chave adicional |
| `SESSION_SECRET` | Secret | Chave para HMAC de sessões/logs |
| `TURNSTILE_SITE_KEY` | Variable | Site key pública do widget, opcional porém recomendada |
| `TURNSTILE_SECRET_KEY` | Secret | Secret do Turnstile, opcional porém recomendado |

O antigo `BLOG_ADMIN_TOKEN` puro não é usado pelo novo painel e pode ser removido após o deploy desta versão.

## Gerar hashes e segredo de sessão

No computador local, após `npm install`, execute:

```bash
npm run auth:generate-secrets
```

O script solicita:

- e-mail do administrador;
- senha administrativa;
- chave administrativa adicional.

Senha e chave não são exibidas. O script imprime somente os valores que devem ser cadastrados como Secrets no Cloudflare. Não copie a saída para arquivos do repositório e não a envie por chat.

A validação usa PBKDF2-HMAC-SHA-256 com **100.000 iterações**, salts independentes e comparação em tempo constante.

## Cloudflare Turnstile

Turnstile é opcional no desenvolvimento local, mas recomendado em produção:

1. No painel Cloudflare, crie um widget Turnstile para `anime.ryuzen.ink`.
2. Cadastre `TURNSTILE_SITE_KEY` como Variable no Pages.
3. Cadastre `TURNSTILE_SECRET_KEY` como Secret no Pages.
4. Faça novo deploy.

Quando as duas configurações existem, o formulário mostra o widget e o endpoint `/api/auth/login` valida o token no backend pelo Siteverify. Não basta renderizar o widget no frontend.

## Proteções aplicadas

- Cookie de sessão `HttpOnly`, `SameSite=Strict`, `Secure` em produção e expiração absoluta de 8 horas.
- Somente hash HMAC do token de sessão é gravado no D1.
- Apenas uma sessão administrativa ativa por vez; novo login revoga sessões anteriores.
- CSRF exigido em criação, edição, publicação, arquivamento, imagens e logout.
- Middleware protege todos os HTMLs de `/admin/*`, exceto `/admin/login/`, e a API `/api/admin/*`.
- Cinco falhas em 15 minutos criam bloqueio por 30 minutos por origem/identidade hash.
- Auditoria registra login, logout, criação, edição, publicação, arquivamento e alterações de imagens sem armazenar credenciais.
- Headers `no-store`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e CSP nas páginas administrativas.
- Sanitização HTML, validação de URLs e SQL parametrizado do CMS foram preservados.

## Rotas

### Públicas de autenticação

- `GET /admin/login/`
- `GET /api/auth/config`
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout` — exige sessão e CSRF.

### Protegidas

- `/admin/`
- `/admin/blog/`
- `/admin/blog/novo/`
- `/admin/blog/editar/?id=ID`
- `/admin/taxonomias/`
- `/admin/banners/`
- `/admin/seguranca/`
- `/api/admin/*`

## Teste local

Instale dependências e valide o build:

```bash
npm install
npm run build
npm run functions:build
```

Para testar autenticação e D1 com Wrangler, aplique as migrations em banco local e defina valores fictícios em `.dev.vars`. Nunca commite `.dev.vars`; ele já está ignorado pelo Git.

## Defesa adicional futura: Cloudflare Access

Como camada adicional, o domínio pode futuramente proteger `/admin/*` e `/api/admin/*` com Cloudflare Access permitindo apenas o e-mail do proprietário. Essa proteção deve ser adicional; a sessão interna implementada neste projeto continua necessária para defender a aplicação e registrar auditoria.
