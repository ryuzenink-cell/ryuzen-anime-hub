# Ryuzen Anime Hub — Admin Operations Upgrade / Backend Hotfix v2

## Hotfix v2 — falha de carregamento do Dashboard

Após o primeiro deploy do upgrade administrativo, o Dashboard poderia retornar erro genérico e permanecer em “Carregando...” quando o código novo fosse publicado antes da execução da migration `0005_admin_operations_upgrade.sql`. A causa era objetiva: `GET /api/admin/dashboard`, o backup editorial e a edição de produtos consultavam `store_products.link_review_status` sem verificar se a coluna já existia no D1.

A correção v2 torna o deploy compatível com as duas fases:

1. **Antes da migration 0005:** Dashboard, Loja, edição de produtos e backup continuam funcionando; a interface informa que a revisão manual de links aguarda a migration, e a ação específica retorna erro seguro `409`, em vez de derrubar o painel.
2. **Após a migration 0005:** os botões e alertas de revisão manual de links são habilitados normalmente.

A API detecta a capacidade via `PRAGMA table_info(store_products)` e não executa `ALTER TABLE` silencioso durante requisições. Também foi criado teste de integração com SQLite/D1 compatível que reproduz os cenários antes e depois da migration.


## 1. Causa real do bug da Loja na sidebar

A navegação era criada por `assets/js/admin-shell.js`, que já continha **Loja**, mas as páginas administrativas referenciavam versões de cache incompatíveis: páginas antigas usavam `?v=20260526admin-center`, enquanto `/admin/loja/` usava `?v=20260526-store-operational-v3`. Como `/assets/*` utiliza cache `immutable`, navegadores podiam executar shells distintos no mesmo painel.

## 2. Correção estrutural e política de cache

Todas as páginas administrativas autenticadas agora carregam `admin-shell.js`, `admin-shell.css`, `admin-auth.js`, `admin-ui.js` e seus assets administrativos com a versão comum `?v=20260528-admin-v3`. O shell é a única fonte da sidebar e contém Dashboard, Posts, Novo post, Categorias e Tags, Banners, Loja, Segurança e Auditoria, Ver site público e Sair.

`_headers` já impedia cache de páginas `/admin/*` (`Cache-Control: no-store`) e preserva assets versionados como `immutable`. O `service-worker.js` foi ajustado para não pré-cachear assets admin nem responder assets `admin-*` por cache; o painel depende da rede e da sessão válida. Ao alterar o shell no futuro, altere a versão comum em todas as páginas e atualize o valor validado por `scripts/validate-admin-shell.mjs`.

## 3. Testes preventivos

`npm run validate:admin` executa:

- `scripts/validate-admin-shell.mjs`: falha se uma página admin não carregar shell/UI, se houver versões divergentes ou se itens obrigatórios, inclusive Loja, forem removidos;
- `scripts/validate-admin-security.mjs`: verifica estaticamente proteção central por sessão/CSRF, ausência de token administrativo no frontend e exclusão de tabelas sensíveis do backup;
- `scripts/validate-admin-backend.mjs`: executa as APIs com uma base SQLite compatível com D1, cobrindo Dashboard, Loja e backup **antes** da migration 0005, além de CRUD editorial/comercial, APIs públicas, revisão de links, busca, destaque, restauração e bloqueio real de sessão/CSRF **depois** da migration.

O comando foi incorporado a `npm run build` e `npm run precommit`.

## 4. Funcionalidades implementadas

### Operação e UX

- sidebar unificada, recolhível no desktop e drawer com ESC/fechamento por navegação em mobile;
- preferência visual da sidebar salva em `localStorage` apenas como UI, nunca credencial;
- toasts acessíveis e diálogo global reutilizável para ações sensíveis;
- busca global protegida no shell para posts, produtos, categorias, tags e banners.

### Dashboard

- **Pendências de hoje** com itens derivados de dados reais: rascunhos, SEO/social/capa/categoria incompletos, produtos incompletos, links não revisados/antigos e banner da Loja inativo;
- resumo **Loja Ryuzen — desempenho recente**, com status de produtos, banner, cliques dos últimos sete dias e produto mais clicado;
- aviso explícito de que cliques não representam conversões;
- **Continue de onde parou** e informação do destaque editorial atual;
- botão de exportação de backup editorial.

### Loja

- ordenação visual por botões acessíveis `↑` e `↓`, com persistência no campo existente `sort_order` e auditoria;
- checklist de publicação: rascunhos podem ser salvos incompletos, mas publicação bloqueia nome, descrição, link Amazon HTTPS, imagem HTTPS e texto alternativo ausentes/inválidos;
- revisão manual de links: **Revisado hoje** e **Verificar link**, com status e auditoria após a migration 0005;
- fallback seguro pré-migration: Loja permanece utilizável e informa que a revisão manual ainda não foi habilitada;
- banner e métricas preservados.

### Editorial

- histórico de versões no editor: lista, prévia textual segura e restauração confirmada;
- restauração salva backup automático antes de aplicar a revisão, sanitiza HTML restaurado e não altera status de publicação;
- destaque editorial controlado: apenas post publicado pode ser marcado, e o destaque anterior é removido no mesmo batch.

### Backup

`GET /api/admin/export/editorial` exporta somente conteúdo editorial/comercial: posts, categorias, tags, vínculos, banners, produtos e configuração pública da Loja. Não exporta sessões, tentativas de login, auditoria, hashes, cookies, tokens ou secrets. A resposta usa `Cache-Control: no-store`.

## 5. Rotas e endpoints novos

