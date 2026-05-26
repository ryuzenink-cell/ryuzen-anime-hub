# Loja Ryuzen — MVP

A Loja Ryuzen é uma vitrine editorial de produtos recomendados com links afiliados da Amazon. O MVP não processa compras, não exibe preços e não utiliza a API da Amazon.

## Rotas

- Página pública: `/loja/`
- Administração: `/admin/loja/`
- Banner promocional: configurado no admin e renderizado na home abaixo dos três cards institucionais.

## Persistência

O módulo reutiliza o banco D1 já usado pelo painel administrativo e pelo blog. A migration aditiva `migrations/0004_store_ryuzen.sql` cria:

- `store_products` — produtos, publicação e ordenação;
- `store_home_banner` — configuração singleton do banner da home;
- `store_clicks` — contagem básica de cliques, sem dados pessoais.

Aplique as migrations no mesmo banco D1 configurado no binding `BLOG_DB` antes de usar a Loja em produção.

## Funcionalidades do admin

Em **Loja**, o administrador pode cadastrar e editar produtos, publicar/despublicar, arquivar, organizar a ordem, filtrar a lista e configurar o banner da home. A tela também exibe métricas básicas de clique quando a migration já foi aplicada.

Os produtos aceitam apenas URL de produto/afiliado pertencente à Amazon ou ao encurtador `amzn.to`. Imagens são informadas via URL externa e contam com fallback visual no site público e na prévia administrativa.

## Transparência comercial

A página pública contém aviso explícito de links afiliados. Os cards direcionam diretamente ao link Amazon cadastrado, abrindo em nova aba com `rel="noopener noreferrer sponsored"`.

## Limites da primeira versão

- Não há preço, carrinho, checkout, API oficial da Amazon ou pop-up promocional.
- Métricas de clique são operacionais e não constituem analytics avançado.
- A qualidade e autorização das imagens externas continuam sob responsabilidade editorial ao cadastrar o produto.

## Refinamento v2

A segunda rodada aprimora a página pública, o banner da home e a área administrativa, além de reforçar validações HTTPS, proteção da publicação rápida e consistência do registro de cliques. Nenhuma migration adicional é necessária. Consulte `docs/LOJA_RYUZEN_REFINEMENT_V2.md` para a auditoria e o roteiro de testes.
