# Public Discovery Hotfix v4 — conexão resiliente com a Jikan

## Incidente tratado

Após a implementação do proxy `/api/discovery`, a área pública passou a exibir estados de erro na Home, Pesquisa, Temporada e Ranking. No navegador em produção, a requisição a `/api/discovery?operation=top&page=1` retornou HTTP 503.

## Causa raiz

A v3 removeu a consulta pública direta à Jikan e tornou toda a descoberta dependente do fluxo:

```text
Navegador -> Cloudflare Pages Function /api/discovery -> api.jikan.moe
```

A rota do site estava publicada, mas a chamada server-side da Pages Function ao provedor externo falhava no ambiente real. Sem cache anterior no edge, a Function devolvia 503 e todas as telas públicas que dependiam dela ficavam vazias.

A Jikan continua sendo uma API pública sem autenticação, com limites oficiais de 3 requisições por segundo e 60 por minuto. Por isso, nenhuma solução baseada nela pode prometer disponibilidade absoluta; o código deve degradar de forma controlada.

## Correção aplicada

### 1. Proxy sem ponto único de falha

`functions/api/discovery.js` continua aceitando somente operações e parâmetros permitidos, tentando obter e cachear respostas no edge. Contudo, se a consulta server-side falhar e não houver cache stale utilizável, a Function responde com redirecionamento HTTP 307 somente para a URL Jikan montada e validada internamente. Assim, o navegador pode concluir a requisição pela API pública, em vez de receber um 503 definitivo.

O endpoint não se tornou proxy aberto: as únicas rotas externas possíveis continuam sendo as operações whitelisted de anime, temporada, ranking e detalhes.

### 2. Fallback adicional no cliente

`assets/js/api.js` tenta primeiro `/api/discovery`. Caso uma versão antiga da Function ainda responda com falha temporária durante propagação de deploy/cache, o cliente executa um fallback direto controlado para a Jikan.

Esse fallback:

- constrói apenas URLs das operações permitidas;
- valida termo, ID e página antes da chamada;
- serializa consultas diretas com intervalo mínimo de 450 ms para respeitar o limite público;
- usa timeout e mantém cache em memória durante a navegação;
- não expõe tokens nem dados privados, pois a Jikan é usada apenas para leitura pública de catálogo.

### 3. CSP e console limpo

As páginas que podem consumir descoberta agora permitem `https://api.jikan.moe` em `connect-src`. Também foi autorizada a origem oficial `https://static.cloudflareinsights.com` para o beacon do Cloudflare Web Analytics, que aparecia bloqueado no console por CSP.

### 4. Cache/versionamento

Os assets públicos compartilhados foram atualizados para:

```text
20260528-public-discovery-v2
```

E o service worker para:

```text
v1.9.0-public-discovery-resilient
```

Isso força a troca do JavaScript público que anteriormente mantinha o fluxo quebrado. Respostas de `/api/*` continuam fora do cache offline do service worker.

## Fluxo final

```text
1. Interface solicita /api/discovery
2. Function valida operação e tenta cache/consulta server-side
3. Se funcionar: retorna JSON e alimenta cache edge
4. Se a consulta server-side falhar e houver cache antigo: retorna cache stale
5. Se falhar sem cache: redireciona para a URL Jikan validada
6. Se uma Function antiga ainda responder 503: cliente tenta diretamente a URL Jikan validada
```

## Arquivos principais alterados

- `functions/api/discovery.js`
- `assets/js/api.js`
- `service-worker.js`
- páginas públicas que carregam assets/CSP
- `functions/_utils/article-template.js`
- `scripts/validate-public-discovery.mjs`
- `scripts/validate-store.mjs`
- `scripts/package-clean.mjs`

## Como validar antes do deploy

```bash
npm ci --registry=https://registry.npmjs.org/
npm run test:public-discovery
npm run validate:admin
npm run build
npm run functions:build
npm run package:clean
```

## Como validar após deploy

1. Atualize a página com `Ctrl + F5`.
2. Em DevTools > Application > Service Workers, confirme a ativação da versão nova ou use “Update”.
3. Abra a Home e confirme carregamento de Top agora e Animes em exibição.
4. Abra `/ranking/` e teste Top Animes, Mais Populares, Filmes e Em Exibição.
5. Pesquise `Kokoro` em `/search/`.
6. Abra detalhes de um anime.
7. Em Network, observe `/api/discovery`; sucesso poderá ser JSON direto, cache ou redirecionamento controlado para `api.jikan.moe`.
8. Confirme que não há bloqueio CSP do `beacon.min.js` do Cloudflare Web Analytics.
9. Teste Dashboard e Loja no admin para confirmar que não houve regressão.

## Limitações conhecidas

- A origem final de catálogo continua sendo a Jikan; indisponibilidade simultânea do provedor para edge e navegador não pode ser resolvida apenas pelo site.
- O fallback direto é restrito à leitura pública de catálogo e não substitui uma futura base própria ou serviço contratado com SLA.
- Para crescimento do produto, recomenda-se armazenar catálogo essencial próprio no D1 e atualizar dados externos de forma periódica, reduzindo a dependência de disponibilidade em tempo real.
