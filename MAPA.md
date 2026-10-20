# MAPA do repositório NEXIA

Lido pelo Cortex antes de cada pedido (junto com os arquivos achados pelas palavras do pedido). Curto de propósito: só onde fica cada coisa.

## Produtos e telas
- `src/` site React (Vite) do NEXIA OS no Worker: `src/pages/<tela>/`, rotas em `src/router/index.tsx`, chamadas em `src/services/api.ts`.
- `src/pages/cortex/` app Cortex do dono (/cortex): pedidos, conversa, "Perguntar agora" com streaming.
- `src/pages/central/` Central NEXIA (só o dono). `src/pages/meu-cortex/api.ts` fala com `/api/pedidos`.
- `apps/body-coach/src/` app Body Coach (produto que vende). `apps/*/android/` apps da Play (TWA).
- `sites/bezsan/`, `sites/studiolima/` sites de clientes no ar. `clientes/` material de clientes.
- `divulga/` posts de Instagram/Facebook. `afiliados/` robô de achados. `ces/`, `splash/`, `viajante-pro/`, `core/` páginas legadas.

## Servidor
- `cloudflare/worker.js` + `cloudflare/app.js` Worker (plano grátis): rotas `/api/*` chamam os handlers de `netlify/functions/` (lista fixa em `cloudflare/functions.js`, apelidos em `lib/routes.js`).
- `netlify/functions/<nome>.js` handlers (formato Netlify): `cortex-chat.js` (IA com SSE), `pedidos.js` (fila do Cortex no celular), `body-coach/` e `body-coach-*.js`, `central.js`.
- `server.js` mesmo servidor em Node para testes locais. `lib/` utilidades comuns (stream-response, safe-path).

## Cortex (IA que faz as tarefas)
- `docs/MAPA.md` mapa vivo gerado do código (rotas, segredos só nomes, workflows): `npm run mapa` atualiza.
- `scripts/cortex-fila.js` fila (issues com rótulo `cortex-fila`), roda em `.github/workflows/fila-cortex.yml`.
- `nexia-ai/orchestrator/` passos do pedido (Architect, Coder, Reviewer); `nexia-ai/model-router/` modelos grátis e cotas.
- `nexia-ai/context-engine/` contexto do prompt (Vault + MAPA.md + arquivos prováveis). `nexia-ai/tool-gateway/` ferramentas com permissão.
- `cortex-memory.md` / `memoria-do-cortex.md` decisões do dono que valem para todo pedido.

## Dados e regras
- `firestore.rules`, `storage.rules`: regras do Firebase. Publicar regras só com a palavra do dono.
- `.env.example` nomes dos segredos (valores só no Cloudflare/GitHub). Nome novo também em `nexia-jobs.yml` e `deploy-cloudflare.yml`.

## Testes
- `npm test` = `tests/unit/*.test.js` (node --test). `npm run typecheck`. `npm run test:rules` usa o emulador (`tests/integration/`).
- `tests/e2e/` Playwright. Teste novo: `tests/unit/<assunto>.test.js`.
