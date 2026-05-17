# Transformar o Ryuzen Anime Hub em app Android

Este projeto já recebeu a primeira camada de aplicativo: PWA.

## O que foi adicionado

- `manifest.webmanifest`: nome, ícones, tema, atalhos e modo standalone.
- `service-worker.js`: cache básico, suporte parcial offline e fallback para `offline.html`.
- `offline.html`: tela simples para quando o usuário estiver sem conexão.
- Ícones em PNG dentro de `assets/icons/`.
- Registro do Service Worker e botão de instalação no `assets/js/ui.js`.
- Metatags PWA em todas as páginas HTML.

## Como testar localmente

Use um servidor local, não abra o arquivo direto pelo Windows Explorer.

```bash
npx serve .
```

Depois acesse o endereço local no Chrome e abra:

```txt
DevTools > Application > Manifest
DevTools > Application > Service Workers
DevTools > Lighthouse
```

## Como testar em produção

1. Suba os arquivos para o GitHub.
2. Acesse `https://anime.ryuzen.ink`.
3. No Android/Chrome, procure a opção **Instalar app**.
4. Rode o Lighthouse e verifique a categoria **Progressive Web App**.

## Próxima fase: Play Store

Depois de validar o PWA em produção, use uma TWA com PWABuilder ou Bubblewrap para gerar o `.aab` de publicação.

Fluxo recomendado:

1. Validar `https://anime.ryuzen.ink/manifest.webmanifest`.
2. Validar `https://anime.ryuzen.ink/service-worker.js`.
3. Gerar pacote Android com PWABuilder ou Bubblewrap.
4. Configurar asset links para provar que o app pertence ao domínio.
5. Gerar e assinar o `.aab`.
6. Enviar para o Google Play Console.
