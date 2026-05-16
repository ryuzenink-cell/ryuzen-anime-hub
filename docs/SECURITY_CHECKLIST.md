# Checklist de Push Manual Seguro

Use este fluxo quando for subir mudanças manualmente para o GitHub.

1. Verifique arquivos alterados:

```powershell
git status --short
```

2. Procure segredos:

```powershell
rg -n --hidden -S "(api[_-]?key|secret|token|password|passwd|credential|private[_-]?key|BEGIN RSA|BEGIN OPENSSH|ghp_|github_pat_|AIza|sk-[A-Za-z0-9])" . --glob "!*.svg" --glob "!.git/**"
```

3. Procure arquivos que não devem ir:

```powershell
Get-ChildItem -Recurse -Force -Include .env*,*.pem,*.key,*.log,node_modules,dist,build,coverage
```

4. Adicione arquivos de forma consciente:

```powershell
git add .gitignore .gitattributes SECURITY.md README.md AGENTS.md PROJECT_CONTEXT.md index.html search.html anime.html season.html ranking.html my-list.html guides.html assets docs
```

5. Revise o que será commitado:

```powershell
git diff --cached --stat
git diff --cached
```

6. Commit e push:

```powershell
git commit -m "Harden static MVP security"
git push
```
