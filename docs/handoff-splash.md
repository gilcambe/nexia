# Handoff: Splash (site + painel da Amanda) — leia tudo antes de mexer

> **Começo rápido para uma nova IA (Claude Code):** (1) leia este arquivo inteiro; (2) conecte ao repositório (seção 1); (3) rode os testes (seção 9) para ver que está tudo verde ANTES de mexer;
> (4) trabalhe sempre num ramo novo `claude/<assunto>` e abra PR para `develop`; (5) peça ao Gildivan o "Merge pull request"; (6) publique (seção 4); (7) peça para ele conferir no celular.
> Nunca faça push direto em `develop`/`main`. Nunca apague dados do Firestore. Nunca mexa em outros clientes (Adriano Blumer etc.) nem em `nexia-ai/` ou `cloudflare/` (exceto o gancho de lembretes já feito) sem pedido explícito.

Dono do projeto: Gildivan (leigo em programação, fala português, repositório `gilcambe/nexia`, marca "KERNEX"). Regras dele:
**não pode quebrar nada**; sempre explicar em passos curtos, com links clicáveis; gastar poucos créditos; trabalhar só no site e painel de PRODUÇÃO (nada de páginas de teste).
Cliente final: **Amanda**, dona da unidade 1 (Splash Santa Adélia). A unidade 2 (Santa Bárbara) é de OUTRO dono: Amanda só recebe comissão.

## 1. Como conectar ao repositório
- Repositório: https://github.com/gilcambe/nexia (branch de integração: `develop`; `main` não é usada para isto).
- Ferramenta: `gh` (GitHub CLI) autenticado na sessão; em sessões Claude Code use só a API REST (`gh api repos/gilcambe/nexia/...`), GraphQL é bloqueado.
  Se o repositório não estiver na sessão: `mcp__claude-code-remote__add_repo` (owner `gilcambe`, repo `nexia`, access `push`) e depois `git clone` conforme a resposta.
