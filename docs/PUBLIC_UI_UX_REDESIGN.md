> Nota posterior: a arquitetura de descoberta e o versionamento público foram atualizados no hotfix descrito em `docs/PUBLIC_DISCOVERY_BACKEND_HOTFIX.md`; afirmações históricas abaixo devem ser lidas no contexto da rodada original.

# Redesign público — Ryuzen Discovery

## Escopo

Esta rodada altera somente a experiência pública do Ryuzen Anime Hub. O dashboard administrativo, autenticação, Pages Functions de dados, D1, migrations e regras do CMS não foram modificados funcionalmente. A única adaptação em Function é a inclusão da camada visual pública no template SSR dos artigos dinâmicos, mantendo consulta, SEO e regras de publicação existentes.

## Diagnóstico anterior

- A home comunicava o produto, mas tinha aparência de MVP e dependia visualmente de blocos carregados pela API.
- A navegação mobile apenas quebrava o menu em múltiplas linhas.
- Cards não ofereciam ação direta para a lista pessoal e carregavam imagem grande quando uma capa de card seria suficiente.
- O footer ainda transmitia caráter experimental.
- Busca, temporada, ranking, detalhes e lista possuíam UI funcional, porém pouco conectada à experiência editorial madura do blog.
- Artigos precisavam de ferramentas de leitura e melhor tratamento de imagens internas.
- Assets públicos não eram versionados de forma consistente em todas as páginas.

## Direção visual

A camada `assets/css/public-ui.css` introduz a linguagem **Ryuzen Discovery**: superfícies escuras premium, gradientes azul/violeta, cards elevados, tipografia mais clara, espaçamentos consistentes, microinterações discretas e comportamento responsivo aprimorado.

## Alterações principais

### Componentes compartilhados

- Header público premium e sticky com navegação reduzida no desktop.
- Drawer acessível e navegação inferior no mobile.
- Footer institucional com rotas reais e ligação com a Yorokobi Studio.
- Anime Card 2.0 com botão rápido para a lista, badge contextual e imagem dimensionada para card.
- Skeletons, empty states, toasts e botões harmonizados.
- Link “Pular para o conteúdo”, foco visível e suporte a `prefers-reduced-motion`.

### Home

- Hero com busca, CTAs prioritários, painel Top Agora e pílulas de proposta de valor.
- Faixa de recursos e seções com hierarquia editorial mais clara.
- CTA final para Minha Lista e bloco editorial com ligação à Yorokobi Studio.

### Exploração

- Busca com resumo de resultados e ação de limpar.
- Temporada com toolbar premium e contador de títulos filtrados.
- Ranking com abas acessíveis, top 3 destacado e ação direta de lista.
- Detalhes do anime com backdrop visual, capa de alta prioridade e ações mais claras.
- Minha Lista com aviso de armazenamento local, busca interna e progresso de episódios.

### Blog e artigos

- Blog recebe a mesma camada visual pública sem alterar a integração entre posts estáticos e CMS.
- Artigos recebem barra de progresso, copiar link, compartilhamento e botão voltar ao topo.
- Sumários longos tornam-se recolhíveis em mobile.
- Imagens internas passam a preservar a proporção, evitando cortes indevidos.
- Artigos SSR dinâmicos carregam apenas a nova camada visual e de leitura, mantendo o SEO já implementado.

### Navegação secundária

- “Mercado de Mangás” substitui o rótulo ambíguo “Mangás” na navegação secundária.
- Guias deixa de competir no menu principal e permanece acessível no menu expandido/footer.

## Performance e cache

- Todas as páginas públicas alteradas carregam assets versionados com `?v=20260526public-ui-v1`.
- O service worker passou para `v1.5.0-public-ui` e pré-cacheia `public-ui.css` e `public-ui.js` versionados.
- Cards utilizam imagem média disponível da Jikan; imagem grande permanece reservada para detalhes.
- Imagens de cards recebem dimensões, `loading="lazy"` e `decoding="async"`.

## Arquivos públicos criados

- `assets/css/public-ui.css`
- `assets/js/public-ui.js`
- `docs/PUBLIC_UI_UX_REDESIGN.md`

## Arquivos públicos alterados

- `index.html`
- `search/index.html`
- `season/index.html`
- `ranking/index.html`
- `anime/index.html`
- `my-list/index.html`
- `blog/index.html`
- `blog/post/index.html`
- `guides/index.html`
- `vendas-mangas/index.html`
- `404.html`
- `offline.html`
- `assets/js/ui.js`
- `assets/js/storage.js`
- `assets/js/home.js`
- `assets/js/search.js`
- `assets/js/season.js`
- `assets/js/ranking.js`
- `assets/js/anime.js`
- `assets/js/my-list.js`
- `service-worker.js`
- `functions/_utils/article-template.js` (somente apresentação pública SSR/asset visual)

## Limitações preservadas

- A observação original de consumo client-side foi superada pelo hotfix de descoberta: os dados de anime agora passam por `/api/discovery`, conforme `docs/PUBLIC_DISCOVERY_BACKEND_HOTFIX.md`.
- A página de detalhes ainda não é SSR nesta rodada.
- Exportação/importação da lista e filtros avançados dependem de uma rodada futura.
- A imagem de hero institucional não inventa obra em destaque; utiliza o ranking já disponível para o painel lateral.

## Testes recomendados após deploy