- `GET /api/admin/search?q=termo`
- `GET /api/admin/export/editorial`
- `POST /api/admin/store/products/:id/move-up`
- `POST /api/admin/store/products/:id/move-down`
- `POST /api/admin/store/products/:id/mark-link-reviewed`
- `GET /api/admin/posts/:id/revisions`
- `POST /api/admin/posts/:id/revisions/:revisionId/restore`
- `POST /api/admin/posts/:id/feature`

O endpoint existente `GET /api/admin/dashboard` foi ampliado para pendências, resumo da Loja, recentes e destaque. Todo `/api/admin/*` continua atravessando middleware de sessão; POST/PUT/PATCH/DELETE exigem CSRF.

## 6. Migration D1

Arquivo: `migrations/0005_admin_operations_upgrade.sql`.

Cria apenas:

- coluna aditiva `store_products.link_review_status`, com valores `not_reviewed`, `reviewed` e `needs_check`;
- índices de ordenação e revisão de links.

Execução em produção, após backup e confirmação de que `0004_store_ryuzen.sql` já foi aplicada. O ZIP recebido não contém configuração Wrangler com o nome/UUID do banco remoto; substitua `<NOME_OU_UUID_DO_BANCO_D1>` pelo banco ligado ao binding `BLOG_DB` no Cloudflare Pages:

```bash
npx wrangler d1 execute <NOME_OU_UUID_DO_BANCO_D1> --remote --file=./migrations/0005_admin_operations_upgrade.sql
```

Validação:

```bash
npx wrangler d1 execute <NOME_OU_UUID_DO_BANCO_D1> --remote --command="PRAGMA table_info(store_products);"
npx wrangler d1 execute <NOME_OU_UUID_DO_BANCO_D1> --remote --command="SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_store_products_order','idx_store_products_link_review');"
```

Não execute o `ALTER TABLE` novamente na mesma base; uma segunda execução da migration completa falhará por coluna já existente. O deploy da v2 pode ser publicado antes da migration sem derrubar o Dashboard ou a Loja: apenas a marcação manual de revisão ficará desabilitada até que a coluna seja criada. Isso evita alterações de schema implícitas durante requisições administrativas.

## 7. Empacotamento limpo

Gerar entrega:

```bash
npm run package:clean
```

Saída: `dist/ryuzen-anime-hub-public-discovery-hotfix-v3.zip`.

O script exclui `.git`, `node_modules`, `.wrangler`, `.functions-dist`, `dist`, `.env*`, `.dev.vars`, logs, caches e temporários, e valida novamente o ZIP antes de concluir. Confira manualmente antes do deploy:

```bash
unzip -Z1 dist/ryuzen-anime-hub-public-discovery-hotfix-v3.zip | grep -Ei '(^|/)(\.git(/|$)|node_modules(/|$)|\.wrangler(/|$)|\.functions-dist(/|$)|\.env([./]|$)|\.dev\.vars(/|$))|\.log$'
```

A saída deve ser vazia.

## 8. Testes locais

```bash
npm ci --registry=https://registry.npmjs.org/
npm run validate:admin
npm run test:admin-backend
npm run build
npm run functions:build
npm run package:clean
```

Para verificar registries inesperados:

```bash
grep -n "registry" package-lock.json | grep -v "registry.npmjs.org" || true
```

## 9. Configurações Cloudflare a conferir

- binding D1 `BLOG_DB` apontando para o banco correto;
- secrets de autenticação existentes permanecendo somente no ambiente Pages/Workers;
- aplicação da migration `0005` para habilitar revisão manual de links; o restante do painel permanece operacional antes dela;
- deployment incluindo `_headers`, `service-worker.js` e as Functions novas;
- nenhuma variável secreta incluída no ZIP.

## 10. Roteiro de validação em produção

1. Fazer login e confirmar cookie/sessão normal.
2. Visitar Dashboard, Posts, Novo post, Editar post, Categorias e Tags, Banners, Loja e Segurança; confirmar **Loja** em todas as sidebars.
3. Recarregar e testar mobile/desktop, recolher sidebar e efetuar logout.
4. No Dashboard, validar Pendências, Loja, recentes, destaque e exportação JSON.
5. Na Loja, salvar rascunho incompleto; tentar publicar produto inválido; completar checklist; publicar; reordenar; marcar link revisado; marcar para verificação.
6. Em Posts, editar artigo para criar revisão; pré-visualizar/restaurar; conferir que status não mudou; marcar um publicado como destaque e confirmar fallback quando não houver destaque.
7. Testar busca global com termo de post/produto/categoria/tag/banner.
8. Confirmar que endpoints admin sem sessão retornam não autorizado e que mutações sem CSRF falham.

## 11. Git

```bash
git checkout -b feat/admin-operations-upgrade
git add admin assets functions migrations scripts service-worker.js package.json docs _headers
git commit -m "feat(admin): unify shell and add operations dashboard tooling"
git push -u origin feat/admin-operations-upgrade
```

## 12. Limitações conhecidas e próxima fase

- A deduplicação antifraude de cliques não foi introduzida nesta rodada para não adicionar identificadores ou alterar o backend público sem validação adicional de privacidade e volume; o painel exibe corretamente que clique não é conversão.
- Testes locais agora incluem integração de APIs com SQLite compatível com D1 nos cenários pré e pós-migration. Neste ambiente Linux, `functions:build` não concluiu usando o `node_modules` histórico disponível, pois ele contém o binário nativo `@cloudflare/workerd-windows-64`; execute `npm ci` no ambiente de deploy/preview para baixar `@cloudflare/workerd-linux-64` ou o binário adequado à sua máquina e então rode o build de Functions. O comportamento com D1 remoto, headers finais do Pages e sessão real deve ser confirmado no deploy de preview/produção.
- Próxima fase recomendada: avaliação de deduplicação temporária de cliques com hash efêmero/privacidade revisada.
