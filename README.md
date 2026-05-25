# Ryuzen Anime Hub

MVP estático de uma plataforma brasileira de informações de animes para o ecossistema Ryuzen, pensado para o futuro subdomínio `anime.ryuzen.ink`.

## Objetivo

Criar uma experiência navegável para fãs brasileiros pesquisarem animes, verem rankings, acompanharem a temporada atual, abrirem detalhes de obras e salvarem uma lista pessoal local no navegador.

## Tecnologias

- HTML5
- CSS3
- JavaScript puro
- LocalStorage
- Jikan API v4
- Sem frameworks, backend ou build step
- PWA instalável no Android/Chrome
- Compatível com GitHub Pages

## Como rodar localmente

Para testar apenas as páginas, você ainda pode abrir `index.html` no navegador.

Para testar corretamente os recursos de app/PWA, use um servidor local:

```bash
npx serve .
```

ou:

```bash
python -m http.server 8080
```

## Publicação no GitHub Pages

1. Envie esta pasta para um repositório GitHub.
2. Em Settings > Pages, selecione a branch principal.
3. Use a pasta raiz do projeto como origem.
4. Aponte futuramente `anime.ryuzen.ink` para a URL publicada.

## Estrutura

```txt
ryuzen-anime-hub/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── offline.html
├── search/
│   └── index.html
├── anime/
│   └── index.html
├── season/
│   └── index.html
├── ranking/
│   └── index.html
├── my-list/
│   └── index.html
├── guides/
│   └── index.html
├── vendas-mangas/
│   └── index.html
├── assets/
│   ├── css/
│   ├── js/
│   ├── icons/
│   └── images/
├── README.md
├── AGENTS.md
└── PROJECT_CONTEXT.md
```


## PWA / App Android

O projeto já possui a primeira camada de aplicativo como PWA:

- `manifest.webmanifest`: define nome, ícones, tema, atalhos e abertura em modo `standalone`;
- `service-worker.js`: registra cache básico, navegação offline parcial e fallback para `offline.html`;
- `assets/icons/`: ícones 192x192, 512x512, maskable e Apple touch icon;
- `assets/js/ui.js`: registra o Service Worker e exibe o botão **Instalar app** quando o navegador permitir;
- `docs/ANDROID_APP_PWA.md`: guia de teste e próxima etapa para empacotar como Android/TWA.

Próxima fase recomendada: validar o PWA em produção e gerar o app Android com TWA usando PWABuilder ou Bubblewrap.

## API usada

