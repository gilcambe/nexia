# Viajante Pro na Hostinger — migração

> Pasta: `hostinger/viajante-pro/` · Branch: `migracao/hostinger-viajante` · Branch publicada: `deploy/hostinger-viajante`

## 1. Arquitetura nova (em uma frase)
Um **app Node.js da Hostinger** (plano Business, servidor no Brasil) serve as **mesmas páginas** e roda a **mesma API**
(`netlify/functions/viajante-pro.js`, sem mudar a lógica). Por baixo, uma **camada adaptadora** troca só a infraestrutura:

| Antes | Agora | Arquivo |
|---|---|---|
| Worker Cloudflare (páginas + API) | App Node.js da Hostinger (`server.js`, sem Express) | `server.js` |
| Firestore (`viajante_contas/viajantepro/*`) | MySQL da Hostinger, tabela `vp_documentos` (documento = JSON) com a **mesma interface** do Firestore | `lib/docstore.js`, `lib/drivers.js` |
| Brevo (API HTTP) | SMTP da Hostinger (`smtp.hostinger.com:465`) — as chamadas ao Brevo são interceptadas | `lib/email-smtp.js` |
| SDK Firebase no navegador (páginas antigas guia/passageiro) | `firebase-hostinger.js` com a mesma interface, gravando em `/api/vp-docs` | `public/firebase-hostinger.js` |
| Fotos no Firestore (base64) | Fotos no MySQL (base64), servidas pela mesma URL `/api/viajante-pro?foto=…` | — |
| DNS/SSL Cloudflare | DNS da Hostinger (já é) + SSL grátis do hPanel | — |

Nenhuma página HTML, CSS, texto ou rota foi alterada. A única mudança fora desta pasta: o link do painel no e-mail de cotação
agora vem de `VP_PAINEL_URL` (padrão continua o endereço da Kernex).

Rotas: as mesmas do Worker (`/viajante-pro`, `/viajante-pro/cotacoes`, `/viajante-pro/viagens`, `/viajante-pro/editar`,
`/viajante-pro/admin`, `/viajante-pro/app`, `/vp/guia`, `/vp/passageiro`…) e **`/` abre a landing**. `/saude` mostra se o banco responde.

## 2. Como fazer deploy (1 passo: push)
1. Qualquer push no `develop` (ou na branch da migração) que mexa no Viajante roda o workflow **"Viajante Pro - deploy Hostinger"**:
   testa ponta a ponta → monta o pacote → atualiza a branch **`deploy/hostinger-viajante`**.
2. A Hostinger está ligada a essa branch e **publica sozinha**.
3. Plano B: em Actions → última execução → *Artifacts* → baixar `viajante-pro-hostinger.zip` e subir em hPanel → app Node.js → *Upload*.

## 3. Variáveis (só na Hostinger; modelo em `.env.example`)
`DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASS` · `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` ·
`LEADS_NOTIFY_EMAIL` · `VP_PAINEL_URL` · `FORCE_HTTPS`. Nunca coloque valores reais no GitHub.

## 4. Passo a passo no hPanel
1. **Banco:** hPanel → Sites → viajante.pro → Bancos de dados → Gerenciamento → *Criar um Novo Banco* →
   nome `viajantepro`, usuário `viajantepro`, senha forte → **Criar**. (Fica `u955456572_viajantepro`.)
2. **Tabelas:** na linha do banco novo → **Acesse o phpMyAdmin** → *Importar* → `sql/schema.sql` → Executar →
   *Importar* de novo → `sql/seed.sql` (dados de exemplo) → Executar.
3. **E-mail:** hPanel → E-mails → viajante.pro → *Criar conta de e-mail* → `contato@viajante.pro` (e `cotacao.site@viajante.pro` se ainda não existir).
4. **App Node.js:** hPanel → Sites → **Adicionar site** → **Node.js web app** → *Importar repositório Git* → Conectar GitHub →
   repositório `gilcambe/nexia`, branch **`deploy/hostinger-viajante`**, Node **22**, diretório raiz `/`,
   build `build`, arquivo de entrada **`server.js`** → usar o **domínio temporário** oferecido → **Deploy**.
