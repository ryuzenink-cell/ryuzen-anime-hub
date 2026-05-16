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
- Compatível com GitHub Pages

## Como rodar localmente

Abra o arquivo `index.html` no navegador.

Opcionalmente, sirva a pasta com um servidor estático simples:

```txt
ryuzen-anime-hub/index.html
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
│   └── images/
├── README.md
├── AGENTS.md
└── PROJECT_CONTEXT.md
```

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
- `blog/post/index.html` (`/blog/post/`): página de leitura do artigo.
- `blog/ANO/MES/*.md`: arquivos dos posts.
- `data/blog-posts.json`: índice estático usado como fallback/local.
- `scripts/build-blog-index.js`: script para recriar o índice a partir dos arquivos `.md`.

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
category: Guias
author: Ryuzen Anime Hub
tags: isekai, fantasia, rezero
cover: assets/images/logo-placeholder.svg
---

# Animes parecidos com Re:Zero

Escreva o conteúdo do post aqui.
```

4. Atualize o índice local antes de subir o site:

```bash
node scripts/build-blog-index.js
```

Em produção, o blog também tenta descobrir automaticamente arquivos `.md` dentro da pasta `blog/` usando a API pública do GitHub. O arquivo `data/blog-posts.json` fica como fallback e facilita testes locais.


## URLs limpas

As páginas foram organizadas em pastas com `index.html`, permitindo acessar rotas como `/search/`, `/anime/`, `/ranking/`, `/blog/` e `/blog/post/` sem exibir `.html` na URL.
