# Loja Ryuzen — Correção operacional v3

## Objetivo

Esta atualização corrige dois problemas vistos em produção após a versão de refinamento:

1. o painel da Loja exibia `Não foi possível concluir esta operação.` e não permitia cadastrar produtos quando as tabelas da migration `0004_store_ryuzen.sql` ainda não existiam no D1;
2. a navegação pública podia continuar exibindo a versão anterior do menu por causa de assets cacheados, ocultando o item **Loja** na home e em outras páginas.

## Correções aplicadas

- A área administrativa da Loja agora inicializa, de forma aditiva e idempotente, as tabelas `store_products`, `store_home_banner` e `store_clicks` caso elas ainda não existam. A inicialização ocorre somente em endpoints administrativos autenticados da Loja e não altera tabelas de blog ou autenticação.
- A migration `migrations/0004_store_ryuzen.sql` continua válida e recomendada para provisionamento formal do banco; a inicialização automática evita que uma migration esquecida derrube o painel em produção.
- Todas as páginas públicas passam a solicitar uma versão nova dos assets compartilhados de UI; o `service-worker.js` recebeu nova versão de cache para descartar assets antigos. Isso garante que o menu compartilhado com **Loja** seja servido na home, blog, ranking, temporada, guias e demais páginas públicas.
- Os scripts NPM deixaram de usar a flag incompatível `--experimental-default-type=module` no teste da Loja.
- Foi adicionado `functions/package.json` com `"type": "module"` para que as Functions sejam interpretadas corretamente como ES Modules também na validação local, sem alterar os scripts CommonJS de build na raiz.

## Validação antes do deploy

```bash
npm ci
npm run build
npm run functions:build
npm run test:public-layout
npm run test:store
```

## D1 / Produção

A correção permite que o próprio admin prepare as tabelas faltantes no primeiro acesso autenticado à área Loja. Para manter o histórico de infraestrutura consistente, em um ambiente novo ainda é recomendável aplicar a migration via Wrangler uma única vez:

```bash
npx wrangler d1 execute ryuzen-anime-hub-prod --remote --file="./migrations/0004_store_ryuzen.sql"
```

O comando é idempotente (`CREATE TABLE IF NOT EXISTS` e `INSERT OR IGNORE`), mas não há necessidade de repeti-lo em ambientes já provisionados.