1. Acessar home em desktop e mobile e confirmar menu/drawer/bottom nav.
2. Buscar um anime, adicionar/remover pelo card e confirmar Minha Lista.
3. Abrir Temporada e Ranking, alternar filtros/tabs.
4. Abrir detalhes e salvar uma obra.
5. Validar Blog, artigo estático e artigo dinâmico publicado pelo CMS.
6. Testar barra de progresso, compartilhar/copy e voltar ao topo.
7. Confirmar que `/admin/login/` e `/admin/` continuam sem efeitos visuais da camada pública.
8. Em atualização antiga cacheada, atualizar uma vez após o novo service worker assumir controle.

## Validações executadas nesta entrega

- `npm ci --no-audit --no-fund` concluído usando dependências do registro público.
- `npm run build` concluído: índice e páginas estáticas do blog regenerados e sitemap atualizado.
- `npm run functions:build` concluído: Pages Functions compiladas sem alteração de lógica administrativa ou de dados.
- `node --check` executado para os JavaScripts públicos modificados e `service-worker.js`.
- Validação estrutural de 15 páginas públicas: inclusão única da camada `public-ui`, versionamento dos assets e isolamento da área administrativa.
- Validação de 8 páginas administrativas: nenhuma referência aos novos assets/classes públicos.
- Validação dos três artigos estáticos: canonical e JSON-LD preservados.
- Validação da estratégia PWA: os assets públicos versionados essenciais foram incluídos no pré-cache do novo service worker.
- `git diff --check` sem erros de whitespace.
- Conferência de escopo: em `functions/`, apenas o template visual público dos artigos dinâmicos foi ajustado; nenhum arquivo de `admin/` ou `migrations/` foi alterado.
- Conferência do `package-lock.json`: sem referências a registry interno inacessível.

### Validação visual disponível

Foram geradas capturas da home em desktop/mobile, ranking e artigo mobile durante a rodada de implementação, permitindo conferir o novo layout, a navegação compacta e o comportamento editorial. Após o refinamento final de `prefers-reduced-motion` e do pré-cache PWA, a repetição da automação no navegador foi impedida por uma política do Chromium disponível no ambiente (`ERR_BLOCKED_BY_ADMINISTRATOR` para qualquer navegação, inclusive páginas locais). Por isso, não se afirma uma nova bateria visual automatizada após esse refinamento final; as alterações finais foram validadas por build, sintaxe e checagens estruturais.

## Validação recomendada após deploy

Além do roteiro funcional abaixo, validar visualmente em produção em 1440 px, 1280 px, 768 px, 390 px e 360 px, com atenção especial a capas reais da API, drawer mobile, bottom navigation, cards com ação rápida e carregamento de dados externos.

## Correção posterior — posicionamento dos banners laterais

O redesign ampliou a largura máxima pública de `1160px` para `1240px`, enquanto a regra legada dos banners fixos ainda posicionava os rails com base na largura anterior. Em telas desktop, isso podia fazer os banners encostarem ou invadirem os cards laterais das seções da home.

A correção aplicada recalcula os offsets dos rails com `--public-max`, preserva um gutter real entre promoção e conteúdo e oculta os banners quando a viewport não comporta com segurança os dois rails e a coluna principal. O versionamento dos assets e a versão do service worker também foram atualizados para impedir que navegadores mantenham a regra antiga em cache.


## Ajuste v7 — Blog e ferramentas do artigo

- A página inicial do blog deixa de exibir rails laterais: seu hero usa toda a área editorial e os banners sobrepunham o título em telas largas. Os banners continuam disponíveis em páginas compatíveis, incluindo artigos quando há margem lateral segura.
- O cartão de compartilhamento dos artigos deixou de ser `sticky`; agora permanece no topo do post, sem acompanhar a rolagem nem disputar espaço com a leitura.
- Os atalhos de compartilhamento agora possuem ícones consistentes para copiar link, WhatsApp e X.
- O sumário móvel recebeu controle expansível real, com `aria-controls`, `aria-expanded`, rótulo dinâmico e lista efetivamente aberta/fechada no JavaScript.

## Correção preventiva de layout da home editorial do blog — v8

### Causa raiz

A camada pública do redesign aplicava `max-width: 920px` diretamente a `.page-hero`. Na maioria das páginas, o hero já vive dentro de um container; em `/blog/`, no entanto, a seção `page-hero` envolve o container e o grid do post em destaque. A restrição foi aplicada à seção inteira, comprimindo o hero à esquerda e deixando um grande espaço vazio na página. A ocultação dos banners tratava somente a sobreposição visual e não removia essa causa estrutural.

### Correção

- A restrição global indevida foi removida de `.page-hero`.
- A home editorial recebeu escopo explícito `blog-index-page` e `data-public-layout="blog-index"`.
- O grid do hero de `/blog/` agora ocupa o container público completo e colapsa corretamente no responsivo.
- Seções compactas da landing do blog receberam espaçamento próprio para evitar grandes vazios entre categorias e posts.
- `renderPromoSidebars()` não cria banners na home editorial do blog; o CSS mantém uma proteção de fallback para navegadores com script antigo em cache.

### Prevenção de regressão

Foi adicionado `scripts/validate-public-layout.mjs`, executado por `npm run build` e `npm run precommit`. Ele interrompe o build caso:

- a home do blog perca seu identificador de layout;
- a regra global que limita o hero completo seja reintroduzida;
- os rails promocionais possam voltar a ser criados na landing editorial;
- a proteção CSS de fallback seja removida.

Assim, futuras alterações visuais que reintroduzam o mesmo tipo de bug falharão antes do deploy.