Dados públicos da [Jikan API v4](https://docs.api.jikan.moe/), uma API não oficial para dados do MyAnimeList.

Endpoints principais:

- `/top/anime`
- `/seasons/now`
- `/anime?q=...`
- `/anime/{id}/full`

## Segurança

- O MVP não usa chaves privadas nem variáveis de ambiente no frontend.
- A publicação deve seguir o checklist em `docs/SECURITY_CHECKLIST.md`.
- A política básica de segurança está documentada em `SECURITY.md`.
- As páginas usam CSP, política de referrer e restrição de permissões por meta tags.
- URLs externas vindas da API são validadas antes de renderizar imagens ou trailers.

## Roadmap

### Fase 1 — MVP estático

- Busca
- Top animes
- Temporada atual
- Página de detalhes
- Minha lista local
- Guias estáticos
- Aba inicial de mercado de mangás por mês com base JSON local

### Fase 2 — Melhorias

- Filtros avançados
- Calendário semanal
- Recomendações
- Exportar/importar lista
- Modo claro/escuro
- SEO melhorado

### Fase 3 — Produto real

- Next.js
- Backend
- Supabase/PostgreSQL
- Login
- Listas na nuvem
- Reviews
- Notas dos usuários Ryuzen
- Painel editorial
- Newsletter

## Próximos passos

- Refinar identidade visual definitiva da Ryuzen.
- Criar componentes de recomendações por gênero.
- Adicionar cache leve para reduzir chamadas repetidas.
- Preparar domínio e publicação inicial.
- Completar a base mensal de mercado de mangás para que os detalhes batam 100% com o resumo financeiro.


## Dashboard de Mercado de Mangás

A página `vendas-mangas/index.html` (`/vendas-mangas/`) representa vendas de mangás no Japão e indicadores internacionais do mercado. A identidade da tela é de análise editorial de mercado, não operação de loja.

As bases do dashboard ficam dentro da pasta `data/` seguindo este padrão:

```txt
data/
├── manga-market-index.json
├── 2025/
│   └── manga-market-2025-annual.json
└── 2026/
    ├── 01/
    │   └── manga-market-2026-01.json
    ├── 02/
    │   └── manga-market-2026-02.json
    └── 03/
        └── manga-market-2026-03.json
```

O arquivo `data/manga-market-index.json` é um índice opcional para nomear as bases exibidas no seletor. Além dele, o script `assets/js/manga-sales.js` também tenta encontrar automaticamente arquivos que sigam estes nomes:

- apuração anual: `data/ANO/manga-market-ANO-annual.json`;
- apuração mensal: `data/ANO/MM/manga-market-ANO-MM.json`.

Exemplo: para adicionar janeiro de 2026, crie `data/2026/01/manga-market-2026-01.json`.

## Blog em Markdown

O projeto agora possui uma área editorial em Markdown:

- `blog/index.html` (`/blog/`): listagem dos posts.
- `blog/post/index.html` (`/blog/post/`): leitor legado que redireciona URLs antigas e não deve ser indexado.
- `blog/ANO/MES/*.md`: fontes editoriais dos posts.
- `blog/ANO/MES/SLUG/index.html`: página completa gerada automaticamente para cada artigo.
- `data/blog-posts.json`: índice público com metadados usados na listagem e em posts relacionados.
- `scripts/build-blog-index.js`: gerador das páginas estáticas, metadados SEO, dados estruturados e índice do blog.

### Criar um novo post

1. Crie a pasta do ano e mês, por exemplo:

```txt
blog/2026/05/
```

2. Crie um arquivo `.md`, por exemplo:

```txt
blog/2026/05/animes-parecidos-com-rezero.md
```

3. Use este modelo no início do arquivo:

```md
---
title: Animes parecidos com Re:Zero
description: Recomendações para quem gosta de fantasia sombria, loops temporais e protagonistas sofridos.
date: 2026-05-16
updated: 2026-05-24
category: Guias
author: Ryuzen Anime Hub
tags: isekai, fantasia, rezero
cover: assets/images/logo-placeholder.png
---

# Animes parecidos com Re:Zero

Escreva o conteúdo do post aqui.
```

4. Execute o build antes de publicar ou testar as URLs finais:

```bash
npm run build
```

O build gera o índice, o sitemap e um `index.html` pré-renderizado para cada Markdown. O HTML final já contém título, descrição, canonical, Open Graph, Twitter Card, `BlogPosting`, índice navegável para textos longos e conteúdo legível sem depender de JavaScript.

A listagem pública utiliza somente `data/blog-posts.json`, evitando requisições em tempo de navegação à API pública do GitHub. No Cloudflare Pages, mantenha `npm run build` como comando de build; no GitHub Pages, execute o comando localmente e publique os arquivos gerados.


## URLs limpas

As páginas foram organizadas em pastas com `index.html`, permitindo acessar rotas como `/search/`, `/anime/`, `/ranking/` e `/blog/` sem exibir `.html` na URL. Cada post também possui sua própria página estática em `/blog/ANO/MES/SLUG/`; `/blog/post/` existe apenas para compatibilidade com links antigos.

## Deploy em produção com Cloudflare Pages

Este projeto agora está preparado para Cloudflare Pages. Use o GitHub apenas como repositório e deixe o Cloudflare Pages publicar a branch `main`.

Configuração recomendada:

- **Build command:** `npm run build`
- **Build output directory:** `/`
- **Deploy command:** `echo ok` se a interface exigir um comando
- **Non-production branch deploy command:** `echo ok` se a interface exigir um comando

Depois que `anime.ryuzen.ink` estiver ativo no Cloudflare Pages, mantenha o GitHub Pages desativado para evitar conflitos. Mais detalhes estão em `docs/CLOUDFLARE_PAGES_DEPLOY.md`.



## Painel Editorial dinâmico — Cloudflare D1

O blog possui um CMS progressivo para novos artigos, preservando os posts Markdown existentes:

- `/admin/login/`: acesso exclusivo do administrador;
- `/admin/blog/`: painel editorial protegido por sessão segura;
- editor visual HTML para escrever artigos sem Markdown;
- imagens por URL com texto alternativo, crédito e fonte;
- Pages Functions em `/functions` para API pública, autenticação e administração;
- D1 acessado pelo binding `BLOG_DB`;
- páginas dinâmicas publicadas com HTML server-side em `/blog/p/SLUG/`;
- posts legados em Markdown continuam pré-renderizados e operacionais.

Antes do deploy, aplique `migrations/0001_blog_editor_cms.sql` quando necessário e `migrations/0002_admin_auth_security.sql`, configure os Secrets administrativos e, preferencialmente, o Cloudflare Turnstile. Consulte `docs/BLOG_EDITORIAL_CMS.md` e `docs/ADMIN_AUTH_SECURITY.md`.

## Central Administrativa (v1)

A área `/admin/` agora reúne dashboard, posts, SEO Assistant, taxonomias, banners e segurança/auditoria. Antes do deploy desta versão, execute no D1 de produção a migration `migrations/0003_admin_dashboard_banners_taxonomies.sql`. Consulte `docs/ADMIN_CONTROL_CENTER.md` para rotas, APIs e roteiro de validação.
