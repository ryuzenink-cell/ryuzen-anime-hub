# Contexto do Projeto — Ryuzen Anime Hub

O Ryuzen Anime Hub é um produto digital da marca Ryuzen.

A Ryuzen será uma marca/ecossistema de tecnologia, cultura geek, novels, ferramentas digitais e serviços editoriais. O site principal `www.ryuzen.ink` será institucional. O subdomínio `anime.ryuzen.ink` será dedicado ao hub de animes.

O objetivo do Ryuzen Anime Hub é criar uma central brasileira para fãs de anime descobrirem obras, acompanharem temporadas, consultarem rankings, verem detalhes de animes e montarem suas listas pessoais.

A inspiração conceitual é o MyAnimeList, mas o projeto deve ter identidade própria, visual próprio e foco no público brasileiro.

O frontend utiliza HTML, CSS e JavaScript puro, sem framework. O produto está publicado no Cloudflare Pages e utiliza Pages Functions/D1 para CMS, Loja e administração. Os dados públicos de animes são obtidos da Jikan API v4 por uma camada same-origin em `/api/discovery`, com cache e tratamento de indisponibilidade.

O projeto deve priorizar:

- interface em português brasileiro;
- design moderno e responsivo;
- busca de animes;
- rankings;
- temporada atual;
- página de detalhes;
- lista pessoal salva no navegador;
- área editorial futura chamada Guias Ryuzen.

O projeto não deve copiar layout, textos, cores exatas, marca ou identidade visual do MyAnimeList. A referência deve ser apenas funcional e conceitual.

Roadmap futuro:

1. Experiência pública com descoberta e lista local.
2. CMS, Loja e administração segura em Pages Functions/D1.
3. Melhorias de UX, recomendações, monitoramento e comunidade.