5. **Variáveis:** no app → *Variáveis de ambiente* → copiar do `.env.example` com os valores reais → salvar → **Reiniciar**.
6. **Testar** no domínio temporário (checklist abaixo). Abrir `/saude` → deve mostrar `"banco":"ok"`.
7. **Virada (com confirmação do dono — já autorizada em 10/11):** remover o site WordPress antigo do `viajante.pro`
   (Sites → viajante.pro → ⋮ → Excluir) e conectar o domínio `viajante.pro` (e `www`) ao app Node.js → ativar **SSL** (Segurança → SSL → Instalar).
   O banco antigo do WordPress (`u955456572_lNYr3`) pode ser apagado depois que o site novo estiver no ar.

## 5. Como reverter
- **Site:** o Viajante Pro continua funcionando na Kernex (`nexia.gcbezerra.workers.dev/viajante-pro`) — nada foi desligado lá.
  Para voltar o domínio: hPanel → apontar `viajante.pro` de novo para o site anterior (ou restaurar o backup diário do WordPress em Sites → Backups).
- **Código:** reverter o PR. A pasta `hostinger/` e o workflow não afetam nenhum outro produto.
- **GitHub (triagem):** tirar `pausado-migracao-hostinger` e repor os rótulos da tabela abaixo.

## 6. O que foi pausado no GitHub (10/11/2026)
Issues: tirado `cortex-fila`, posto `pausado-migracao-hostinger` + comentário. PRs: tirado `automerge`, postos `revisao-manual` e `pausado-migracao-hostinger` + comentário.
Nenhum workflow foi desativado (o `deploy-cloudflare.yml` publica todos os produtos; desligar derrubaria os outros).

