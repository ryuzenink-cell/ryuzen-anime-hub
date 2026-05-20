# Deploy no Cloudflare Pages

Este projeto é um site estático. O GitHub deve ser usado apenas como repositório e o Cloudflare Pages como ambiente de produção.

## Configuração recomendada

No Cloudflare Pages, configure o projeto assim:

- **Production branch:** `main`
- **Build command:** `npm run build`
- **Build output directory:** `/`
- **Deploy command:** `echo ok` caso a interface exija um valor
- **Non-production branch deploy command:** `echo ok` caso a interface exija um valor

O comando `npm run build` apenas recria o índice do blog em `data/blog-posts.json`. Ele não altera layout, CSS ou estrutura visual.

## Domínio de produção

O domínio de produção esperado é:

```txt
anime.ryuzen.ink
```

No DNS da Cloudflare, o subdomínio deve apontar para o projeto Pages:

```txt
Type: CNAME
Name: anime
Target: ryuzen-anime-hub.pages.dev
Proxy status: Proxied
```

## GitHub Pages

Depois que `anime.ryuzen.ink` estiver ativo no Cloudflare Pages, deixe o GitHub Pages desativado para evitar conflito de DNS, SSL e cache.

## Arquivos específicos do Cloudflare

- `_redirects`: mantém URLs antigas com `.html` funcionando e força as rotas limpas.
- `_headers`: define cabeçalhos seguros e cache adequado para assets, dados e service worker.
- `404.html`: página de erro personalizada para rotas inexistentes.

## Observação importante

Não use `npx wrangler deploy` neste projeto estático. Esse comando tenta publicar a pasta inteira como Worker, o que pode incluir arquivos que não deveriam ser enviados e causar erro de asset grande.