- Fluxo: criar ramo `claude/<assunto>` a partir de `origin/develop`, commit, `git push -u origin <ramo>`, abrir PR para `develop` (`gh api repos/gilcambe/nexia/pulls -f title=... -f head=... -f base=develop -f body=...`).
  **O Gildivan faz o "Merge pull request" manualmente** (PRs do Claude não têm automerge). Sempre dê o link do PR e peça para ele esperar os testes (CI) ficarem verdes.
  Cuidado: se um PR for juntado em outro ramo (não `develop`), as mudanças NÃO chegam em produção; confirme `base=develop` (já houve esse erro com o PR #1466).
- Atribuição em commits: terminar mensagem com as linhas de `Co-Authored-By`/`Claude-Session` pedidas pela sessão; em PR, a linha "Generated with Claude Code".
- Cortex (fila de IA grátis, issues com label `cortex-fila`): estava errando quase tudo para o painel; as tarefas #1437–#1455 foram FECHADAS. Não reabra; faça o trabalho direto.

## 2. Onde está cada coisa
| O quê | Arquivo |
|---|---|
| API (Worker Cloudflare `nexia`, rota `/api/locacao`) | `netlify/functions/locacao.js` (toda a lógica) + `cloudflare/app.js` (CORS) |
| Cadastro das contas (senhas iniciais, código de 1º acesso, config padrão) | `clientes/locacoes.js` (conta `splash`, conta `splash-teste` sem uso) |
| Site público dos clientes | `sites/splash/index.html` (um arquivo; JS inline; `SLUG='splash'`) + `sites/splash/calendario.js` |
| Painel da Amanda (PWA) | `sites/splash/agenda/index.html`, `painel.js` (funções puras, também testadas em Node), `gestao.js` (Financeiro e Clientes), `sw.js`, `manifest.webmanifest` |
| Testes | `tests/unit/locacao*.test.js`, `splash-*.test.js` (os `splash-navegador` usam Chromium local e são pulados se não houver) |
Backend guarda tudo no Firestore: `locacao_contas/<slug>` (+ subcoleções `reservas`, `dias` (trava por dia/unidade), `sessoes`, `site`, `fotos`, `videos`, `despesas`).
Fotos ficam em base64 no Firestore (máx. 600 KB cada). Comprovantes do cliente ficam em `fotos` com `unidade:'comprovantes'` (nunca listados publicamente).

## 3. URLs de produção
- Site: https://splasheventos.pages.dev/  · Painel: https://splasheventos.pages.dev/agenda/
- API: https://nexia.gcbezerra.workers.dev/api/locacao?site=splash
- (Existe uma cópia `splashteste.pages.dev` publicada antes; ignorar. Adriano Blumer: https://adrianoblumer.pages.dev/ e /painel/ — outro cliente, não mexer.)

## 4. Como PUBLICAR (só depois do merge em `develop`)
1. **API (Worker):** sobe sozinha pelo workflow "Deploy Cloudflare" depois do CI em `develop` (15–20 min). Acompanhe: `gh api 'repos/gilcambe/nexia/actions/workflows/deploy-cloudflare.yml/runs?per_page=2'`.
2. **Site + painel (páginas estáticas):** NÃO sobem sozinhos. Disparar:
   `gh api repos/gilcambe/nexia/actions/workflows/379320658/dispatches -f ref=develop -f 'inputs[slug]=splasheventos' -f 'inputs[pasta]=sites/splash'`
   (workflow "Publicar site de cliente (Cloudflare Pages)"). Conferir: `gh api 'repos/gilcambe/nexia/actions/workflows/379320658/runs?per_page=1'` → `completed success`.
   O app instalado usa `sw.js`; ao mudar arquivos do painel, aumente `CACHE_VERSION` em `sites/splash/agenda/sw.js` (atual: `splash-painel-v10`). NÃO use `clients.claim()` no sw: quebra os testes de navegador (o sw passaria a interceptar `/api/`).
   `sites/splash/_headers` força `no-cache` no painel para o celular não ficar com versão velha.
3. A sessão da IA pode não alcançar `*.pages.dev`/workers.dev por curl/WebFetch (lista de domínios permitidos); peça ao Gildivan para abrir e conferir, e diga isso a ele.

## 5. Acesso (senhas)
- Painel só pede SENHA (sem usuário). Senhas iniciais (só hash em `clientes/locacoes.js`): **ADMIN01** (dono do sistema) e **AMANDA01** (Amanda). Maiúsculas/minúsculas não importam.
  Valem até alguém trocar a senha em "Conta" no painel (`trocar-senha` grava `senha_personalizada:true` e desliga as iniciais). Depois disso só vale a senha nova.
  Para "resetar": subir `versao` em `clientes/locacoes.js` e gerar novo código com `node scripts/locacao-codigo.js`, ou remover `senha_personalizada` no Firestore.
- Antes o Gildivan já criou uma senha pelo código de 1º acesso (`75P84-YNJXJ`, uso único). Ela segue valendo junto com as iniciais até a troca.
- Aconselhe sempre trocar a senha ao entregar para a Amanda (painel tem dados e pagamentos de clientes).
- O login fica guardado no aparelho por 30 dias (`localStorage.splash_token`); a sessão vale 30 dias no servidor (`SESSAO_DIAS`).

## 6. O que foi entregue (todos os PRs para `develop`)
Site novo e alegre (#1436), painel PWA com Financeiro/Despesas/Clientes (#1465/#1467), cancelamento + contrato + comprovante + música + aviso de pedido novo (#1468),
e o PR "melhorias de 23/10" (este handoff vai nele): 
- Site: unidade escolhida com destaque forte e calendário só aparece ao tocar (rola até ele); preço por dia no calendário (semana x fim de semana x promoção 🔥); extras com preço promocional (riscado);
  Pix visível já no formulário; aviso de cancelamento; endereço com links Google Maps/Waze; "Consultar minha reserva" (protocolo + WhatsApp → ação pública `consultar`);
  música inicia no primeiro toque (YouTube oculto ou MP3 ou gerada), botão só com ícone para desligar, preferência em `localStorage.splash_som`; timeout do conteúdo editado subiu para 9 s.
- Painel: logo; menu enxuto (Calendário, Pedidos, Reservas, Novo, Financeiro, Clientes, Ajustes; Editar site e Importar ficam dentro de Ajustes); calendário colorido por situação (alugado, falta sinal, realizado, bloqueado, cancelado) com legenda;
  Pedidos com "Ver pedido" (todos os dados + Aceitar e enviar Pix / Falar com o cliente / Recusar); Reservas com busca e filtros e selo de pagamento (Pago total / parcial / Ainda não pago);
  Novo: mostra dias ocupados, valor combinado, quanto já pagou; Financeiro: escolhe unidade ou total, despesas na mesma tela, comissão da unidade de outro dono (devida/recebida/a receber);
  Clientes filtrado por unidade; Ajustes: preço semana/fim de semana por unidade, "sexta conta como fim de semana", dias com preço especial, extras com promoção, comissão, música por link do YouTube/MP3;
  listas de escolha com texto legível; importador corrigido (faltava o elemento `imp-mapeamento-manual` e quebrava) e modelo de planilha com valor total, sinal, pago, convidados e situação.

## 7. Regras de negócio que NÃO podem quebrar
- Um dia por unidade: trava em `dias` (`<unidade>_<AAAA-MM-DD>`); `pedir`/`criar`/`importar` usam `batch.create` e devolvem 409 se ocupado. Cancelar/recusar/expirar libera o dia.
- Status: pedido → aguardando_sinal → confirmado → concluido; recusado/cancelado/expirado são finais. Confirmar registra o sinal como pagamento (sem duplicar).
- Preço do dia: `valorDaDiaria` (promoção em `datas_especiais` > fim de semana (sáb/dom, + sexta se marcado) > semana > valor antigo `valor_diaria`). `pedir` calcula o total no servidor (nunca confie no navegador).
- Config pública (`configPublica`) NUNCA pode vazar: comissão, flag `terceiro`, contrato, senhas. Pix só sai se a dona deixou "mostrar" ligado.
- Comissão: unidade com `terceiro:true` + `comissao {tipo percentual|valor, valor}`; comissão recebida é lançamento em `despesas` com `tipo:'comissao'` (não conta como despesa).
- Rate limit em memória por IP (pedir 6/min, entrar 8/10min, comprovante/consultar 5/10min).
- Escape de HTML em tudo que vem do cliente (`SplashPainel.escapeHtml` no painel, `esc` no site).
- Itens de CFN/ética do Adriano (outro cliente) não se aplicam aqui.

## 7b. Entregas depois do #1470 (todas já em `develop` e publicadas)
- **#1471** painel PWA instalável: `sw.js` v3+, `skipWaiting`, `_headers` no-cache, botão "Instalar app" (`beforeinstallprompt`).
- **#1472** apagar reserva recusada/cancelada/vencida (ação `excluir`, trava do dia é liberada); **avisos push no celular** (Web Push com `netlify/functions/body-coach/push.js`; ações `push-chave`, `push-assinar`, `push-testar`; subcoleção `locacao_contas/<slug>/push`; `avisarPainel()` dispara em pedido novo);
  rádio Splash (playlist do YouTube em `musica.url`, módulo `Musica` no site); menu inferior com 7 abas sem rolagem; gráficos (`renderizarGraficos` na aba Calendário); calendário do site sem cache (`no-store`).
- **#1473** Ajustes reorganizado: tela inicial com cartões (cada unidade + Geral + Ferramentas), `ajustesIr(pag, un)` / `ajustesSub(sub)`; por unidade: Valores, Fotos, Vídeos, Decoração (extras), Promoções;
  `extras[]` e `promocoes[]` ganharam `unidade` ('todas' ou id) e o site filtra pela unidade escolhida (`daUnidade`, `renderExtras`);
  gerenciador de mídia `montarMidia` (legenda, ordem ◀▶, Ocultar = campo `oculta`, Excluir; vídeos com título e Excluir; ações `foto-editar`, `video-editar`, `foto-remover`, `video-remover`);
  o "Editar site" (iframe) recarrega sozinho via `postMessage {nx:'recarregar'}`; avaliações de clientes: ação pública `avaliar` (fica `aprovada:false` em `avaliacoes_clientes`), admin `avaliacoes-clientes` e `avaliacao-moderar`, aprovadas saem em `avaliacoes` da config pública; formulário "Conte como foi" no site (honeypot `empresa`).
- **#1474** Divulgar datas livres (imagem 1080x1920 por canvas, `gerarDivulgacao`); Lembretes ao cliente (`netlify/functions/locacao-lib/lembretes.js`: tipos `antes` (1 ou 2 dias), `saldo`, `avaliacao`; ações `lembretes` e `lembrete-marcar`; cron do Worker às 9h BRT em `cloudflare/lembretes.js` → `rodarSplash`); Patrocinadores (`config.patrocinadores`, seção "Parceiros do Splash" no site, `valor_acordado`/`obs` só no painel).
- **#1475** pedido de avaliação depois da festa; vantagens dos parceiros na mensagem de confirmação (`montarMensagemConfirmacao`).
- **#1476** fotos/vídeos que já vêm FIXOS no HTML do site (chaves `data-ed` em `#fotos-<unidade>` e `#videos-<unidade>`) aparecem no painel com "Tirar do site/Voltar ao site" (grava `conteudo.ocultos[chave]` via `site-salvar`; o site esconde também o cartão `.foto`/`.vid-card`).
Atenção: módulos novos do backend devem ficar em SUBPASTAS de `netlify/functions/` (ex.: `locacao-lib/`), senão o teste CF5 falha (ele exige que cada `.js` da raiz seja um handler do Worker).

## 8. Pendências / ideias
- Mensagem automática no Direct do Instagram quando alguém comenta uma palavra: ABORTADO por enquanto (exige app Meta + permissões + possível revisão; ferramentas como ManyChat têm plano grátis mas os limites mudaram em 2026). Só retomar se o Gildivan pedir.
- QR code do site: não feito (sem biblioteca disponível offline). A Amanda pode gerar um no Chrome (Salvar e compartilhar > Criar código QR).
- WhatsApp automático para lembretes é pago (API oficial); por isso o painel lista e a Amanda envia com 1 toque.
- Upload de vídeo grande: precisa Cloudflare R2; hoje só link YouTube/Vimeo/Instagram.
- WhatsApp do site (11 94124-7074) veio do Instagram; a Amanda deve confirmar. `clientes/splash/site.json` tem capacidades inventadas (500/350) que NÃO são usadas.
- Fotos fixas do site não podem ser apagadas de vez (são arquivos do site); só "Tirar do site".
- Nada disso foi conferido em celular real pela IA (a sessão não alcança `*.pages.dev`): sempre peça ao Gildivan para testar e contar o que viu (aviso push com app fechado, rádio, instalação do app, importação grande).
- Se o editor "Salvar mudanças" não aparecer no site: conferir `?conteudo=1` na API e o timeout de 9 s no site (`iniciarConteudo`).

## 9. Checklist antes de qualquer PR
1. `timeout 170 node --test tests/unit/splash-*.test.js tests/unit/locacao*.test.js tests/unit/cloudflare-host.test.js` (precisa passar tudo, hoje ~90 testes; NÃO rode `tests/unit/*.test.js` inteiro: passa de 2 min; testes de navegador usam Chromium em `/opt/pw-browsers`).
2. Não remover funções existentes; mudar só o necessário; manter ids usados pelos testes (`cal-dias-grid`, `req-nome`, `btn-enviar-pedido`, `pix-chave`, `btn-wa-me`, etc.).
3. PR sempre para `develop`; avisar o Gildivan do link e do passo "Merge pull request"; depois publicar (seção 4) e pedir para ele conferir.

## 10. Texto pronto para colar numa nova sessão do Claude Code
> Você vai continuar um projeto já em produção: site e painel de locação "Splash" (cliente Amanda) no repositório `gilcambe/nexia`. Antes de qualquer coisa, leia `docs/handoff-splash.md` inteiro. O dono (Gildivan) é leigo e fala português: responda em português, em passos curtos, com links clicáveis.
> Regras: NÃO PODE QUEBRAR NADA; trabalhe só no site e painel de PRODUÇÃO (sem páginas de teste); gaste poucos créditos; um ramo `claude/<assunto>` por mudança, PR para `develop`, e peça ao Gildivan o "Merge pull request". Depois do merge, publique o site/painel pelo workflow da seção 4 e peça para ele testar no celular.
> Passos: (1) se o repositório não estiver na sessão, use `add_repo` com owner `gilcambe`, repo `nexia`, access `push`, e clone; (2) `git fetch && git checkout -B claude/<assunto> origin/develop`; (3) rode os testes da seção 9 e confirme que passam; (4) faça a mudança pedida; (5) rode os testes de novo; (6) commit, push e abra o PR via `gh api` (GraphQL é bloqueado).

## 11. Splash como produto da Kernex (vender para outras empresas)
- Vinheta Kernex de 2 s (mesma do Body Coach/Cortex) em `sites/splash/abertura-kernex.js`, carregada no site e no painel com `data-produto="SPLASH"`.
  Uma vez por sessão, um toque pula, não aparece dentro do "Editar site" (iframe) nem em navegador automatizado (testes). Ícone continua o do Splash.
- O site lê a conta de `<meta name="locacao-site">` e o painel de `<meta name="agenda-site">` (padrão `splash`). O backend já é multi-cliente (`clientes/locacoes.js`, `?site=<slug>`).
- Novo cliente: `node scripts/novo-cliente-locacao.js --slug chacara-sol --nome "Chácara do Sol" [--instagram x] [--unidades 1|2]`
  → cria `sites/<slug>` sem fotos nem nome do Splash e mostra o código de 1º acesso + bloco para colar em `clientes/locacoes.js`.
  Depois: trocar logo/ícones pelo do cliente, PR, merge e publicar (seção 4 com `inputs[slug]=<slug>` e `inputs[pasta]=sites/<slug>`). Com 1 unidade, o site esconde a segunda.
- Teste: `tests/unit/splash-kernex.test.js` (já entra no comando da seção 9).

### Fotos das áreas (2026-10-24)
- Painel: Ajustes > **Fotos das áreas** (Piscina, Churrasqueira, Sala de jogos, Decoração). Usa o mesmo `montarMidia` com unidade `area-<id>` (sem mudança no backend).
- Site: o card N de "O que tem no Splash" (`#estrutura-grid`, `data-i`) mapeia para `AREAS[N]`; com mídia, mostra "Ver fotos e vídeos" e abre a `#galeria`. No "Editar site" (NX.editar) o toque não abre a galeria.
- Vinheta: no site público `data-sempre` (toda abertura); no painel, 1 vez por sessão.