| Nº | Tipo | Título | Rótulos ANTES (para reativar) |
|---|---|---|---|
| #3299 | ISSUE | Viajante Pro: versão 100% Hostinger (PHP + MySQL + e-mail Hostinger),  | `cortex-fila,cortex-dividido,prioridade` |
| #3300 | ISSUE | Viajante Pro: exportar os dados do Firestore para um arquivo .sql (MyS | `cortex-fila,cortex-travado,cortex-prioridade,jules-enviado,cortex-jules,prioridade,dono-agora` |
| #3301 | ISSUE | Produto-base Kernex Roteiro (cópia genérica do Viajante Pro, sem a mar | `cortex-fila` |
| #3357 | ISSUE | Viajante Pro Hostinger A: base da API configurável nas páginas | `cortex-fila,tentativa-2,tentativa-3,cortex-dividido,viajante-pro,reserva-tentou,prioridade,dono-agora` |
| #3358 | ISSUE | [Parte 1/6 de #3299] Viajante Pro Hostinger: base PHP (banco, sessão,  | `cortex-fila,cortex-rodando,tentativa-6,cortex-parte,pista-5,viajante-pro,reserva-tentou,prioridade,dono-agora` |
| #3359 | ISSUE | [Parte 2/6 de #3299] Viajante Pro Hostinger: cotações e e-mail | `cortex-fila,cortex-parte,cortex-prioridade,viajante-pro,prioridade,dono-agora` |
| #3360 | ISSUE | [Parte 3/6 de #3299] Viajante Pro Hostinger: viagens, fotos e site | `cortex-fila,cortex-parte,cortex-prioridade,viajante-pro,prioridade,dono-agora` |
| #3361 | ISSUE | [Parte 4/6 de #3299] Viajante Pro Hostinger: chat e app da viagem | `cortex-fila,cortex-parte,cortex-prioridade,viajante-pro,prioridade,dono-agora` |
| #3362 | ISSUE | [Parte 5/6 de #3299] Viajante Pro Hostinger: área do passageiro | `cortex-fila,cortex-parte,cortex-prioridade,viajante-pro,prioridade,dono-agora` |
| #3363 | ISSUE | [Parte 6/6 de #3299] Viajante Pro Hostinger: instalador e pacote zip | `cortex-fila,cortex-parte,cortex-prioridade,viajante-pro,prioridade,dono-agora` |
| #3393 | ISSUE | [Parte 1/7 de #3357] Criar configuração global | `cortex-fila,cortex-parte,cortex-prioridade` |
| #3394 | ISSUE | [Parte 2/7 de #3357] Inserir config nas primeiras três páginas | `cortex-fila,cortex-parte,cortex-prioridade` |
| #3395 | ISSUE | [Parte 3/7 de #3357] Inserir config nas próximas três páginas | `cortex-fila,cortex-parte,cortex-prioridade` |
| #3396 | ISSUE | [Parte 4/7 de #3357] Inserir config nas duas últimas páginas | `cortex-fila,cortex-parte,cortex-prioridade` |
| #3397 | ISSUE | [Parte 5/7 de #3357] Atualizar fetch em módulos de landing, cotacoes e | `cortex-fila,cortex-parte,cortex-prioridade` |
| #3398 | ISSUE | [Parte 6/7 de #3357] Atualizar fetch em módulos de editar, admin e pas | `cortex-fila,cortex-parte,cortex-prioridade` |
| #3399 | ISSUE | [Parte 7/7 de #3357] Atualizar fetch em guide e app | `cortex-fila,cortex-parte,cortex-prioridade` |
| #2606 | ISSUE | Viajante Pro: cotação por etapas, e-mail da cotação, CMS lendo do banc | `cortex-fila,tentativa-2,tentativa-3,cortex-dividido,viajante-pro,reserva-tentou` |
| #2617 | ISSUE | Viajante Pro: botão 'Trocar senha' na página Cotações | `cortex-fila,tentativa-2,tentativa-3,reserva-tentou` |
| #2618 | ISSUE | Viajante Pro 1/4: cotação por etapas no site | `cortex-fila,tentativa-2,tentativa-3,viajante-pro,reserva-tentou` |
| #2619 | ISSUE | Viajante Pro 2/4: backend do app - criar viagem, link do app e chat | `cortex-fila,tentativa-2,tentativa-3,cortex-dividido,viajante-pro,reserva-tentou` |
| #2620 | ISSUE | Viajante Pro 3/4: página Viagens e Conversas no painel | `cortex-fila,cortex-dividido,viajante-pro` |
| #2621 | ISSUE | Viajante Pro 4/4: editar o site no lugar e destinos ilimitados | `cortex-fila,cortex-dividido,viajante-pro` |
| #2640 | ISSUE | [Parte 1/4 de #2619] API viajante‑pro | `cortex-fila,cortex-parte` |
| #2641 | ISSUE | [Parte 2/4 de #2619] Helper cliente viajante‑pro | `cortex-fila,cortex-parte` |
| #2648 | ISSUE | Kernex VP 1: uma base só (app do passageiro usa /api/viajante-pro; rem | `cortex-fila,cortex-dividido,cortex-prioridade,viajante-pro` |
| #2649 | ISSUE | Kernex VP 2: animação do avião única (2-3 s, a cada 5 min, sem acumula | `cortex-fila,tentativa-2,cortex-prioridade,viajante-pro,reserva-tentou,dono-agora` |
| #2650 | ISSUE | Kernex VP 3: cotação com protocolo, sem duplicar, LGPD, propostas e e- | `cortex-fila,cortex-dividido,cortex-prioridade,viajante-pro,reserva-tentou,dono-agora` |
| #2651 | ISSUE | Kernex VP 4: painel sem acesso direto ao banco (clientes, passageiros, | `cortex-fila,tentativa-2,tentativa-3,cortex-dividido,viajante-pro,reserva-tentou` |
| #2652 | ISSUE | Kernex VP 5: catálogo administrável (destinos, pacotes, ofertas, banne | `cortex-fila,tentativa-2,tentativa-3,cortex-dividido,viajante-pro,reserva-tentou` |
| #2653 | ISSUE | Kernex VP 6: usuários e permissões, histórico de alterações e configur | `cortex-fila,tentativa-2,tentativa-3,cortex-dividido,viajante-pro,reserva-tentou` |
| #2654 | ISSUE | Kernex VP 7: conta do passageiro no app (perfil, minhas viagens, cotaç | `cortex-fila,tentativa-2,tentativa-3,cortex-dividido,viajante-pro,reserva-tentou` |
| #2655 | ISSUE | Kernex VP 8: atendimento real (enviada/entregue/lida, não respondidas, | `cortex-fila,viajante-pro` |
| #2656 | ISSUE | Kernex VP 9: dashboard e relatórios reais + tirar telas simuladas do p | `viajante-pro,vp-aguardando` |
| #2657 | ISSUE | Kernex VP 10: app do passageiro instalável (PWA + Android TWA como o B | `viajante-pro,vp-aguardando` |
| #2658 | ISSUE | [Parte 1/8 de #2648] Atualizar app para usar /api/viajante-pro | `cortex-fila,tentativa-1,cortex-parte,reserva-tentou` |
| #2664 | ISSUE | [Parte 7/8 de #2648] Excluir testes unitários específicos do viajantep | `cortex-fila,tentativa-1,cortex-parte,reserva-tentou` |
| #3004 | PR | Viajante Pro: rota e pagina de viagens ja implementadas em develop (#2 | `revisor-recusou` |
| #2666 | PR | NEXIA: Implementa no arquivo netlify/functions/viajante-pro.js todas a | `automerge` |
| #2647 | PR | NEXIA: Adicionar funções em clientes/viajantepro.js: getViagens, criar | `automerge` |
| #2634 | PR | NEXIA: A API /api/viajante-pro já tem a ação `trocar-senha` (netlify/f | `automerge` |
| #2613 | PR | NEXIA: Substituir constant DESTINATARIO_COTACAO por 'cotacao.site@viaj | `automerge` |

