# Central Administrativa — Ryuzen Anime Hub

## O que foi implementado

A área administrativa agora possui uma home em `/admin/` e navegação compartilhada para módulos editoriais e operacionais. O login existente continua sendo a única porta de entrada; todas as páginas abaixo requerem sessão administrativa válida.

| Rota | Função |
|---|---|
| `/admin/` | Dashboard com resumo e atividade recente |
| `/admin/blog/` | Posts com filtros, ordenação e ações rápidas |
| `/admin/blog/novo/` | Editor visual com SEO Assistant |
| `/admin/taxonomias/` | Categorias e tags |
| `/admin/banners/` | Banners promocionais por URL |
| `/admin/seguranca/` | Sessão, acessos, auditoria e bloqueios |

## Novos endpoints

Todos os endpoints sob `/api/admin/*` exigem cookie de sessão válido; mutações exigem `X-CSRF-Token`.

- `GET /api/admin/dashboard`
- `GET|POST /api/admin/categories`; `PUT /api/admin/categories/:id`
- `GET|POST /api/admin/tags`; `PUT /api/admin/tags/:id`
- `GET|POST /api/admin/banners`; `PUT /api/admin/banners/:id`
- `POST /api/admin/banners/:id/activate|deactivate|archive`
- `POST /api/admin/posts/:id/duplicate`
- `GET /api/admin/security/summary`
- `POST /api/admin/security/revoke-all-sessions`
- `POST /api/admin/security/clear-login-locks`
- `GET /api/banners` (público: somente banners ativos)

## Migration obrigatória

Execute uma única vez no banco `ryuzen-anime-hub-prod` o arquivo:

```text
migrations/0003_admin_dashboard_banners_taxonomies.sql
```

Ele cria somente a tabela `banners` e índices; não remove nem altera posts, login ou taxonomias existentes.

## Cloudflare necessário

Permanecem necessários:

- Binding D1 `BLOG_DB` → `ryuzen-anime-hub-prod`.
- Secrets de autenticação já existentes (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT`, `BLOG_ADMIN_TOKEN_HASH`, `BLOG_ADMIN_TOKEN_SALT`, `SESSION_SECRET`).
- Turnstile continua opcional conforme documentação anterior.

Nenhum novo Secret é exigido nesta rodada.

## Dashboard

O dashboard mostra apenas dados dinâmicos do CMS. Os três artigos antigos são indicados separadamente como artigos legados estáticos; eles não são misturados na contagem do banco.

## SEO Assistant

O editor avalia título, slug, resumo, conteúdo, categoria, capa/alt, SEO title, meta description, imagem social, headings para sumário, links e imagens internas. Alertas recomendados não impedem salvar rascunho. Publicação é impedida apenas em erros críticos, como conteúdo ausente, imagem sem alt text ou link inseguro.

## Categorias e tags

A tela permite criação e edição sem remoção definitiva. Slugs repetidos são rejeitados pela API/D1. A listagem mostra quantos posts usam cada taxonomia.

## Banners e fallback público

A tabela `banners` utiliza URLs externas de imagem; não há upload. Apenas um banner pode ficar ativo por posição. As posições laterais atuais (`blog_sidebar_left` e `blog_sidebar_right`) substituem dinamicamente os banners padrão quando há configuração ativa. Se a API falhar ou não houver banner ativo, as imagens locais atuais permanecem visíveis.

As posições `blog_inline_horizontal` e `blog_home_featured` ficam cadastráveis para evolução posterior; nesta versão, não existe slot público correspondente no layout atual.

## Segurança e auditoria

A tela de segurança exibe somente informações operacionais sem tokens, secrets, cookies, hashes ou IPs. Permite logout, revogação de sessões e limpeza confirmada de bloqueios temporários. Novas mutações relevantes escrevem em `admin_audit_logs`.

## Teste em produção

1. Faça login em `/admin/login/` e confirme redirecionamento para `/admin/`.
2. Execute a migration `0003` antes de abrir Dashboard/Banners.
3. Crie uma categoria e uma tag em `/admin/taxonomias/`.
4. Crie um rascunho e valide o Checklist SEO.
5. Duplique o rascunho; a cópia deve continuar como rascunho sem data de publicação.
6. Cadastre um banner lateral inativo, ative-o e abra o blog; o slot correspondente deve mudar sem remover o fallback do código.
7. Desative o banner; o banner padrão retorna após recarregar a página.
8. Abra `/admin/seguranca/`, confira a auditoria e execute logout.

## Limitações desta rodada

- Não há biblioteca geral de mídia, calendário editorial, analytics ou usuários adicionais.
- As posições de banner horizontal/destaque já estão no modelo, mas somente as sidebars existentes têm aplicação pública imediata.
- O painel não migra automaticamente artigos Markdown legados para o D1.
