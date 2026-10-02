# PHASE-7-REPORT.md — Fase 7: NEXIA Bridge (máquina local)

Branch `nexia-ai/fase-7`, base `develop` @ `775dcb0`. Sem deploy, sem credencial, sem regras publicadas. Nenhum arquivo existente do produto foi alterado: tudo novo em `nexia-bridge/` e `tests/unit/bridge.test.js`.

## Entregas

| Pedido (MIGRATION-PLAN Fase 7 / spec §8, §13) | Arquivo | Teste |
|---|---|---|
| Servidor MCP local | `nexia-bridge/lib/mcp.js`, `bin/nexia-bridge.js` | W12 |
| Allowlist de raízes por projeto | `lib/config.js`, `lib/paths.js` | W1, W11 |
| Bloqueio de traversal e symlink | `lib/paths.js` | W1, W2 |
| Denylist/allowlist de comandos | `lib/commands.js` | W4, W8 |
| Modos read-only / write com confirmação (+ autonomous) | `lib/tools.js` (`MODE_MATRIX`, `gate`), `lib/approvals.js` | W5, W6, W7 |
| Nunca enviar `.env` ao modelo | `lib/sensitive.js` | W3, W9, W13 |
| Log de comando, diretório, resultado e agente | `lib/log.js` | W10 |
| Ferramentas workspace.*, terminal.run, git.* | `lib/tools.js` | W3–W9 |
| Instruções de uso | `nexia-bridge/README.md`, `bridge.example.json` | — |

## Saídas cruas (local)

```
$ node --test tests/unit/bridge.test.js
ok 1 - W1. path traversal: .., absoluto fora, UNC, drive relativo e byte nulo são bloqueados
ok 2 - W2. symlink: link para fora do workspace é bloqueado; link interno funciona
ok 3 - W3. .env e credenciais nunca são lidos nem escritos; secrets em arquivos comuns são redigidos
ok 4 - W4. comandos perigosos: deploy/privilégio negados; shell e código arbitrário pedem aprovação; leitura e testes passam
ok 5 - W5. modo read-only: só leitura; escrita, testes, delete e commit são bloqueados
ok 6 - W6. modo write-confirm: o código de aprovação só aparece no terminal do Bridge; o modelo não aprova sozinho
ok 7 - W7. modo autonomous: escrita direta; apagar e comandos de escrita ainda pedem pessoa
ok 8 - W8. terminal.run: sem shell (metacaracteres são texto), sem secrets no ambiente, cwd preso ao workspace
ok 9 - W9. git: status e diff sem arquivos sensíveis; commit não leva .env
ok 10 - W10. registro: comando, diretório, resultado e agente de cada operação, sem conteúdo
ok 11 - W11. configuração: raiz do disco, pasta do usuário, caminho relativo e stateDir dentro do workspace são recusados
ok 12 - W12. MCP por stdio: initialize, tools/list com nomes válidos, chamada, e confirmação por elicitation
ok 13 - W13. redação: SHAs do git ficam; tokens e senhas em URL somem
# tests 13
# pass 13
# fail 0

$ npm test
# tests 75
# pass 75
# fail 0

$ NODE_USE_ENV_PROXY=1 npm run test:rules
# tests 84
# pass 84
# fail 0

$ npm run test:e2e
  55 passed (23.7s)

$ nexia-bridge check   (config com roots ["/"])
[NEXIA Bridge] Configuração inválida: projects[0].roots: a raiz do disco (/) não pode ser um workspace; projects[0].roots: "/" contém a pasta do usuário inteira.
exit=1

$ (stdio) tools/call workspace_read {"path":"../../etc/passwd"}
{"error":{"code":"OUTSIDE_WORKSPACE","message":"Caminho fora das raízes autorizadas do projeto."}}
$ (stdio) tools/call terminal_run {"command":"firebase","args":["deploy"]}
{"error":{"code":"COMMAND_DENIED","message":"firebase deploy: deploy, publicação e credenciais passam pelo pipeline com aprovação, não pelo terminal."}}

$ nexia-bridge log 5
{"ts":"2026-10-02T16:21:57.897Z","agent":"demo","tool":"workspace_read","project_id":"prj_demo","path":"../../etc/passwd","status":"error","error_code":"OUTSIDE_WORKSPACE","duration_ms":7}
{"ts":"2026-10-02T16:21:57.899Z","agent":"demo","tool":"terminal_run","project_id":"prj_demo","command":"firebase deploy","cwd":".","status":"error","error_code":"COMMAND_DENIED","duration_ms":8}
```

READDY não foi rodado de novo: a fase não toca SPA, `server.js` nem funções.

## TEMPORÁRIO / limitações

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| Log só local (`bridge-log.jsonl`) | Bridge ainda não tem credencial para a API | Auditoria central não vê operações locais | Fase 10 |
| Pedidos de confirmação em memória | Não gravar hash do código em disco | Reiniciar o Bridge descarta pedidos (nada executa sem aprovação) | Fase 10 |
| `shell: true` para `npm/npx/pnpm/yarn` no Windows, com recusa de metacaracteres | Atalhos `.cmd` exigem shell no Node | Metacaractere não previsto | Fase 10 |
| Aprovação contornável se o mesmo cliente tiver terminal livre | O Bridge não controla outras ferramentas do cliente | Modelo lê o código no log do cliente | Orientação no README; definitivo quando aprovação local usar a fila do Tool Gateway (Fase 10) |
| Testes do Bridge rodam só em Linux no CI | CI é Ubuntu | Comportamento Windows (caminhos, `.cmd`) coberto só por testes de função | Fase 11 (piloto na máquina do dono; ver PHASE-9-REPORT) |
