# Public Discovery Backend Hotfix — Pesquisa, Temporadas e Ranking

## Escopo

Esta correção trata a indisponibilidade observada na área pública de descoberta de animes, incluindo pesquisa, ranking, temporada e página de detalhes.

## Causa identificada

A interface pública carregava `assets/js/api.js`, que fazia requisições diretamente do navegador do visitante para `https://api.jikan.moe/v4`. A busca pública, portanto, dependia de chamadas cross-origin sem qualquer camada controlada pelo Ryuzen para:

- normalizar e limitar os parâmetros enviados ao provedor;
- aplicar cache compartilhado no edge;
- reaproveitar resultados recentes em falhas temporárias;
- tratar timeout e indisponibilidade com mensagens estáveis;
- reduzir inconsistências provocadas por versões antigas de assets mantidas em cache `immutable`.

A captura recebida é compatível com esse fluxo falhando: o formulário funciona, mas a chamada externa retorna erro e a tela entra no estado “Algo saiu do roteiro”.

## Solução implementada

### API pública same-origin

Foi criada a Function:

```text
GET /api/discovery
```

Operações aceitas:

| Operação | Parâmetros | Uso público |
| --- | --- | --- |
| `search` | `q`, `page` | Pesquisa por título |
| `top` | `page` | Ranking geral |
| `popular` | `page` | Mais populares |
| `movies` | `page` | Filmes no ranking |
| `airing` | `page` | Em exibição |
| `season_now` | `page` | Temporada atual |
| `season_upcoming` | `page` | Próximas temporadas |
| `upcoming` | `page` | Próximos animes |
| `details` | `id` | Detalhes do anime |

A Function aceita apenas essas operações e monta internamente as URLs permitidas do provedor. Não funciona como proxy aberto.

### Resiliência

A API implementa:

- validação de entrada e limites de página/termo;
- timeout de chamadas externas;
- uma nova tentativa controlada em erros temporários;
- cache de resposta fresca por 5 minutos no data center que atendeu a chamada;
- cache de contingência por até 24 horas, no mesmo cache edge disponível, para servir resposta anterior quando o provedor estiver temporariamente indisponível;
- erros JSON seguros, sem detalhes internos.

Headers de diagnóstico em respostas de sucesso:

```text
X-Discovery-Cache: MISS | HIT | STALE
```

Quando uma resposta anterior é utilizada por indisponibilidade temporária, a resposta inclui também um header `Warning`.

### Frontend

`assets/js/api.js` deixou de acessar a Jikan diretamente. Todas as telas que exibem dados de anime agora chamam:

```text
/api/discovery
```

O navegador passa a falar apenas com a origem do próprio site para esse recurso.

### Cache e service worker

Os assets públicos compartilhados foram unificados na versão:

```text
20260528-public-discovery-v1
```

O service worker foi elevado para:

```text
v1.8.0-public-discovery-proxy
```

Além disso:

- entradas públicas duplicadas ou sem versão foram removidas do pré-cache;
- `/api/*` permanece fora do cache offline do service worker;
- as CSPs públicas não precisam mais liberar conexão direta para `api.jikan.moe`;
- banners laterais foram convertidos de PNG para WebP, reduzindo aproximadamente 4,1 MB para cerca de 442 KB;
- imagens de marca usadas em cabeçalhos e ícones foram ajustadas para evitar downloads desproporcionais em telas públicas e administrativas.

## Arquivos centrais alterados

- `functions/api/discovery.js` — nova API pública intermediária.
- `assets/js/api.js` — cliente same-origin com timeout e erro amigável.
- `service-worker.js` — versão nova e pré-cache público coerente.
- páginas HTML públicas e `functions/_utils/article-template.js` — versão comum/CSP.
- `scripts/validate-public-discovery.mjs` — teste automático de regressão.
- `package.json` — teste incluído no build e no precommit.

## Validações automáticas

Execute:

```bash
npm run test:public-discovery
npm run build
npm run functions:build
```

O teste de descoberta valida:

- o navegador não consulta a Jikan diretamente;
- a nova Function retorna dados em consulta válida;
- entradas inválidas não alcançam o provedor;
- cache fresco evita chamada externa repetida;
- resposta stale é utilizada em falha temporária do upstream;
- os HTMLs públicos carregam assets compartilhados na versão única;
- o service worker recebeu versão capaz de invalidar cache antigo;
- banners e imagens de interface pesadas não voltam ao pacote por regressão.

## Validação após deploy

1. Abrir `/search/?q=Kokoro` em janela anônima.
2. Confirmar que resultados aparecem.
3. No DevTools, conferir requisição para `/api/discovery?operation=search...`, não para `api.jikan.moe`.
4. Abrir Home, Temporada, Ranking, Detalhes e Guia de próximos animes.
5. Fazer recarregamento forçado uma vez para permitir a ativação do service worker atualizado.
6. Verificar no Network que a resposta da pesquisa possui `X-Discovery-Cache`.
7. Confirmar que Blog, Loja e painel administrativo continuam funcionando.

## Limitações honestas

- A nova API torna o fluxo mais controlado e resiliente, mas ainda depende da disponibilidade da fonte externa para pesquisas inéditas que ainda não estejam no cache.
- A disponibilidade real da Jikan a partir da rede Cloudflare somente pode ser comprovada após deploy de preview/produção.
- Caso o serviço receba tráfego alto, recomenda-se configurar uma regra de rate limiting do Cloudflare para `/api/discovery`, preservando a experiência pública e o provedor externo.