## 7. Checklist de validação
| Item | Local (servidor real + banco SQLite + SMTP falso) | Hostinger (domínio temporário) |
|---|---|---|
| Páginas abrem nas mesmas rotas, `/` = landing | ✅ teste automático | ✅ 10/11 (honeydew-boar-615951.hostingersite.com) |
| Código da API, `.env`, `package.json` não podem ser baixados | ✅ | ✅ (404/403) |
| Cotação do site grava e manda e-mail (remetente, destino, responder-para, link do painel) | ✅ | ✅ grava no MySQL · ⬜ e-mail (depois da virada, quando as caixas existirem) |
| Login do painel (senha certa/errada), sessão inválida bloqueada | ✅ | ✅ senha errada recusada · ⬜ senha certa (agência) |
| Trocar senha | ✅ | ⬜ |
| Cotações: listar e mudar status | ✅ | ⬜ |
| Viagens: criar, editar, listar, excluir | ✅ | ⬜ |
| App do passageiro pelo link secreto + chat nos dois sentidos | ✅ | ⬜ |
| Upload de foto e foto servida como imagem | ✅ | ⬜ |
| Editar site (CMS) e landing lendo o conteúdo | ✅ | ⬜ |
| Área do passageiro: código por e-mail, entrar, perfil, solicitação | ✅ | ⬜ |
| Formulário antigo `/api/leads` e páginas antigas gravando via `/api/vp-docs` (sem expor leitura) | ✅ | ⬜ |
| `/saude` com banco ok | ✅ | ✅ `{"banco":"ok","driver":"mysql"}` |
| Celular e computador, console sem erros, visual igual lado a lado | — | ✅ landing idêntica à versão atual no celular; sem erros dos nossos arquivos |
| Testes antigos do Viajante (`tests/unit/viajante*`) | ✅ 25/25 | — |

## 8. Pendências (depois)
1. Login de **guia** nas páginas antigas `vp-guide.html`/`vp-passenger.html`: hoje elas mandam para um `/login.html` que **não existe** no repositório (já não funciona na Kernex). Fica igual; fazer login de equipe próprio quando for usar.
2. Fotos e documentos estão em base64 no banco (como era no Firestore). Mover para a pasta `uploads/` se o banco crescer.
3. Ícones (RemixIcon) vêm do CDN público `cdnjs.cloudflare.com` — é só uma biblioteca, não depende da conta Cloudflare. Pode ser copiada para dentro do pacote.
4. Exportar dados do Firestore (#3300): não é necessário agora (sem clientes reais). Se precisar, o formato é o mesmo (caminho do documento + JSON).
5. Recuperar senha do **painel** por e-mail não existe hoje (só "Trocar senha" logado); a área do passageiro já usa código por e-mail.
6. Depois da virada, apagar o banco antigo do WordPress e revisar as issues pausadas (a maioria vira obsoleta: #3299, #3357–#3363, #3393–#3399).
7. Validar `seed.sql`/`schema.sql` num MySQL real (no ambiente de testes só havia SQLite) — feito no passo 2 do hPanel.
