# Sincronização Pública do CMS e Template Editorial

## Problemas corrigidos

### Post do CMS com aparência diferente

A página dinâmica em `functions/blog/p/[slug].js` usava uma estrutura simplificada e não replicava o markup definitivo das páginas pré-renderizadas: faltavam `container`, `panel`, meta-line editorial, sumário, área de relacionados e a estrutura integral usada pelos artigos Markdown. A renderização dinâmica agora usa `functions/_utils/article-template.js`, que produz o mesmo layout/classes dos artigos estáticos e continua entregando HTML SSR completo.

### Post publicado não visível em `/blog/`

O código-fonte já previa mesclar artigos estáticos e dinâmicos, mas os scripts públicos continuavam referenciados com a mesma versão imutável (`?v=20260524`) e o service worker também mantinha cache anterior. Assim, navegadores com assets antigos podiam continuar carregando uma versão da listagem que não refletia o CMS. Além disso, qualquer falha silenciosa na API mantinha somente os artigos estáticos.

Correções aplicadas:

- nova versão de assets públicos e cache do service worker;
- `GET /api/posts` retorna somente `published`, com `Cache-Control: no-store`, tags e tempo de leitura;
- `/blog/` consulta a API dinâmica com `cache: "no-store"`, preservando fallback dos posts estáticos se a API falhar;
- normalização e remoção de duplicidade por URL/canonical;
- navegação de `/blog/p/*` não recebe fallback incorreto para a página inicial do blog caso um artigo seja arquivado ou inexista.

## Sumário automático

Para posts do CMS, a renderização SSR processa o HTML sanitizado e:

- lê headings `h2` e `h3`;
- cria IDs legíveis e estáveis baseados no texto;
- acrescenta sufixos `-2`, `-3` em headings repetidos;
- gera o bloco `blog-toc` quando existem ao menos dois headings;
- mantém `h3` indentado usando o estilo já existente (`toc-level-3`).

O sumário e os IDs já chegam no HTML inicial da página pública; não dependem de JavaScript do navegador.

## Compatibilidade e segurança preservadas

- Os três artigos Markdown permanecem estáticos e inalterados em seu conteúdo.
- Login administrativo, sessão `HttpOnly`, CSRF, auditoria e rate limiting não foram removidos.
- O conteúdo do CMS continua passando por sanitização allowlist antes de ser renderizado.
- Rascunhos e artigos arquivados continuam fora da API pública e das páginas SSR.

## Limitação desta versão

A seção de posts relacionados em artigos dinâmicos consulta artigos publicados do D1, priorizando a mesma categoria. Os artigos Markdown estáticos continuam exibindo seus relacionados pré-renderizados; a fusão SSR completa de relacionados estáticos e dinâmicos pode ser feita em uma evolução futura sem alterar as URLs atuais.

## Validação em produção

1. Criar um novo artigo com pelo menos dois títulos H2/H3 e salvar como rascunho.
2. Confirmar que ele não aparece em `/blog/`.
3. Publicar o artigo.
4. Atualizar `/blog/` e confirmar que o card aparece automaticamente.
5. Abrir `/blog/p/slug-do-artigo/` e confirmar layout, banners, sumário e metadados.
6. Arquivar o artigo e confirmar que deixa de aparecer em `/blog/` e não abre como post público.
