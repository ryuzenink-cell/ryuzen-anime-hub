# Segurança

Este projeto é um MVP estático sem backend e sem chaves privadas no frontend.

## Política de segredos

- Não commitar `.env`, tokens, senhas, chaves privadas ou credenciais.
- Não inserir chaves de API em HTML, CSS ou JavaScript público.
- Usar apenas APIs públicas que não exijam segredo no navegador.
- Antes de cada push, rodar uma varredura local por termos sensíveis.

Comando sugerido no PowerShell:

```powershell
rg -n --hidden -S "(api[_-]?key|secret|token|password|passwd|credential|private[_-]?key|BEGIN RSA|BEGIN OPENSSH|ghp_|github_pat_|AIza|sk-[A-Za-z0-9])" . --glob "!*.svg" --glob "!.git/**"
```

## Checklist antes de publicar

- Confirmar que `.gitignore` cobre arquivos locais e credenciais.
- Confirmar que não há `.env`, logs, dumps ou arquivos de chave.
- Conferir `git status` antes de adicionar arquivos.
- Fazer commit apenas de arquivos do projeto.
- Revisar URLs externas permitidas pela CSP.
- Testar busca, detalhes do anime e minha lista depois do deploy.

## Superfície pública

O projeto consome a Jikan API v4 no navegador. Dados de lista pessoal ficam no `localStorage` do usuário e não são enviados para servidores da Ryuzen neste MVP.

## Relato de vulnerabilidade

Enquanto o produto ainda está em MVP, registre vulnerabilidades como issue privada ou contato interno da Ryuzen antes de divulgar publicamente.
