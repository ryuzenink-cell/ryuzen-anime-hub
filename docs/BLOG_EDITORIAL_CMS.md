# CMS Editorial do Blog — Cloudflare Pages + D1

## Escopo

O CMS permite escrever novos artigos em editor visual, salvá-los como rascunho e publicá-los com renderização server-side em `/blog/p/SLUG/`. Os posts Markdown existentes continuam pré-renderizados e funcionando sem alteração.

## Infraestrutura

- Binding D1: `BLOG_DB → ryuzen-anime-hub-prod`.
- Migration editorial: `migrations/0001_blog_editor_cms.sql`.
- Migration de autenticação: `migrations/0002_admin_auth_security.sql`.
- Login: `/admin/login/`.
- Painel protegido: `/admin/blog/`.

A configuração detalhada de sessão, hashes, Turnstile e Cloudflare está em `docs/ADMIN_AUTH_SECURITY.md`.

## Rotas públicas

- `GET /api/health`
- `GET /api/categories`
- `GET /api/posts`
- `GET /api/posts/:slug`
- `GET /blog/p/:slug/`
- `GET /sitemap-blog-dynamic.xml`

## Rotas administrativas

- `GET /api/admin/posts`
- `GET /api/admin/posts/:id`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/:id`
- `POST /api/admin/posts/:id/publish`
- `POST /api/admin/posts/:id/archive`
- `PUT /api/admin/posts/:id/images`

As rotas administrativas exigem sessão `HttpOnly`; mutações também exigem token CSRF. A antiga chave Bearer no frontend foi removida.

## Conteúdo e imagens

- Novos artigos salvam HTML sanitizado em `content_html`.
- `content_markdown` permanece para compatibilidade e é gravado vazio em novos posts.
- Imagens são armazenadas como URL e metadados, nunca como arquivos no D1.
- Imagens exigem URL HTTP/HTTPS e texto alternativo.
- O backend bloqueia scripts, iframes arbitrários, eventos inline e URLs perigosas.

## Publicação gradual

- Posts antigos: Markdown + HTML estático pré-renderizado.
- Posts novos: editor visual + D1 + página SSR.
- Apenas artigos com status `published` aparecem publicamente.
- Não existe exclusão definitiva no painel nesta versão.
