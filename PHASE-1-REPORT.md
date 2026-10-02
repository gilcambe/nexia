# PHASE-1-REPORT.md — Fase 1: contenção de segurança e baseline

Repositório `gilcambe/nexia`, branch `nexia-ai/fase-1`, base `develop` @ `46fe332f549f2313bc215dd7d769b34f50483896`. **Sem deploy.** Fases 2 a 11 não implementadas.

## 1. Estado inicial (baseline)
- Node 22.22.0 / npm 10.9.4 local (o Render usa Node 20; o CI usa Node 20).
- `tsc --noEmit`: OK. `vite build`: OK. Não havia testes, CI, `.gitignore`, `firestore.rules` nem `firebase.json` neste repositório.
- `npm audit`: 36 vulnerabilidades (1 crítica, 10 altas, 23 moderadas, 2 baixas).
- Backup lógico: branch `backup/pre-nexia-ai` publicada em `46fe332`. A tag `pre-nexia-ai` foi criada localmente, mas o envio de tags foi recusado pelo proxy desta sessão; ver Pendências.

## 2. O que mudou
| Área | Mudança |
|---|---|
| C1 | `lib/safe-static.js` + `server.js`: estáticos só de raízes públicas, caminho canônico validado, symlinks resolvidos, allowlist de extensões, só GET/HEAD |
| C2 / M2 | `firestore.rules` endurecidas (campos protegidos, perfil novo seguro, memória por dono, catch-all sem afrouxar subcoleções); `core/auth.js` cria perfil `guest` |
| C3 | `middleware.js`: sem promoções automáticas; `MASTER_EMAIL` sem padrão e com e-mail verificado; papel de membro limitado; fail-closed |
| C4 | `sentinel.js`: sem bypass por cabeçalho, POST exige admin, heal desligado por flag, sem escrita no Firestore e sem redeploy |
| A1 | `autocommit.js`: desligado por flag; quando ligado, master + branch não protegido + caminho validado + auditoria |
| A2 | `observability.js`: exige admin, memória limitada, entrada validada |
| A3 | `middleware.js`: modo demo removido |
| A5 | `lib/safe-error.js` com `correlationId`, aplicado em `server.js`, `cortex-chat`, `cortex-agent`, `autocommit`, Sentinel |
| Isolamento | `tenant-admin`, `notifications`, `swarm`, `payment-engine`; `metrics-aggregator` com comparação em tempo constante |
| Correção funcional | `cortex-memory.js`: import ausente que fazia `/api/memory` responder 500 sempre |
| Secrets | Valores removidos do HEAD em `NEXIA_OS_MASTER_DOC_v61.md`; `.gitignore`, `.env.example`, `.gitleaks.toml` |
| READDY | `firestore.rules` (endurecido), `storage.rules` e `firestore.indexes.json` (sem alteração), `firebase.json` (novo, sem hosting), suíte Playwright adaptada às rotas do v60 com `BASE_URL` obrigatório |
| Dependências | `npm audit fix` sem saltos maiores; devDependencies `@firebase/rules-unit-testing` e `@playwright/test` |
| CI | `.github/workflows/ci.yml`: secret scan, `npm ci`, typecheck, unitários, emulador, build, Playwright local |
| Docs | `ARCHITECTURE-DECISIONS.md`, `SECURITY-AUDIT.md`, este relatório |

Comparação com o `READDY` antes de integrar: `storage.rules` e `firestore.indexes.json` vieram iguais; `firestore.rules` do `READDY` permitia o C2 (os testes do emulador falham 6 de 8 contra ele) e foi endurecido; o `firebase.json` do `READDY` tinha seção de hosting e foi substituído por um só com regras e emuladores; a suíte Playwright do `READDY` apontava para produção por padrão e usava rotas antigas, e foi reescrita sobre as rotas do v60.

