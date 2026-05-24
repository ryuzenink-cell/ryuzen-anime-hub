# CMS Editorial do Blog — Cloudflare Pages + D1

## Escopo desta versão

Esta versão introduz um painel editorial mínimo para escrever artigos sem Markdown. Os posts antigos continuam sendo gerados a partir de `blog/ANO/MES/*.md`, enquanto novos artigos são gravados no Cloudflare D1 e publicados em páginas server-side em `/blog/p/SLUG/`.

## Configuração necessária no Cloudflare

No projeto Pages `ryuzen-anime-hub`, ambiente **Production**:

1. Binding D1:

```txt
BLOG_DB → ryuzen-anime-hub-prod
```

2. Secret administrativo:

```txt
BLOG_ADMIN_TOKEN → uma chave aleatória longa, nunca commitada
```

A autenticação atual é de MVP: a chave é digitada no painel e mantida apenas em `sessionStorage` durante a aba aberta. Antes de liberar o painel para redatores ou múltiplos usuários, migre para Cloudflare Access ou autenticação com sessão real.

## Migration para o banco já criado

O banco remoto já possui as tabelas principais e `post_images`. Confira antes:

```sql
PRAGMA table_info('posts');
```

Se `content_html` e `social_image_url` ainda não existirem, execute **uma única vez** no Console do banco `ryuzen-anime-hub-prod`:

```sql
ALTER TABLE posts ADD COLUMN content_html TEXT;
ALTER TABLE posts ADD COLUMN social_image_url TEXT;
```

O mesmo SQL está em `migrations/0001_blog_editor_cms.sql`. Se `social_image_url` já existir, execute somente a linha de `content_html`.

O arquivo `migrations/0000_fresh_blog_schema_reference.sql` é uma referência para um banco local/novo, e não deve ser executado no banco de produção já inicializado.

## Rotas criadas

### Painel

- `/admin/blog/` — listagem de artigos, filtro de status e ações.
- `/admin/blog/novo/` — editor de um novo artigo.
- `/admin/blog/editar/?id=ID` — edição de artigo existente.

### API pública

- `GET /api/health`
- `GET /api/categories`
- `GET /api/posts`
- `GET /api/posts/:slug`
- `GET /sitemap-blog-dynamic.xml` — sitemap dos artigos publicados no D1.

### API administrativa protegida

- `GET /api/admin/posts`
- `GET /api/admin/posts/:id`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/:id`
- `POST /api/admin/posts/:id/publish`
- `POST /api/admin/posts/:id/archive`
- `PUT /api/admin/posts/:id/images`

Todas as rotas administrativas exigem o cabeçalho `Authorization: Bearer <BLOG_ADMIN_TOKEN>`.

## Fluxo editorial

1. Acesse `/admin/blog/` e informe a chave administrativa.
2. Clique em **Novo post**.
3. Preencha título, resumo, categoria, conteúdo, SEO e imagens por URL.
4. Clique em **Salvar rascunho**. Todo novo post nasce como `draft`.
5. Use **Pré-visualizar** para conferir o texto.
6. Clique em **Publicar** apenas quando o artigo estiver pronto.
7. O post publicado passa a aparecer no blog e ganha página pública em `/blog/p/SLUG/`.

## Editor e imagens

O editor visual foi implementado em JavaScript puro para preservar a stack simples do projeto e não adicionar um framework ao front-end. Ele suporta parágrafos, H2/H3, negrito, itálico, listas, links, citação, linha horizontal, desfazer/refazer e imagens por URL.

- O título do post é o único H1; H1 dentro do conteúdo é transformado em H2 no backend.
- Imagens internas são inseridas como `<figure>` com legenda, crédito e fonte.
- A URL e o `alt text` são obrigatórios para imagens internas.
- As imagens são armazenadas como links/metadados na tabela `post_images`; nenhum arquivo é enviado ao D1.

## Segurança implementada

- Rotas administrativas bloqueadas sem `BLOG_ADMIN_TOKEN`.
- Posts novos sempre criados como rascunho.
- Nenhuma rota de exclusão definitiva.
- Sanitização allowlist do HTML com parser `htmlparser2` compatível com o runtime Workers, sem habilitar APIs Node no Cloudflare.
- Bloqueio de `<script>`, `iframe`, eventos inline e protocolos perigosos.
- URLs externas limitadas a `http://` e `https://`.
- Queries D1 parametrizadas.
- HTML público de post dinâmico renderizado no servidor, com canonical, Open Graph e JSON-LD `BlogPosting`.
- O painel recebe `noindex,nofollow`.

## Desenvolvimento local

Instale dependências:

```bash
npm install
```

Gere/valide os artigos estáticos existentes:

```bash
npm run build
```

Valide que as Functions compilam:

```bash
npm run functions:build
```

Para testar API/D1 localmente, crie um banco local a partir do schema de referência e rode Pages Dev conforme a versão atual do Wrangler. O binding remoto e o secret não são enviados automaticamente para ambiente local; use apenas uma chave fictícia em desenvolvimento.

## Deploy

Depois de aplicar a migration e configurar `BLOG_ADMIN_TOKEN`, publique pelo GitHub/Cloudflare Pages como já ocorre hoje. O projeto continua usando:

```txt
Build command: npm run build
Build output directory: /
```

As Pages Functions na pasta `/functions` serão detectadas pelo Cloudflare Pages no deploy.

## Migração futura dos posts Markdown

Não há migração automática nesta versão. O `robots.txt` informa tanto o sitemap estático atual quanto `/sitemap-blog-dynamic.xml`, que inclui artigos D1 publicados. O blog mescla a lista estática de `data/blog-posts.json` com os posts publicados vindos da API D1. Em uma etapa futura, os artigos antigos poderão ser convertidos para HTML no banco e revisados individualmente antes de remover suas fontes Markdown.
