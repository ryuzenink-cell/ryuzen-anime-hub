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
├── search.html
├── anime.html
├── season.html
├── ranking.html
├── my-list.html
├── guides.html
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

## Roadmap

### Fase 1 — MVP estático

- Busca
- Top animes
- Temporada atual
- Página de detalhes
- Minha lista local
- Guias estáticos

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
