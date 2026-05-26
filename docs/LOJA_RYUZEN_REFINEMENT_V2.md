# Loja Ryuzen — Refinamento v2

## Objetivo

Esta rodada evolui a primeira versão da vitrine afiliada sem alterar seu posicionamento comercial: a Ryuzen recomenda produtos editoriais e encaminha a compra para a Amazon, sem preço manual, carrinho ou checkout próprio.

## Auditoria realizada sobre o MVP

A análise identificou os seguintes pontos na implementação anterior:

- URLs de produto e de imagem aceitavam `http://`, apesar de a Loja exigir navegação e mídia externas seguras.
- A ação rápida de publicar alterava o status sem revalidar integralmente o registro armazenado.
- A API pública de cliques aceitava combinações inconsistentes de origem/destino e IDs de produtos não publicados.
- A API pública de produtos enviava campos que não eram necessários na interface pública.
- A página pública possuía estados básicos, mas não oferecia retry em falha de carregamento nem defesa adicional contra links inválidos recebidos da API.
- O admin concentrava as funções em uma única tela extensa, sem prévia real do banner, bloqueio visual durante salvamento ou confirmação acessível própria para arquivamento.

## Melhorias implementadas

### Página pública `/loja/`

- Hero e bloco de transparência visualmente refinados.
- Barra de categorias adaptada a telas estreitas com rolagem local segura.
- Resumo de quantidade de produtos carregados.
- Cards alinhados, com CTA fixado na base, texto complementar de consulta na Amazon e limites visuais para textos longos.
- Renderização dos produtos com nós DOM e `textContent`, evitando interpolação de conteúdo administrativo como HTML.
- Validação defensiva no front-end de links Amazon HTTPS.
- Estado de falha com botão **Tentar novamente** e estado vazio preservado.
- Fallback visual de imagem preservado.

### Banner da home

- Renderização reescrita com DOM seguro.
- Refinamento visual responsivo mantendo a posição original, abaixo dos três cards institucionais.
- Link do CTA permanece fixado em `/loja/`.
- Erros da API ou da métrica continuam sem quebrar a home.

### Administração `/admin/loja/`

- Organização em três seções: **Produtos**, **Banner da Home** e **Métricas**.
- Indicadores superiores simplificados para publicados, rascunhos e cliques.
- Formulário dividido em campos públicos e organização interna.
- Validação imediata de HTTPS/Amazon, texto obrigatório e tentativa de HTML nos campos textuais.
- Bloqueio de envio repetido enquanto o formulário está salvando.
- Prévia mais completa do card e prévia visual do banner.
- Diálogo acessível de confirmação para publicar, despublicar ou arquivar.
- Métrica de produtos mais clicados apresentada de forma simples.
- Layout administrativo adaptado para desktop e mobile.

### APIs e segurança

- Produto afiliado e imagem agora exigem URL HTTPS no backend.
- A publicação rápida passa a revalidar o produto existente antes de mudar seu status.
- A API pública retorna apenas os campos necessários à vitrine.
- Produtos com link afiliado inválido não são enviados ao público; imagens antigas inválidas caem no fallback sem remover o produto válido da seleção.
- Cliques em produto somente são registrados quando o produto existe e está publicado; combinações inválidas de origem/destino são rejeitadas.
- Links externos continuam usando `target="_blank"` e `rel="noopener noreferrer sponsored"`.

## Persistência e migrations

Nenhuma alteração de schema foi necessária neste refinamento. A migration existente continua suficiente:

- `migrations/0004_store_ryuzen.sql`

Em ambiente novo, `0000_fresh_blog_schema_reference.sql` é uma base de referência e não deve ser executada junto com a migration incremental `0001_blog_editor_cms.sql`, que se destina a um banco de posts já existente. Para validar a Loja em banco local novo, a sequência compatível é `0000`, `0002`, `0003` e `0004`.

## Testes executados nesta entrega

- `npm ci --no-audit --no-fund`
- `npm run build`
- `npm run functions:build`
- `node --check` nos scripts e Functions modificados.
- Aplicação local SQLite da sequência de schema novo `0000 + 0002 + 0003 + 0004`, incluindo inserção de produto, ativação de banner e registro de clique.
- Validação automatizada adicionada em `scripts/validate-store.mjs`, incluindo as regras de URLs HTTPS, link Amazon, publicação protegida, exposição pública mínima, banner interno e rota/sitemap.
- Teste unitário de execução das Functions com banco simulado para conferir exposição pública mínima, fallback de imagem, CTA interno e registro de clique apenas para produto publicado.
- Renderização visual em Chromium headless por harness controlado com payloads de API simulados, nas dimensões desktop e mobile, para Loja, banner da home e admin, sem overflow horizontal ou erros de JavaScript.
- Interações automatizadas no harness visual: filtro público, estado vazio, erro com retry, atributos seguros de link, troca de aba administrativa e bloqueio de URL maliciosa no formulário.

## Limitações preservadas do MVP

- Sem preço, desconto, estoque ou avaliações da Amazon.
- Sem API oficial da Amazon.
- Sem carrinho, checkout ou pop-up promocional.
- A métrica de cliques permanece agregada e simples; o endpoint público não representa proteção completa contra tráfego automatizado.
