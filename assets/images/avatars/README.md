# Avatares disponíveis

Imagens desta pasta aparecem como opções de foto de perfil para os usuários com conta no Ryuzen Anime Hub.

## Como adicionar um novo avatar

1. Salve o arquivo de imagem aqui (`.webp`, `.png` ou `.jpg`), com um nome curto em minúsculas, sem espaços (use `-`). Ex.: `mio-oculos-azul.webp`.
2. Rode `npm run build` (ou apenas `node scripts/build-avatars-manifest.js`) para regenerar `data/avatars.json`.
3. Suba (commit + deploy) normalmente. Nenhuma outra alteração de código é necessária — o seletor de avatar no site lê `data/avatars.json` automaticamente.

## Recomendações

- Formato quadrado (ex.: 512x512), preferencialmente `.webp` para manter o tamanho baixo.
- O nome do arquivo é público (aparece na URL da imagem) — evite nomes com dados sensíveis.
- Remover um arquivo daqui também remove a opção da galeria no próximo build; usuários que já tinham esse avatar selecionado passam a ver o avatar padrão.