## 3. Testes e resultados (locais, nesta sessão)
| Verificação | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | OK |
| Build | `npm run build` | OK |
| Unitários e segurança | `npm test` | 12/12 |
| Firestore Emulator (regras + autorização da API) | `npm run test:rules` | 18/18 |
| Playwright contra servidor local | `BASE_URL=http://127.0.0.1:<porta> npm run test:e2e` | 48/48 |
| Secret scan da árvore | `gitleaks dir . --config .gitleaks.toml --redact` | 0 achados |
| Regras de secret disparam | arquivos sintéticos (token estilo Mercado Pago, `.env`, service account, chave GCP fora da allowlist) | 4/4 detectados |
| `npm audit` | — | 26 (0 críticas, 9 altas, 17 moderadas) |

O resultado do CI no GitHub está no PR.

## 4. Dependências
Atualizações dentro das faixas existentes (patch/minor), entre elas `websocket-driver` (a crítica), `protobufjs`, `@grpc/grpc-js`, `@google-cloud/storage`, `body-parser`, `postcss`, `react-router-dom` 6.30.6 e pacotes Babel. Nenhuma versão maior mudou. As 26 restantes só se corrigem com versão maior; ver `SECURITY-AUDIT.md` (A4).

## 5. Limitações
- Nada foi publicado: nem código no Render, nem regras no Firebase, nem nada no Cloudflare.
- A suíte Playwright roda sem Firebase configurado; endpoints que dependem do Firestore respondem 503 e os testes verificam só ausência de crash e de vazamento.
- O repositório de produção `NEXIA_OS`/`NEXIA-OS` não foi visto (D2).

## 6. Pendências (para o dono ou fases seguintes)
1. **Criar a tag `pre-nexia-ai`** em `46fe332` (o proxy desta sessão bloqueia envio de tags): `git tag pre-nexia-ai 46fe332f549f2313bc215dd7d769b34f50483896 && git push origin pre-nexia-ai`, ou pela interface do GitHub (Releases → nova tag no commit). Depois disso a branch `backup/pre-nexia-ai` pode ser apagada.
2. **Rotacionar credenciais** listadas em `SECURITY-AUDIT.md` (C5). Não foi feito automaticamente.
3. **Restringir a chave web do Firebase** por referrer no Google Cloud e ativar App Check.
4. **Decidir sobre o histórico do Git** (contém valores antigos). Reescrever exige autorização explícita.
5. **Publicar as regras do Firestore/Storage** depois de revisar, em janela controlada, e restaurar os masters legítimos antes (procedimento abaixo).
6. Itens abertos: M1, M3, M4, M5, M6, B1; `swarm` com tenant padrão `nexia`; `sentinel-iot` sem checagem de papel/tenant; outras funções que ainda possam devolver `e.message`; Render instala devDependencies.
7. Atualizações maiores de dependência (`firebase-admin` 14, `vite` 6+, `firebase` cliente, `react-router-dom` 7) em fase própria.

### Procedimento manual para restaurar masters legítimos (não executado)
Depois desta fase, uma conta só é `master` por um destes caminhos, todos fora do alcance do próprio usuário:
- **Custom claim (recomendado):** com o Admin SDK e credencial rotacionada, `admin.auth().setCustomUserClaims(uid, { role: 'master' })`; o usuário precisa sair e entrar de novo para o token novo valer.
- **Campo `users/{uid}.role = 'master'`:** editado pelo console do Firebase ou pelo Admin SDK (as regras novas impedem o próprio usuário de gravar esse campo).
- **`MASTER_EMAIL`:** definir explicitamente no ambiente do Render; só vale se o e-mail da conta estiver verificado no Firebase Auth.

Antes de publicar as regras novas, conferir no console quem tem `role: 'master'` hoje em `users/` e remover os que foram promovidos pelas falhas C2/C3.

## 7. Riscos remanescentes
Ver `SECURITY-AUDIT.md`, seção "Riscos remanescentes". O principal: até a rotação das credenciais e o deploy destas correções, a produção continua exposta aos achados originais.

## 8. Fora do escopo (não implementado)
Fases 2 a 11: estrutura `nexia-ai/`, Vault, Model Router, SDK Claude, streaming novo, Tool Gateway, Policy Engine, Bridge/MCP, GitHub App, adapters Firebase/Cloudflare, Orchestrator, agentes, deploy automático e novas funcionalidades de negócio.
