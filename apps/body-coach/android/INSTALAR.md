# Body Coach sem barra de endereço (TWA)

O app Android é um TWA (Trusted Web Activity, feito com o Bubblewrap a partir de `twa-manifest.json`).
Ele só abre **em tela cheia, sem a barra de URL**, quando as três coisas abaixo batem:

1. **Manifesto do site** (`public/manifest.webmanifest`): `"display": "standalone"`, `start_url` e `scope` em `/body-coach/`.
2. **Digital do app no assetlinks**: `https://nexiabodycoach.pages.dev/.well-known/assetlinks.json` precisa listar
   a digital SHA-256 do certificado que **assina o app instalado**. Na Play Store quem assina é o Google
   (Play Console > Testar e lançar > Integridade do app > Assinatura de apps > "Certificado da chave de assinatura do app").
   As digitais ficam em `android/assetlinks.json` (chave de envio) e as extras na variável `ASSETLINKS_SHA256`
   do Worker (separadas por vírgula; ver `cloudflare/app.js` e o PR #771). Não troque as chaves de assinatura.
3. **Instalar pela loja**: o atalho "Adicionar à tela inicial" do Chrome sempre mostra a barra de endereço.
   Quem quer o app em tela cheia instala pela Play Store.

## Como conferir o assetlinks

```bash
curl -s https://nexiabodycoach.pages.dev/.well-known/assetlinks.json
# ou pela ferramenta oficial do Google:
# https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://nexiabodycoach.pages.dev&relation=delegate_permission/common.handle_all_urls
```

A resposta precisa ter `app.nexia.bodycoach` com a digital da "chave de assinatura do app" do Play Console.
Se a barra de URL aparecer no app da loja, falta essa digital: copie-a no Play Console e coloque em `ASSETLINKS_SHA256`.

## Página "Instalar o app"

`/body-coach/instalar` (pública, sem login) mostra o caminho certo para cada aparelho:
Android vai para a Play Store; iPhone vê o passo a passo do Safari; no computador aparece o link da loja
e o botão de instalar do navegador. Já instalado: botão "Abrir o app". Código: `src/pages/instalar/page.tsx`
e `src/lib/instalar.ts` (teste em `tests/unit/body-coach-b3-b7.test.js`).
