'use strict';
// Fila fixa do Cortex: as tarefas são Issues do GitHub com o rótulo "cortex-fila" (grátis, sem Firestore).
// REGRA DO DONO: o Cortex nunca espera horário para a fila voltar. O workflow roda a cada 15 min E logo que cada execução termina.
// O workflow "Fila do Cortex" roda este script: conclui o que terminou, reenfileira o que
// falhou (na hora, sem esperar horário), alerta quando uma tarefa trava e despacha as próximas em até 3 pistas.
const REPO = process.env.REPO || 'gilcambe/nexia';
const BASE_URL = process.env.NEXIA_URL || 'https://nexia.gcbezerra.workers.dev';
// Repositório público: minutos do GitHub Actions são grátis e sem limite; 6 pistas dobram a vazão (CORTEX_PISTAS muda).
const PISTAS = Math.max(1, Math.min(10, Number(process.env.CORTEX_PISTAS) || 6));
const MAX_TENTATIVAS = 12;
const TENTATIVAS_ATE_DIVIDIR = 3;
// Rodada "verde" que não entrega o arquivo pedido (ex.: o Cortex não pode criar `.github/workflows/*`) abria um rascunho
// novo a cada ciclo, para sempre (18 rascunhos do gitleaks em 19/10). Depois de MAX_SEM_ENTREGA rodadas assim, trava.
const MAX_SEM_ENTREGA = 2;
// Rótulo sem-entrega-N: N = quantas rodadas terminaram sem entrega. Devolve o próximo passo depois de mais uma.
function depoisSemEntrega(labels) {
  const arr = Array.isArray(labels) ? labels : [];
  const nums = arr.map(l => {
    const m = /^sem-entrega-(\d+)$/.exec(String(l || ''));
    return m ? Number(m[1]) : 0;
  });
  const n = Math.max(0, ...nums) + 1;
  return { n, travar: n >= MAX_SEM_ENTREGA };
}
const CONFIAVEIS = ['OWNER', 'MEMBER', 'COLLABORATOR'];
const L = { jules: 'cortex-jules', fila: 'cortex-fila', rodando: 'cortex-rodando', feito: 'cortex-feito', travado: 'cortex-travado', dividido: 'cortex-dividido', parte: 'cortex-parte', semDivisao: 'cortex-sem-divisao', prioridade: 'cortex-prioridade', semCota: 'cortex-reserva-sem-cota' };
const MAX_CORPO = 2500;      // tarefa maior que isso é dividida em partes pequenas
const MAX_ARQUIVOS = 4;      // ou que mexe em mais arquivos do que isso

const nomes = i => (i.labels || []).map(l => (typeof l === 'string' ? l : l.name));
const numeroDe = (labels, prefixo) => {
  const m = labels.map(n => new RegExp(`^${prefixo}-(\\d+)$`).exec(n)).find(Boolean);
  return m ? Number(m[1]) : 0;
};
// Tarefa grande demais para uma rodada só: texto longo ou muitos arquivos citados. Partes e tarefas já tentadas não se dividem de novo.
const plano = require('./cortex-plano');
// tamanhos = { caminho: bytes } dos arquivos citados (opcional): arquivo enorme também conta para o planejador.
function precisaDividir(i, tamanhos = {}) {
  const ls = nomes(i);
  if (ls.includes(L.parte) || ls.includes(L.dividido) || ls.includes(L.semDivisao)) return false;
  const corpo = String(i.body || '');
  // Cópia exata ("Copie EXATAMENTE") é gravada direto, sem IA: dividir apagaria o código do pedido.
  if (require('./cortex-literal-direto').arquivosDiretos(i).length) return false;
  const arquivos = new Set(corpo.match(/[\w./-]+\.(?:js|ts|tsx|jsx|css|html|json|md|yml)\b/g) || []);
  return corpo.length > MAX_CORPO || arquivos.size > MAX_ARQUIVOS || plano.classificar({ corpo, tamanhos }).tamanho === 'grande';
}
// Pais (rótulo "dividido") cujas partes já foram todas feitas: viram concluídos.
function paisConcluidos({ pais, partes }) {
  const porPai = new Map();
  for (const p of partes) {
    const m = /de #(\d+)\]/.exec(p.title || '');
    if (!m) continue;
    const k = Number(m[1]);
    (porPai.get(k) || porPai.set(k, []).get(k)).push(p);
  }
  return pais.filter(x => { const ps = porPai.get(x.number) || []; return ps.length > 0 && ps.every(p => p.state === 'closed' && nomes(p).includes(L.feito)); }).map(x => x.number);
}
// Caminhos de arquivo entre crases no pedido (ex.: `src/a/b.ts`). Servem para conferir se a entrega mexeu no que foi pedido.
function caminhosDoPedido(corpo) {
  const achados = String(corpo || '').match(/`[\w./-]*\/[\w.-]+\.(?:js|ts|tsx|jsx|css|html|json|md|yml|svg|webmanifest)`/g) || [];
  return [...new Set(achados.map(c => c.slice(1, -1)).filter(c => !c.startsWith('/') && !c.includes('..')))];
}
// Rede de segurança do "feito": o pedido cita arquivos, mas nenhum deles existe na develop nem em PR aberto = a rodada não entregou nada.
const palavras = t => new Set(String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]{5,}/g) || []);
// Pedido sem arquivo citado: só vale como entregue se a rodada abriu um PR nexia/* parecido com o título (2+ palavras em comum).
async function entregouPr(token, titulo, runId) {
  try {
    const run = (await gh(token, 'GET', `/actions/runs/${runId}`)).json || {};
    const desde = new Date(run.created_at || 0).getTime();
    const alvo = palavras(titulo);
    const prs = (await gh(token, 'GET', '/pulls?state=all&sort=created&direction=desc&per_page=40')).json || [];
    for (const pr of prs) {
      if (!(/^nexia\//.test((pr.head || {}).ref || '') && new Date(pr.created_at).getTime() >= desde
        && [...palavras(pr.title)].filter(w => alvo.has(w)).length >= 2)) continue;
      // PR só com o pipeline modelo (nexia-pipeline.yml) não é a entrega do pedido: o Cortex errou de plano.
      const fs = (await gh(token, 'GET', `/pulls/${pr.number}/files?per_page=100`)).json || [];
      if (!soPipelineModelo(fs.map(f => f.filename))) return true;
    }
    return false;
  } catch { return true; }
}
// Função pura: a lista de arquivos do PR é só o pipeline modelo gerado pelo NEXIA?
const ARQ_PIPELINE_MODELO = '.github/workflows/nexia-pipeline.yml';
function soPipelineModelo(arquivos) { return Array.isArray(arquivos) && arquivos.length > 0 && arquivos.every(a => a === ARQ_PIPELINE_MODELO); }
// #852: arquivo que já existia na develop só conta se teve commit na develop depois do início da tarefa (`desde`).
async function entregouAlgo(token, corpo, titulo, runId, desde) {
  const caminhos = caminhosDoPedido(corpo);
  if (!caminhos.length) return titulo && runId ? entregouPr(token, titulo, runId) : true;
  try {
    for (const c of caminhos.slice(0, 6)) {
      if ((await gh(token, 'GET', `/contents/${c}?ref=develop`)).status !== 200) continue;
      if (!desde) return true;
      const cs = (await gh(token, 'GET', `/commits?sha=develop&path=${encodeURIComponent(c)}&since=${encodeURIComponent(desde)}&per_page=1`)).json;
      if (Array.isArray(cs) && cs.length > 0) return true;
    }
    const prs = (await gh(token, 'GET', '/pulls?state=open&per_page=30')).json || [];
    for (const pr of prs.filter(x => /^nexia\//.test((x.head || {}).ref || ''))) {
      const fs = (await gh(token, 'GET', `/pulls/${pr.number}/files?per_page=100`)).json || [];
      if (fs.some(f => caminhos.includes(f.filename))) return true;
    }
    return false;
  } catch { return true; }
}
const minutos = (agora, iso) => (agora - new Date(iso).getTime()) / 60000;
// #2322: o mesmo passo falhando em várias tarefas diferentes é erro de AMBIENTE (ex.: limpeza do smoke, PR #2297),
// não da tarefa. Assinatura = checagens "FALHOU" do resumo do smoke, menos as que medem a própria tarefa.
const MIN_AMBIENTE = 3;
const DA_TAREFA = /^(Execução|Onboarding)/;
function assinaturaDoSmoke(resumo) {
  const falhas = [...String(resumo || '').matchAll(/^FALHOU\s+(.+?)(?:\s+—.*)?$/gm)].map(m => m[1].trim());
  if (!falhas.length || falhas.some(f => DA_TAREFA.test(f))) return null;
  return [...new Set(falhas)].sort().join(' | ');
}
// runs com .assinatura (preenchida no main): marca .ambiente nas que repetem em >= MIN_AMBIENTE tarefas na última hora.
function errosDeAmbiente(runs, agora = Date.now()) {
  const porAssinatura = new Map();
  for (const r of runs) {
    if (!r.assinatura || minutos(agora, r.updated_at || r.created_at) > 60) continue;
    const n = (/^Cortex #(\d+)/.exec(r.name || '') || [])[1];
    if (!n) continue;
    if (!porAssinatura.has(r.assinatura)) porAssinatura.set(r.assinatura, { tarefas: new Set(), runs: [] });
    const g = porAssinatura.get(r.assinatura); g.tarefas.add(n); g.runs.push(r);
  }
  const alertas = [];
  for (const [assinatura, g] of porAssinatura) {
    if (g.tarefas.size < MIN_AMBIENTE) continue;
    for (const r of g.runs) r.ambiente = assinatura;
    alertas.push({ assinatura, tarefas: [...g.tarefas].map(Number), runs: g.runs.map(r => r.id) });
  }
  return alertas;
}
// #2323: o app do Cortex/Reserva não grava .github/workflows/ (falta a permissão "workflows"): vai direto ao Jules.
// Só conta linha que cita um arquivo de workflow sem negar ("não edite .github/workflows/").
const mexeEmWorkflow = i => `${i.title || ''}\n${i.body || ''}`.split('\n').some(l => /\.github\/workflows\/[\w.-]+\.ya?ml/.test(l) && !/\bn[ãa]o\b/i.test(l));
// As partes de uma tarefa dividida são criadas pela própria fila (conta github-actions[bot], que o GitHub marca
// como CONTRIBUTOR). Elas contam como confiáveis: só quem tem acesso ao repositório consegue pôr rótulos.
const ROBO = 'github-actions[bot]';
const confiavel = i => CONFIAVEIS.includes(i.author_association) || ((i.user || {}).login === ROBO && nomes(i).includes(L.parte));
// "[Parte 2/3 de #359] ..." -> { pai: 359, k: 2 }
const parteDe = i => { const m = /^\[Parte (\d+)\/\d+ de #(\d+)\]/.exec(i.title || ''); return m ? { k: Number(m[1]), pai: Number(m[2]) } : null; };

// #803: dia em Brasília (UTC-3). Tarefa que ficou sem cota da reserva volta à fila no dia seguinte, sem espera fixa.
const diaBr = t => new Date(new Date(t).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
function reservaVolta(rotuladoEm, agora = Date.now()) { return !rotuladoEm || diaBr(rotuladoEm) < diaBr(agora); }
// Data em que a issue recebeu o rótulo pela última vez. A API devolve os eventos do mais antigo ao mais novo, 100 por página,
// e cada tentativa do Cortex põe e tira 3 ou 4 rótulos: tarefa com 12 tentativas passa de 100 eventos e o evento de travar cai
// fora da página 1 (#2141: evento 116 de 116; #2159: 309 de 309). Por isso lê todas as páginas (máx. 10 = 1000 eventos).
// Falha de rede ou resposta estranha lança erro: quem chama tenta no próximo ciclo, nunca decide sem a data.
async function ultimoRotuloEm(token, numero, nome, ghFn = gh) {
  let quando = null;
  for (let pag = 1; pag <= 10; pag++) {
    const ev = (await ghFn(token, 'GET', `/issues/${numero}/events?per_page=100&page=${pag}`)).json;
    if (!Array.isArray(ev)) throw new Error('resposta inesperada ao ler os eventos');
    for (const e of ev) if (e.event === 'labeled' && e.label && e.label.name === nome) quando = e.created_at;
    if (ev.length < 100) return quando;
  }
  throw new Error('mais de 1000 eventos: não dá para saber a data do último rótulo');
}
const MAX_VERIFICAR = 60;            // issues com rótulo de espera conferidas por ciclo (cada uma custa de 1 a 4 chamadas)
async function reservasQueVoltam(token, issues, agora = Date.now(), ghFn = gh) {
  const voltar = [];
  for (const i of issues.filter(x => !x.pull_request && nomes(x).includes(L.semCota)).slice(0, MAX_VERIFICAR)) {
    try {
      const quando = await ultimoRotuloEm(token, i.number, L.semCota, ghFn);
      if (reservaVolta(quando, agora)) voltar.push({ tipo: 'reserva-volta', numero: i.number, rotulos: nomes(i) });
    } catch (e) { console.log(`reserva sem cota #${i.number}: ${e.message}`); }
  }
  return voltar;
}

// Tarefas que travaram enquanto o Cofre estava fora do ar (503 do D1) não falharam por culpa da tarefa:
// voltam à fila do zero uma vez. Conserto: PR #2221 (27/10/2026 19:37 UTC).
// 28/10: a limpeza do smoke (PR #2297) reprovou toda tarefa até o PR #2301 entrar. Quem travou antes disso volta do zero.
const CONSERTO_SMOKE = '2026-10-29T23:59:59Z';
function travouAntesDoConserto(travadoEm) { return !!travadoEm && Date.parse(travadoEm) < Date.parse(CONSERTO_SMOKE); }
// Tarefas que já estão em outro degrau da escada (docs/ESCADA-IA.md) não voltam por aqui: o Jules, o Claude ou o dono
// cuidam delas, e devolvê-las ao Cortex abriria uma 2ª frente na mesma tarefa.
const FORA_DA_RECUPERACAO = ['jules-enviado', 'vez-do-claude', 'so-humano', 'cortex-alerta', 'cortex-dividido'];
const MAX_RECUPERAR_POR_CICLO = 6;   // igual ao nº de pistas: devolve só o que cabe a rodar, o resto vem no ciclo seguinte
// PR já integrado que declara fechar a tarefa ("Fecha: #2144", "Closes #7") = a entrega pode existir. A tarefa NÃO volta para
// a fila (não repete trabalho feito) e NÃO é fechada sozinha: quem confere o código é uma pessoa. Só citar o número não basta
// (um PR de conserto da própria fila cita as tarefas que recupera). "Fecha" em português não fecha a issue sozinho no GitHub.
const PALAVRA_FECHA = '(?:fecha|fechar|fechou|fechados?|closes?|closed|fix(?:es|ed)?|resolves?|resolved)';
function entregaComprovada(numero, prsMesclados) {
  // A palavra de fechamento vem COLADA na lista de números ("Fecha: #2138, #2139 e #2141"). Frase corrida que só menciona a
  // palavra e depois cita números ('"Fecha" em português não fecha..., #2477 (#1976)') não conta: o próprio PR de conserto caiu nisso.
  const re = new RegExp(`\\b${PALAVRA_FECHA}\\b:?\\s*(?:#\\d+(?:\\s*,\\s*|\\s+e\\s+|\\s+and\\s+|\\s*&\\s*)?)*#${numero}(?!\\d)`, 'i');
  return (prsMesclados || []).find(pr => pr && pr.merged_at && re.test(`${pr.title || ''}\n${pr.body || ''}`)) || null;
}
async function travadasPeloCofre(token, issues, { ghFn = gh } = {}) {
  const voltar = [];
  // Todas as travadas elegíveis, das mais antigas para as mais novas (antes só as 15 primeiras da lista, que vem da mais
  // nova para a mais antiga: as antigas nunca entravam na janela).
  const candidatas = issues.filter(x => !x.pull_request && nomes(x).includes(L.travado) && !nomes(x).some(l => FORA_DA_RECUPERACAO.includes(l)))
    .sort((a, b) => a.number - b.number).slice(0, MAX_VERIFICAR);
  let mesclados = null;
  for (const i of candidatas) {
    if (voltar.length >= MAX_RECUPERAR_POR_CICLO) break;
    try {
      const quando = await ultimoRotuloEm(token, i.number, L.travado, ghFn);
      if (!travouAntesDoConserto(quando)) continue;   // travou depois do conserto: a causa é da tarefa, não do ambiente
      if (mesclados === null) { const r = (await ghFn(token, 'GET', '/pulls?state=closed&sort=updated&direction=desc&per_page=100')).json; mesclados = Array.isArray(r) ? r : []; }
      const pr = entregaComprovada(i.number, mesclados);
      if (pr) { console.log(`travada #${i.number}: o PR #${pr.number} já integrado diz fechar a tarefa; não volta para a fila (precisa de conferência da entrega)`); continue; }
      voltar.push({ tipo: 'reserva-volta', numero: i.number, rotulos: nomes(i), motivo: 'cofre' });
    } catch (e) { console.log(`travada #${i.number}: ${e.message}`); }
  }
  return voltar;
}

// Chama o Cortex Reserva (IAs da Central) já na 1ª falha da rodada, uma vez por tarefa (rótulo reserva-tentou).
// Falha por cota do banco ou rodada parada não conta: não é falha da tarefa. RESERVA_NA_FALHA=0 desliga.
function devePedirReserva(acao, ls, env = process.env) {
  if (env.RESERVA_NA_FALHA === '0') return false;
  if (!['reenfileirar', 'travar'].includes(acao.tipo)) return false;
  if (acao.tipo === 'reenfileirar' && !['failure', 'timed_out'].includes(acao.conclusao)) return false;
  return !(ls || []).includes('reserva-tentou');
}
async function chamarReserva(token, n) {
  const d = await gh(token, 'POST', '/actions/workflows/cortex-reserva.yml/dispatches', { ref: 'develop', inputs: { numero: String(n) } });
  if (d.status !== 204) return false;
  await gh(token, 'POST', `/issues/${n}/labels`, { labels: ['reserva-tentou'] });
  await gh(token, 'POST', `/issues/${n}/comments`, { body: '🔌 O Cortex falhou. Chamei agora as IAs conectadas na Central (Cortex Reserva), sem esperar o Jules.\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_' });
  return true;
}

// Função pura: recebe issues e execuções e devolve a lista de ações. Fácil de testar.
// prs = PRs nexia/* abertos ({ arquivos, criadoEm }) e tamanhos = { caminho: bytes }: usados pelo planejador (opcionais).
function decidir({ issues, runs, agora = Date.now(), pistas = PISTAS, prs = [], tamanhos = {} }) {
  const acoes = [];
  const tamanhosDe = corpo => Object.fromEntries(plano.arquivosCitados(corpo).filter(a => tamanhos[a]).map(a => [a, tamanhos[a]]));
  const ultimaRun = n => runs.filter(r => r.name === `Cortex #${n}`).sort((a, b) => b.id - a.id)[0] || null;
  const validas = issues.filter(i => !i.pull_request && confiavel(i) && nomes(i).includes(L.fila));
  const pistasEmUso = new Set();
  let ativas = 0;

  for (const i of validas) {
    const ls = nomes(i);
    // #1016: tarefa ainda aberta com cortex-feito (ex.: #800) fecha como concluída, sem pista nem "rodando".
    if (ls.includes(L.feito) && i.state !== 'closed') { acoes.push({ tipo: 'fechar-feito', numero: i.number }); continue; }
    if (ls.includes(L.travado)) continue;
    if (!ls.includes(L.rodando)) continue;
    const run = ultimaRun(i.number);
    const pista = numeroDe(ls, 'pista');
    if (run && run.status === 'completed') {
      if (run.conclusion === 'success') { acoes.push({ tipo: 'concluir', numero: i.number, run: run.id, corpo: String(i.body || ''), titulo: String(i.title || ''), desde: i.created_at || null }); continue; }
      if (run.cota) { acoes.push({ tipo: 'reenfileirar', numero: i.number, tentativa: numeroDe(ls, 'tentativa'), run: run.id, conclusao: 'cota do banco' }); continue; }
      if (run.ambiente) { acoes.push({ tipo: 'reenfileirar', numero: i.number, tentativa: numeroDe(ls, 'tentativa'), run: run.id, conclusao: 'erro de ambiente' }); continue; }
      const t = numeroDe(ls, 'tentativa') + 1;
      // Falhou 3 vezes inteira: o modelo grátis não dá conta do tamanho. Divide em partes pequenas em vez de repetir até travar.
      if (t === TENTATIVAS_ATE_DIVIDIR && !parteDe(i) && !ls.includes(L.parte) && !ls.includes(L.dividido) && !ls.includes(L.semDivisao)) {
        acoes.push({ tipo: 'dividir', numero: i.number, titulo: i.title || '', tarefa: String(i.body || '').trim(), limpar: true, tentativa: t, tamanhos: tamanhosDe(i.body) }); continue;
      }
      // Parte com plano que "falhou" pode já ter entregado (ex.: 2ª rodada termina em EMPTY_DIFF porque o arquivo da 1ª
      // já entrou na develop). A fila confere os arquivos do plano antes de gastar outra tentativa (teste real de #1538).
      const conferir = plano.lerPlano(i.body) ? { parte: true, corpo: String(i.body || ''), desde: i.created_at || null } : {};
      acoes.push(t >= MAX_TENTATIVAS
        ? { tipo: 'travar', numero: i.number, tentativas: t, run: run.id, titulo: String(i.title || ''), ...conferir }
        : { tipo: 'reenfileirar', numero: i.number, tentativa: t, run: run.id, conclusao: run.conclusion, titulo: String(i.title || ''), ...conferir });
      continue;
    }
    // #1016: execução que não termina há mais de 2 h (presa na fila do Actions) libera a pista e devolve a tarefa.
    if (run && run.status !== 'completed' && minutos(agora, run.created_at || run.updated_at) > 120) { acoes.push({ tipo: 'reenfileirar', numero: i.number, tentativa: numeroDe(ls, 'tentativa'), run: run.id, conclusao: 'execução parada há 2 h' }); continue; }
    if (!run && minutos(agora, i.updated_at) > 20) { acoes.push({ tipo: 'reenfileirar', numero: i.number, tentativa: numeroDe(ls, 'tentativa'), run: null, conclusao: 'sem execução' }); continue; }
    ativas++;
    if (pista) pistasEmUso.add(pista);
  }

  const fila = validas
    .filter(i => { const ls = nomes(i); return !ls.includes(L.rodando) && !ls.includes(L.feito) && !ls.includes(L.travado) && !ls.includes(L.dividido) && !ls.includes(L.semCota); })   // #803: sem cota hoje espera o dia virar
    // Rótulo cortex-prioridade passa na frente (ex.: correções que impedem o próprio Cortex de parar); depois, por número.
    .sort((a, b) => (nomes(b).includes(L.prioridade) - nomes(a).includes(L.prioridade)) || a.number - b.number);
  // Partes da mesma tarefa rodam em ordem: a parte 2 só sai quando a 1 terminou (uma costuma usar o arquivo da outra).
  // Parte com plano (cortex-plano) espera só as partes de que depende: as independentes rodam juntas, em pistas diferentes.
  const esperaAnterior = i => {
    const pronta = plano.dependenciasProntas(i, validas, prs, agora, nomes);
    if (pronta !== null) return !pronta;
    const p = parteDe(i);
    // Parte anterior travada não segura as seguintes para sempre (regra do dono: a fila nunca para).
    return !!p && validas.some(o => o !== i && !nomes(o).includes(L.feito) && !nomes(o).includes(L.travado) && (x => x && x.pai === p.pai && x.k < p.k)(parteDe(o)));
  };
  const rodando = validas.filter(i => nomes(i).includes(L.rodando));
  for (const i of fila) {
    // Parte grande do plano vai para o Jules (cloudflare/jules-auto.js). Se ele não aceitar em 3 h (limite do dia), volta ao Cortex.
    if (nomes(i).includes(L.jules)) {
      if (!nomes(i).includes('jules-enviado') && !mexeEmWorkflow(i) && minutos(agora, i.updated_at) > plano.JULES_DESISTE_MIN) acoes.push({ tipo: 'jules-volta', numero: i.number });
      continue;
    }
    // A parte que ainda espera a anterior não vai para o Jules nem para o Cortex: antes ia ao Jules sem a dependência pronta.
    if (esperaAnterior(i)) continue;
    if (mexeEmWorkflow(i)) { acoes.push({ tipo: 'para-jules', numero: i.number }); continue; }
    if (plano.conflitaCom(i, rodando)) continue;   // outra parte rodando mexe no mesmo arquivo: espera ela
    if (precisaDividir(i, tamanhos)) { acoes.push({ tipo: 'dividir', numero: i.number, titulo: i.title || '', tarefa: String(i.body || '').trim(), tamanhos: tamanhosDe(i.body) }); continue; }
    if (ativas >= pistas) break;
    let pista = 1; while (pistasEmUso.has(pista)) pista++;
    pistasEmUso.add(pista); ativas++; rodando.push(i);
    acoes.push({ tipo: 'despachar', numero: i.number, pista, tarefa: String(i.body || '').replace(/<!-- cortex-plano [\s\S]*?-->\n?/, '').trim() });
  }
  // Reenfileirados neste ciclo voltam à fila no próximo (o rótulo "rodando" sai agora).
  return acoes;
}

// Regra do dono: todo projeto termina com teste de pessoa. Fila vazia + trabalho concluído depois do último
// teste = dispara o workflow "Teste de pessoa" (uma vez por rodada de entregas).
function precisaTesteFinal({ abertas, feitoEm, testeEm }) {
  if (abertas > 0 || !feitoEm) return false;
  return !testeEm || new Date(testeEm).getTime() < new Date(feitoEm).getTime();
}

// Sonda do banco do Cortex: UMA escrita pequena. Se o limite grátis do dia acabou, a fila não despacha tarefas novas
// (cada tentativa só queimaria mais escritas); volta sozinha no ciclo seguinte em que a sonda passar. Não é espera por horário.
async function sondarUm(txt, fetchImpl, tokenImpl) {
  try {
    const sa = JSON.parse(txt);
    if (typeof sa.private_key === 'string' && sa.private_key.includes('\\n')) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    const token = tokenImpl ? await tokenImpl(sa) : await require('../lib/firebase-lite/google-auth').createTokenSource(sa).getToken();
    const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/diag_tmp/sonda-fila`;
    const h = { Authorization: `Bearer ${token}` };
    // A cota de LEITURA costuma acabar antes da de escrita: testa as duas.
    const rl = await fetchImpl(url, { method: 'GET', headers: h });
    if (!rl.ok && rl.status !== 404) {
      const c = await rl.text();
      if (rl.status === 429 || /RESOURCE_EXHAUSTED/.test(c)) return { ok: false, motivo: 'limite grátis de leitura do banco acabou' };
      return { ok: true, motivo: `sonda inconclusiva (${rl.status})` };
    }
    const r = await fetchImpl(url, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { t: { stringValue: new Date().toISOString() } } }) });
    if (r.ok) return { ok: true };
    const corpo = await r.text();
    if (r.status === 429 || /RESOURCE_EXHAUSTED/.test(corpo)) return { ok: false, motivo: 'limite grátis de escrita do banco acabou' };
    return { ok: true, motivo: `sonda inconclusiva (${r.status})` };
  } catch (e) {
    return { ok: true, motivo: `sonda falhou (${e.message})` };
  }
}

// Vale se QUALQUER banco do rodízio (B, C) ainda tem cota de leitura e escrita.
async function sondarCota(env = process.env, fetchImpl = (...a) => fetch(...a), tokenImpl = null) {
  if (env.NEXIA_D1_TOKEN && env.NEXIA_D1_ACCOUNT_ID) return { ok: true, motivo: 'banco de reserva D1 ativo' }; // o Vault cai nele sozinho quando o Firebase estoura
  const textos = ['B', 'C'].map(l => (env[`FIREBASE_SERVICE_ACCOUNT_${l}`] || '').trim()).filter(Boolean);
  if (!textos.length) {
    const b64 = (env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').replace(/\s/g, '');
    if (!b64) return { ok: true, motivo: 'sem conta configurada' };
    textos.push(Buffer.from(b64, 'base64').toString('utf8'));
  }
  let ultimo = null;
  for (const txt of textos) {
    const r = await sondarUm(txt, fetchImpl, tokenImpl);
    if (r.ok) return r;
    ultimo = r;
  }
  return ultimo;
}

async function gh(token, method, path, body) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  let json = null; try { json = JSON.parse(txt); } catch { /* vazio */ }
  return { status: r.status, json };
}

const SISTEMA_DIVISOR = 'Você divide uma tarefa grande de programação em tarefas pequenas para uma IA executar uma de cada vez. Regras: de 2 a 5 partes; cada parte é completa por si só (a IA não vê as outras), mexe em UM arquivo ou em poucos relacionados e diz o caminho exato do arquivo, o trecho a mudar e o resultado esperado; copie dos detalhes da tarefa original tudo o que a parte precisa (nomes, textos, caminhos); a ordem das partes deve funcionar de cima para baixo. Responda SOMENTE com um array JSON de textos, sem explicação nem markdown.';

// Pede a um modelo grátis (rodízio) para dividir a tarefa. Sem resposta válida devolve null e a tarefa segue inteira.
async function dividirComIA(tarefa, router, lista) {
  for (const d of lista) {
    try {
      const cap = router.capabilities(d);
      if (!cap.available) continue;
      const out = await Promise.race([router.chat(d, { system: SISTEMA_DIVISOR, messages: [{ role: 'user', content: tarefa.slice(0, 12000) }], maxTokens: 3000, cache: true }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 40000))]);
      const m = out && out.text && /\[[\s\S]*\]/.exec(out.text);
      const arr = m && JSON.parse(m[0]);
      if (Array.isArray(arr) && arr.length >= 2 && arr.length <= 5 && arr.every(t => typeof t === 'string' && t.trim().length >= 30 && t.length <= 3500)) return arr.map(t => t.trim());
    } catch { /* tenta o próximo modelo */ }
  }
  return null;
}

// Planejador: pede o PLANO (partes com arquivos, dependências e critério de pronto) aos modelos grátis, um de cada vez.
// Nenhum válido: tenta o divisor antigo (só textos, em sequência); nada ainda: plano simples, uma parte por arquivo.
// Só devolve null quando o pedido não cita nem 2 arquivos — aí ele segue inteiro, como antes.
async function planejarComIA(tarefa, router, lista, tamanhos = {}) {
  const contexto = Object.keys(tamanhos).length ? `\n\nTamanho dos arquivos citados (bytes): ${JSON.stringify(tamanhos)}` : '';
  for (const d of lista) {
    try {
      if (!router.capabilities(d).available) continue;
      const out = await Promise.race([router.chat(d, { system: plano.SISTEMA_PLANO, messages: [{ role: 'user', content: tarefa.slice(0, 12000) + contexto }], maxTokens: 4000, cache: true }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 40000))]);
      const m = out && out.text && /\[[\s\S]*\]/.exec(out.text);
      const partes = m && plano.validarPlano(JSON.parse(m[0]));
      if (partes) return { partes, origem: `plano da IA (${d.model || d.provider || 'grátis'})` };
    } catch { /* tenta o próximo modelo */ }
  }
  const textos = await dividirComIA(tarefa, router, lista.slice(0, 2));
  if (textos) return { partes: plano.planoDeTextos(textos), origem: 'divisor antigo (em sequência)' };
  const simples = plano.planoSimples(tarefa);
  return simples ? { partes: simples, origem: 'plano simples (uma parte por arquivo)' } : null;
}

// Revisão automática do PR de uma parte com plano: fora dos arquivos do plano ou grande demais = rótulo revisao-manual
// (o portão do auto-merge não junta) e um comentário dizendo o porquê. Dentro do plano, o portão + CI decidem como sempre.
async function revisarParte(token, corpo, desde) {
  const meta = plano.lerPlano(corpo);
  if (!meta) return '';
  try {
    const prs = ((await gh(token, 'GET', '/pulls?state=open&sort=created&direction=desc&per_page=30')).json || [])
      .filter(pr => /^nexia\//.test((pr.head || {}).ref || '') && (!desde || pr.created_at >= desde));
    for (const pr of prs) {
      const files = (await gh(token, 'GET', `/pulls/${pr.number}/files?per_page=100`)).json || [];
      if (!files.some(f => meta.arquivos.includes(f.filename))) continue;
      const problemas = plano.revisarDiff(meta, files);
      if (!problemas.length) return `\nRevisão automática do PR #${pr.number}: dentro do plano (${files.length} arquivo(s)). Entra quando o CI ficar verde.`;
      await gh(token, 'POST', `/issues/${pr.number}/labels`, { labels: ['revisao-manual'] });
      await gh(token, 'POST', `/issues/${pr.number}/comments`, { body: `Revisão automática da parte ${meta.k}/${meta.n} de #${meta.pai}: ${problemas.join('; ')}. Não entra sozinho; precisa de olhar humano.\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_` });
      return `\nRevisão automática do PR #${pr.number}: ${problemas.join('; ')}. Marquei revisao-manual.`;
    }
  } catch (e) { console.log(`revisão da parte: ${e.message}`); }
  return '';
}

async function executar(token, acao, dividir) {
  const n = acao.numero;
  const addLabel = l => gh(token, 'POST', `/issues/${n}/labels`, { labels: [l] });
  const delLabel = l => gh(token, 'DELETE', `/issues/${n}/labels/${encodeURIComponent(l)}`);
  const comentar = t => gh(token, 'POST', `/issues/${n}/comments`, { body: `${t}\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_` });
  // Rótulos pista-N de rodadas antigas confundiam a contagem de pistas livres: fica só o da rodada atual.
  const limparPistas = async (manter = 0) => { for (let k = 1; k <= 10; k++) if (k !== manter) await delLabel(`pista-${k}`).catch(() => null); };
  if (['reenfileirar', 'travar'].includes(acao.tipo) && acao.parte && caminhosDoPedido(acao.corpo).length && await entregouAlgo(token, acao.corpo, null, null, acao.desde)) {
    console.log(`#${n}: a rodada falhou, mas os arquivos do plano já foram entregues; concluo em vez de repetir.`);
    return executar(token, { tipo: 'concluir', numero: n, run: acao.run, corpo: acao.corpo, titulo: acao.titulo, desde: acao.desde }, dividir);
  }
  if (acao.tipo === 'dividir') {
    if (acao.limpar) {
      // Veio de uma tarefa que falhou: sai da pista (rodando) e anota a tentativa; se a divisão falhar, ela volta inteira para a fila.
      await delLabel(L.rodando);
      await limparPistas();
      if (acao.tentativa) await addLabel(`tentativa-${acao.tentativa}`);
    }
    let feito = dividir ? await dividir(acao.tarefa, acao.tamanhos || {}) : null;
    if (Array.isArray(feito)) feito = { partes: plano.planoDeTextos(feito), origem: 'divisor' };
    const partes = feito && feito.partes;
    if (!partes) { await addLabel(L.semDivisao); await comentar('Não consegui dividir esta tarefa agora; ela segue inteira.'); return; }
    const criadas = [];
    for (let k = 0; k < partes.length; k++) {
      const p = partes[k];
      const labels = [L.fila, L.parte];
      if (plano.vaiParaJules(p, acao.tamanhos || {})) labels.push(L.jules);
      const r = await gh(token, 'POST', '/issues', { title: `[Parte ${k + 1}/${partes.length} de #${n}] ${String(p.titulo || acao.titulo).replace(/^NEXIA:\s*/, '').slice(0, 60)}`, body: plano.corpoDaParte(p, k + 1, partes.length, n, partes), labels });
      if (r.status === 201) criadas.push(r.json.number);
    }
    if (criadas.length !== partes.length) { await comentar(`Só criei ${criadas.length} de ${partes.length} partes; deixei a tarefa inteira.`); await addLabel(L.semDivisao); return; }
    await addLabel(L.dividido);
    const juntas = partes.filter(p => !p.depende.length).length;
    const linhas = partes.map((p, k) => `- #${criadas[k]} ${p.titulo}: ${p.arquivos.map(a => '`' + a + '`').join(', ')}${p.depende.length ? ` (depois de ${p.depende.map(d => `#${criadas[d - 1]}`).join(', ')})` : ''}${plano.vaiParaJules(p, acao.tamanhos || {}) ? ' (Jules)' : ''}`);
    await comentar(`Pedido grande: montei um plano com ${partes.length} partes pequenas (${feito.origem}). ${juntas} começam juntas, em pistas diferentes; as outras esperam só a parte de que dependem.\n${linhas.join('\n')}\nCada PR é conferido (só os arquivos do plano, poucas linhas) e, no fim, roda o teste de pessoa.`);
  } else if (acao.tipo === 'concluir-pai') {
    await delLabel(L.dividido); await addLabel(L.feito);
    await comentar(`Todas as partes foram concluídas. ${plano.textoTempo(acao.tempo)}\nPassada final de integração: disparei o teste de pessoa na develop.`.trim());
    await gh(token, 'POST', '/actions/workflows/teste-humano.yml/dispatches', { ref: 'develop' });
    await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
  } else if (acao.tipo === 'despachar') {
    await limparPistas(acao.pista);
    await addLabel(L.rodando); await addLabel(`pista-${acao.pista}`);
    const d = await gh(token, 'POST', '/actions/workflows/smoke-logado.yml/dispatches', {
      ref: 'develop', inputs: { url: BASE_URL, task: acao.tarefa, autonomia: '3', pista: String(acao.pista), modo: 'economico', tarefa_id: String(n) },
    });
    if (d.status !== 204) { await delLabel(L.rodando); await comentar(`Não consegui disparar o Cortex (${d.status}). Tento de novo no próximo ciclo.`); }
  } else if (acao.tipo === 'concluir') {
    if (!(await entregouAlgo(token, acao.corpo, acao.titulo, acao.run, acao.desde))) {
      const ls = nomes((await gh(token, 'GET', `/issues/${n}`)).json || {});
      const { n: k, travar } = depoisSemEntrega(ls);
      await delLabel(L.rodando); await limparPistas();
      for (let j = 1; j < k; j++) await delLabel(`sem-entrega-${j}`);
      await addLabel(travar ? L.travado : `sem-entrega-${k}`);
      const alvo = caminhosDoPedido(acao.corpo).slice(0, 3).join(', ') || 'nenhum PR parecido com o pedido';
      await comentar(travar
        ? `${k} rodadas terminaram sem entregar o código (${alvo}). Travei para não abrir mais rascunhos repetidos; precisa de olhar humano.`
        : `A rodada terminou sem erro, mas não achei o código entregue (${alvo}). Não marquei como feita; volta para a fila (${k}/${MAX_SEM_ENTREGA}).`);
      if (travar) await avisarDono('travado', n, acao.titulo);
      return;
    }
    const revisao = await revisarParte(token, acao.corpo, acao.desde);
    await delLabel(L.rodando); await limparPistas(); await addLabel(L.feito);
    await comentar(`Concluída pelo Cortex: https://github.com/${REPO}/actions/runs/${acao.run}${revisao}`);
    await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
    await avisarDono('feito', n, acao.titulo);
  } else if (acao.tipo === 'reenfileirar') {
    await delLabel(L.rodando); await limparPistas();
    for (const l of [`tentativa-${acao.tentativa - 1}`]) if (acao.tentativa > 1) await delLabel(l);
    await addLabel(`tentativa-${acao.tentativa}`);
    const lsR = nomes((await gh(token, 'GET', `/issues/${n}`)).json || {});
    if (devePedirReserva(acao, lsR)) await chamarReserva(token, n).catch(() => null);
  } else if (acao.tipo === 'fechar-feito') {
    await delLabel(L.rodando); await limparPistas();
    await comentar('Esta tarefa já tinha o rótulo cortex-feito; fechei como concluída.');
    await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
  } else if (acao.tipo === 'para-jules') {
    await addLabel(L.jules);
    await comentar('Esta tarefa mexe em `.github/workflows/`. O app do Cortex não tem a permissão "workflows", então ela vai direto para o Jules (que usa a conta do dono) e não gasta tentativas.');
  } else if (acao.tipo === 'jules-volta') {
    await delLabel(L.jules);
    await comentar('O Jules não aceitou esta parte em 3 h (limite grátis do dia). Ela volta para o Cortex, que lê arquivos grandes por trechos.');
  } else if (acao.tipo === 'jules-feito') {
    for (const l of [L.travado, L.rodando, L.jules]) await delLabel(l).catch(() => null);
    await limparPistas(); await addLabel(L.feito);
    await comentar(`O PR do Jules (#${acao.pr}) entrou na develop. Parte concluída.`);
    await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
  } else if (acao.tipo === 'reserva-volta') {
    // #803: novo dia, nova cota: volta para a fila do zero (tentativa-N, sem-entrega-N e travado saem).
    for (const l of acao.rotulos.filter(x => x === L.semCota || x === L.travado || x === L.rodando || /^(tentativa|sem-entrega|pista)-\d+$/.test(x) || (acao.motivo === 'cofre' && x === 'reserva-tentou'))) await delLabel(l).catch(() => null);
    await comentar(acao.motivo === 'cofre'
      ? 'Esta tarefa travou por erro de ambiente, não por culpa dela (Cofre fora do ar, PR #2221, ou limpeza do teste com login, PR #2301). Ela volta para a fila do zero.'
      : 'Novo dia: a cota das IAs voltou. A tarefa voltou para a fila do zero.');
  } else if (acao.tipo === 'travar') {
    await delLabel(L.rodando); await limparPistas(); await addLabel(L.travado);
    await comentar(`Tarefa travada depois de ${acao.tentativas} tentativas (última: https://github.com/${REPO}/actions/runs/${acao.run}). Precisa de olhar humano.`);
    await avisarDono('travado', n, acao.titulo);
    const lsT = nomes((await gh(token, 'GET', `/issues/${n}`)).json || {});
    if (devePedirReserva(acao, lsT)) await chamarReserva(token, n).catch(() => null);
  }
}

// #833: aviso no celular (Web Push) e e-mail grátis (Brevo, opcional) quando uma tarefa termina ou trava,
// e resumo às 8h. Sem conta de serviço do Firebase ou sem aparelho assinado, não faz nada. CORTEX_AVISOS=0 desliga.
function bancoDosAvisos() {
  if (process.env.CORTEX_AVISOS === '0' || !(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT)) return null;
  try { return require('../netlify/functions/firebase-init').db; } catch { return null; }
}
async function avisarDono(tipo, n, titulo) {
  try {
    const av = require('../netlify/functions/central/cortex-avisos');
    const msg = av.linhaEvento(tipo, n, titulo);
    const db = bancoDosAvisos();
    if (db) await av.avisarPush(db, msg);
    if (process.env.CORTEX_AVISOS !== '0') await av.avisarEmail(`${msg.titulo}: ${msg.corpo}`, `${msg.corpo}\nhttps://github.com/${REPO}/issues/${n}`);
  } catch (e) { console.log(`aviso: ${e.message}`); }
}
async function resumoDiario(token, issues) {
  try {
    const db = bancoDosAvisos();
    if (!db) return;
    const av = require('../netlify/functions/central/cortex-avisos');
    const d = await av.lerDoc(db);
    const { mandar, dia } = av.horaDoResumo(Date.now(), d.resumoEm);
    if (!mandar) return;
    const desde = new Date(Date.now() - 864e5).toISOString();
    const feitas = ((await gh(token, 'GET', `/issues?state=closed&labels=${L.feito}&since=${desde}&per_page=100`)).json || []).filter(i => !i.pull_request && i.closed_at >= desde);
    const abertas = issues.filter(i => !i.pull_request && !nomes(i).includes(L.dividido));
    const travadas = abertas.filter(i => nomes(i).includes(L.travado));
    const texto = av.textoResumo({ feitas, travadas, naFila: abertas.length - travadas.length });
    await av.ref(db).set({ resumoEm: dia }, { merge: true });
    await av.avisarPush(db, { titulo: '☀️ Resumo do Cortex', corpo: texto, tag: 'cx-resumo' });
    await av.avisarEmail('Resumo do Cortex', texto);
    console.log(`resumo das 8h: ${texto}`);
  } catch (e) { console.log(`resumo das 8h: ${e.message}`); }
}

// Token da GitHub App do NEXIA (pode abrir PR; o NEXIA_JOBS_TOKEN cria ramo e arquivo mas o GitHub recusa o PR).
async function tokenDaApp() {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) return null;
  const { createAuth } = require('../nexia-ai/github-adapter/auth');
  const [owner, repo] = REPO.split('/');
  const auth = createAuth({ env: process.env, fetchImpl: fetch, apiBase: 'https://api.github.com' });
  const h = await auth.headersFor({ owner, repo }, { write: true, permissions: { contents: 'write', pull_requests: 'write' } });
  return String(h.Authorization || '').replace(/^Bearer /, '') || null;
}

async function literalDireto(token, issues) {
  let escrita = process.env.NEXIA_JOBS_TOKEN || token; // chave do dono (autorizada): o CI roda nos PRs que ela abre
  try { escrita = (await tokenDaApp()) || escrita; } catch (e) { console.log(`App do NEXIA indisponível (${e.message}); uso a chave da fila.`); }
  try {
    const { processarDiretos } = require('./cortex-literal-direto');
    const lerArquivo = async p => {
      const r = await gh(escrita, 'GET', `/contents/${p}?ref=develop`);
      return r.status === 200 && r.json.content ? { sha: r.json.sha, content: Buffer.from(r.json.content, 'base64').toString('utf8') } : null;
    };
    const base = (await gh(escrita, 'GET', '/git/ref/heads/develop')).json;
    const rodape = '\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_';
    return await processarDiretos({
      issues, abertosPRs: (await gh(token, 'GET', '/pulls?state=open&per_page=100')).json || [], lerArquivo,
      gravar: async (ramo, arqs, msg) => {
        const c = await gh(escrita, 'POST', '/git/refs', { ref: `refs/heads/${ramo}`, sha: base.object.sha });
        if (c.status !== 201) throw new Error(`ramo ${c.status}`);
        for (const a of arqs) {
          const w = await gh(escrita, 'PUT', `/contents/${a.path}`, { message: msg, content: Buffer.from(a.content).toString('base64'), branch: ramo, sha: a.sha });
          if (w.status >= 300) throw new Error(`gravar ${a.path} ${w.status}`);
        }
      },
      abrirPR: async (ramo, i, arqs) => {
        const r = await gh(escrita, 'POST', '/pulls', { title: `Cópia literal do pedido #${i.number}`, head: ramo, base: 'develop', body: `Pedido #${i.number}, gravado direto (sem IA): ${arqs.map(a => '`' + a.path + '`').join(', ')}.\n\nNão fecha o pedido: a fila fecha quando o arquivo estiver na develop.` });
        if (r.status !== 201) throw new Error(`PR ${r.status} ${String((r.json || {}).message || '').slice(0, 120)}`);
        return r.json.number;
      },
      concluir: async n => {
        await gh(token, 'DELETE', `/issues/${n}/labels/${L.travado}`); await gh(token, 'DELETE', `/issues/${n}/labels/${L.rodando}`);
        await gh(token, 'POST', `/issues/${n}/labels`, { labels: [L.feito] });
        await gh(token, 'POST', `/issues/${n}/comments`, { body: `Os arquivos pedidos já estão na develop, idênticos ao pedido. Concluída.${rodape}` });
        await gh(token, 'PATCH', `/issues/${n}`, { state: 'closed', state_reason: 'completed' });
      },
      comentar: (n, t) => gh(token, 'POST', `/issues/${n}/comments`, { body: t + rodape }),
    });
  } catch (e) { console.log(`cópia direta falhou (${e.message}); a fila normal segue.`); return new Set(); }
}

// Rascunhos parados (#1017): PR aberto, em rascunho, do app do Cortex, título "NEXIA:", sem commit novo há 72 h
// e sem rótulo automerge → fecha com um comentário (nada é apagado: o ramo fica e o PR pode ser reaberto).
// No máximo 10 por ciclo. Nunca mexe em PR que não é rascunho nem em PR de outra pessoa.
const PARADO_MS = 72 * 3600e3;
const MAX_FECHAR_RASCUNHOS = 10;
const MSG_RASCUNHO_PARADO = 'Fechado por estar parado há 3 dias. A tarefa continua na fila do Cortex e pode abrir um PR novo.';
const doCortex = pr => { const u = pr.user || {}; return u.type === 'Bot' && /^nexia[\w-]*\[bot\]$/.test(u.login || ''); };
// Pré-filtro sem pedir nada ao GitHub (a data do último commit vem depois, só para estes).
function candidatosRascunho(prs, agora = Date.now()) {
  return (prs || []).filter(pr => pr.state === 'open' && pr.draft === true && /^NEXIA:/.test(pr.title || '') && doCortex(pr)
    && !nomes(pr).includes('automerge') && agora - Date.parse(pr.created_at || 0) >= PARADO_MS);
}
// commitEm: { [numero do PR]: data ISO do último commit }. Sem data conhecida, não fecha.
function rascunhosParados({ prs, commitEm = {}, agora = Date.now(), max = MAX_FECHAR_RASCUNHOS }) {
  return candidatosRascunho(prs, agora).filter(pr => {
    const t = Date.parse(commitEm[pr.number] || '');
    return Number.isFinite(t) && agora - t >= PARADO_MS;
  }).slice(0, max).map(pr => pr.number);
}

async function fecharRascunhosParados(token) {
  let escrita = token;
  try { escrita = (await tokenDaApp()) || token; } catch { /* sem app: usa a chave do workflow */ }
  const prs = [];
  for (let pag = 1; pag <= 3; pag++) {
    const lote = (await gh(token, 'GET', `/pulls?state=open&per_page=100&page=${pag}`)).json || [];
    prs.push(...lote);
    if (lote.length < 100) break;
  }
  const commitEm = {};
  for (const pr of candidatosRascunho(prs).slice(0, 30)) {
    const c = (await gh(token, 'GET', `/commits/${pr.head && pr.head.sha}`)).json;
    commitEm[pr.number] = c && c.commit && ((c.commit.committer && c.commit.committer.date) || (c.commit.author && c.commit.author.date));
  }
  const fechar = rascunhosParados({ prs, commitEm });
  for (const n of fechar) {
    await gh(escrita, 'POST', `/issues/${n}/comments`, { body: MSG_RASCUNHO_PARADO });
    const r = await gh(escrita, 'PATCH', `/pulls/${n}`, { state: 'closed' });
    console.log(`rascunho parado #${n}: fechado (${r.status}).`);
  }
  return fechar;
}

// #828: PR do Cortex com o CI vermelho volta para o Cortex com as últimas 80 linhas do erro (até 2 vezes).
// Uma correção por ciclo, sem pista (projeto principal) e nunca duas ao mesmo tempo. CORTEX_CORRIGIR_CI=0 desliga.
async function logDoJob(token, jobId) {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${jobId}/logs`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}
async function corrigirCiDosPrs(token, runs) {
  if (process.env.CORTEX_CORRIGIR_CI === '0') return null;
  const cc = require('../nexia-ai/orchestrator/correcao-ci');
  if ((runs || []).some(r => /^Cortex #PR\d+/.test(r.name || '') && r.status !== 'completed')) return null;   // já tem uma correção rodando
  let escrita = token;
  try { escrita = (await tokenDaApp()) || token; } catch { /* sem app: usa a chave do workflow */ }
  const prs = ((await gh(token, 'GET', '/pulls?state=open&sort=updated&direction=desc&per_page=30')).json || []).filter(pr => /^nexia\//.test((pr.head || {}).ref || '') && cc.pedidoDoPr(pr.body));
  for (const pr of prs) {
    // Jobs do Actions do commit (a chave da fila tem actions:read; check-runs pediria checks:read).
    const execs = ((await gh(token, 'GET', `/actions/runs?head_sha=${pr.head.sha}&per_page=10`)).json || {}).workflow_runs || [];
    const checks = [];
    for (const ex of execs.slice(0, 4)) checks.push(...(((await gh(token, 'GET', `/actions/runs/${ex.id}/jobs?per_page=50`)).json || {}).jobs || []));
    const comentarios = (await gh(token, 'GET', `/issues/${pr.number}/comments?per_page=100`)).json || [];
    const d = cc.decidirCorrecao({ pr, checks, comentarios });
    if (!d || d.tipo === 'esperar') continue;
    if (d.tipo === 'ajuda') {
      await gh(escrita, 'POST', `/issues/${pr.number}/comments`, { body: `<!-- cortex-ajuda-ci -->O Cortex tentou corrigir o CI ${cc.MAX_CORRECOES} vezes e não conseguiu. Precisa de olhar humano.` });
      console.log(`CI do PR #${pr.number}: pediu ajuda.`);
      continue;
    }
    const falho = checks.find(c => c.name === cc.CHECK_CI && c.conclusion === 'failure');
    const erro = cc.ultimasLinhas(await logDoJob(token, falho.id)) || String((falho.output || {}).summary || 'sem log');
    const task = `${cc.pedidoDoPr(pr.body)}${cc.MARCA}${cc.feedbackCi(erro, d.rodada)}`;
    const r = await gh(token, 'POST', '/actions/workflows/smoke-logado.yml/dispatches', {
      ref: 'develop', inputs: { url: BASE_URL, task, autonomia: '3', pista: '', modo: 'economico', tarefa_id: `PR${pr.number}` },
    });
    await gh(escrita, 'POST', `/issues/${pr.number}/comments`, { body: `${cc.comentarioCi(pr.head.sha, d.rodada)}O CI falhou. O Cortex recebeu as últimas ${cc.LINHAS} linhas do erro e vai tentar corrigir (${d.rodada}/${cc.MAX_CORRECOES}).` });
    console.log(`CI do PR #${pr.number}: correção ${d.rodada} disparada (${r.status}).`);
    return pr.number;   // uma por ciclo
  }
  return null;
}

// Dados extras que o planejador precisa, buscados só quando há partes com plano ou pedidos novos:
// tamanho dos arquivos citados (pela listagem da pasta, sem baixar o arquivo), arquivos dos PRs nexia/* abertos
// e partes enviadas ao Jules cujo PR já entrou na develop.
async function dadosDoPlanejador(token, issues) {
  const out = { tamanhos: {}, prs: [], julesFeitos: [] };
  try {
    const novas = issues.filter(i => !i.pull_request && !nomes(i).some(l => [L.rodando, L.feito, L.travado, L.dividido, L.parte, L.semDivisao].includes(l))).slice(0, 15);
    const pastas = new Map();
    for (const i of novas) for (const a of plano.arquivosCitados(i.body)) { const d = a.slice(0, a.lastIndexOf('/')); (pastas.get(d) || pastas.set(d, new Set()).get(d)).add(a); }
    for (const [d, arqs] of [...pastas].slice(0, 20)) {
      const lista = (await gh(token, 'GET', `/contents/${d}?ref=develop`)).json;
      if (Array.isArray(lista)) for (const f of lista) if (arqs.has(f.path)) out.tamanhos[f.path] = f.size;
    }
    const comPlano = issues.some(i => plano.lerPlano(i.body));
    if (comPlano) {
      const abertos = ((await gh(token, 'GET', '/pulls?state=open&per_page=30')).json || []).filter(pr => /^nexia\//.test((pr.head || {}).ref || ''));
      for (const pr of abertos) out.prs.push({ numero: pr.number, criadoEm: pr.created_at, arquivos: (((await gh(token, 'GET', `/pulls/${pr.number}/files?per_page=100`)).json) || []).map(f => f.filename) });
    }
    const noJules = issues.filter(i => !i.pull_request && nomes(i).includes('jules-enviado'));
    if (noJules.length) {
      const fechados = ((await gh(token, 'GET', '/pulls?state=closed&sort=updated&direction=desc&per_page=50')).json || []).filter(pr => pr.merged_at);
      for (const i of noJules) {
        const pr = fechados.find(x => new RegExp(`#${i.number}(?!\\d)`).test(`${x.title || ''}\n${x.body || ''}`));
        if (pr) out.julesFeitos.push({ tipo: 'jules-feito', numero: i.number, pr: pr.number });
      }
    }
  } catch (e) { console.log(`planejador: ${e.message}`); }
  return out;
}

// Placar de cada ciclo (aparece no resumo do workflow): pistas em uso, esperando dependência, no Jules, travadas.
function placar(issues, acoes) {
  const abertas = issues.filter(i => !i.pull_request);
  const c = l => abertas.filter(i => nomes(i).includes(l)).length;
  const linha = `Pistas: ${c(L.rodando) + acoes.filter(a => a.tipo === 'despachar').length}/${PISTAS} · na fila: ${abertas.length} · planos: ${c(L.dividido)} · Jules: ${c(L.jules) + c('jules-enviado')} · travadas: ${c(L.travado)} · ações: ${acoes.map(a => a.tipo).join(', ') || 'nenhuma'}`;
  console.log(linha);
  if (process.env.GITHUB_STEP_SUMMARY) try { require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Fila do Cortex\n${linha}\n`); } catch { /* sem resumo */ }
}

async function abrirAlertaAmbiente(token, alertas) {
  const abertos = ((await gh(token, 'GET', '/issues?state=open&labels=cortex-alerta&per_page=20')).json || []).filter(i => !i.pull_request);
  for (const a of alertas) {
    const corpo = `Erro de AMBIENTE: o mesmo passo falhou em ${a.tarefas.length} tarefas diferentes na última hora. Não é culpa das tarefas; elas não perdem tentativas e a fila segura novos despachos até isto passar.\n\nPasso(s) que falharam: \`${a.assinatura}\`\nTarefas: ${a.tarefas.map(n => `#${n}`).join(', ')}\nExecuções: ${a.runs.map(id => `https://github.com/${REPO}/actions/runs/${id}`).join(' ')}\n\nPronto quando: o passo acima volta a passar em scripts/smoke-logado.js.`;
    const igual = abertos.find(i => String(i.body || '').includes(`\`${a.assinatura}\``));
    if (igual) { await gh(token, 'POST', `/issues/${igual.number}/comments`, { body: `Repetiu agora em ${a.tarefas.map(n => `#${n}`).join(', ')}.` }); continue; }
    await gh(token, 'POST', '/issues', { title: `Alerta: erro de ambiente na fila (${a.assinatura.slice(0, 60)})`, body: corpo, labels: ['cortex-alerta', L.prioridade, L.fila] });
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Falta GITHUB_TOKEN.');
  for (const l of Object.values(L)) await gh(token, 'POST', '/labels', { name: l, color: '1d76db' });
  // Todas as abertas (antes só as 50 mais novas: as antigas sumiam da fila e as tarefas "rodando" nelas nunca fechavam).
  const issues = [];
  for (let pag = 1; pag <= 10; pag++) {
    const lote = (await gh(token, 'GET', `/issues?state=open&labels=${L.fila}&per_page=100&page=${pag}`)).json || [];
    issues.push(...lote);
    if (lote.length < 100) break;
  }
  const runs = ((await gh(token, 'GET', '/actions/workflows/smoke-logado.yml/runs?per_page=60')).json || {}).workflow_runs || [];
  // Marca as falhas causadas pela cota do banco (o resumo do smoke traz o código do Firestore).
  for (const r of runs.filter(x => x.status === 'completed' && x.conclusion !== 'success' && /^Cortex #/.test(x.name || '') && minutos(Date.now(), x.updated_at || x.created_at) <= 60).slice(0, 12)) {
    try {
      const jobs = ((await gh(token, 'GET', `/actions/runs/${r.id}/jobs`)).json || {}).jobs || [];
      for (const j of jobs) {
        const an = (await gh(token, 'GET', `/check-runs/${j.id}/annotations?per_page=50`)).json || [];
        if (an.some(a => /RESOURCE_EXHAUSTED/.test(`${a.message || ''}`))) r.cota = true;
        const resumo = an.find(a => a.title === 'Resumo do smoke');
        if (resumo && !r.assinatura) r.assinatura = assinaturaDoSmoke(resumo.message);
      }
    } catch { /* sem anotação: segue como falha comum */ }
  }
  // Cópia literal ("Copie EXATAMENTE") não passa por IA: grava direto e a fila normal não despacha essas tarefas.
  const direto = await literalDireto(token, issues);
  const extra = await dadosDoPlanejador(token, issues);
  const alertas = errosDeAmbiente(runs);
  let acoes = decidir({ issues: issues.filter(i => !direto.has(i.number)), runs, ...extra });
  if (alertas.length) {
    // Erro de ambiente: 1 alerta (não 12 tentativas em cada tarefa) e não despacha mais neste ciclo, para não queimar execuções.
    try { await abrirAlertaAmbiente(token, alertas); } catch (e) { console.log(`alerta de ambiente: ${e.message}`); }
    acoes = acoes.filter(a => a.tipo !== 'despachar');
  }
  acoes.push(...(extra.julesFeitos || []));
  try { acoes.push(...(await reservasQueVoltam(token, issues) || [])); } catch (e) { console.log(`reserva sem cota: ${e.message}`); }
  try { acoes.push(...((await travadasPeloCofre(token, issues) || [])).filter(a => !acoes.some(x => x.numero === a.numero))); } catch (e) { console.log(`travadas pelo cofre: ${e.message}`); }
  // Sem escrita disponível no banco, despachar só queima mais cota: segura as tarefas novas (o resto segue).
  if (acoes.some(a => a.tipo === 'despachar')) {
    const sonda = await sondarCota();
    if (!sonda.ok) { console.log(`cota esgotada (${sonda.motivo}): ${acoes.filter(a => a.tipo === 'despachar').length} tarefa(s) esperam na fila sem despachar.`); acoes = acoes.filter(a => a.tipo !== 'despachar'); }
    else if (sonda.motivo) console.log(`sonda: ${sonda.motivo}`);
  }
  // Pais divididos: quando todas as partes terminam, o pai é concluído.
  const pais = issues.filter(i => !i.pull_request && nomes(i).includes(L.dividido));
  if (pais.length) {
    const partes = ((await gh(token, 'GET', `/issues?state=all&labels=${L.parte}&per_page=100`)).json || []).filter(i => !i.pull_request);
    for (const n of paisConcluidos({ pais, partes })) {
      const pai = pais.find(x => x.number === n);
      const minhas = partes.filter(p => new RegExp(`de #${n}\\]`).test(p.title || ''));
      acoes.push({ tipo: 'concluir-pai', numero: n, tempo: plano.medirTempo(pai.created_at, minhas) });
    }
  }
  // O divisor usa só modelos grátis (rodízio); o roteador só é carregado se houver algo para dividir.
  let dividir = null;
  if (acoes.some(a => a.tipo === 'dividir')) {
    const { getRouter } = require('../nexia-ai/model-router');
    const { listFor } = require('../nexia-ai/orchestrator/models');
    const router = getRouter();
    // Planejar pede raciocínio: modelos de raciocínio primeiro, depois os rápidos. Só grátis (Anthropic fica de fora: é pago).
    const vistos = new Set();
    const lista = [...listFor('reasoning'), ...listFor('fast')].filter(d => d.provider !== 'anthropic' && !vistos.has(`${d.provider}/${d.model}`) && vistos.add(`${d.provider}/${d.model}`));
    dividir = (t, tam) => planejarComIA(t, router, lista, tam);
  }
  for (const a of acoes) { console.log(`${a.tipo} #${a.numero}${a.pista ? ` pista ${a.pista}` : ''}${a.tentativa ? ` tentativa ${a.tentativa}` : ''}`); await executar(token, a, dividir); }
  console.log(`${issues.length} na fila, ${acoes.length} ação(ões).`);
  placar(issues, acoes);
  try { await fecharRascunhosParados(token); } catch (e) { console.log(`rascunhos parados: ${e.message}`); }
  try { await corrigirCiDosPrs(token, runs); } catch (e) { console.log(`correção de CI: ${e.message}`); }
  await resumoDiario(token, issues);
  const ignoradas = issues.filter(i => !i.pull_request && !confiavel(i));
  if (ignoradas.length) console.log(`ignoradas (autor sem acesso): ${ignoradas.map(i => `#${i.number}`).join(', ')}`);
  if (!issues.length) {
    const feitas = ((await gh(token, 'GET', `/issues?state=closed&labels=${L.feito}&sort=updated&direction=desc&per_page=5`)).json || []).filter(i => !i.pull_request);
    const testes = ((await gh(token, 'GET', '/actions/workflows/teste-humano.yml/runs?per_page=1')).json || {}).workflow_runs || [];
    if (precisaTesteFinal({ abertas: 0, feitoEm: feitas[0] && feitas[0].closed_at, testeEm: testes[0] && testes[0].created_at })) {
      const r = await gh(token, 'POST', '/actions/workflows/teste-humano.yml/dispatches', { ref: 'develop' });
      console.log(`fila vazia: teste de pessoa disparado (${r.status}).`);
    }
  }
}

module.exports = { ultimoRotuloEm, travadasPeloCofre, entregaComprovada, MAX_RECUPERAR_POR_CICLO, FORA_DA_RECUPERACAO, soPipelineModelo, assinaturaDoSmoke, errosDeAmbiente, mexeEmWorkflow, planejarComIA, revisarParte, dadosDoPlanejador, corrigirCiDosPrs, reservaVolta, reservasQueVoltam, travouAntesDoConserto, devePedirReserva, entregouAlgo, depoisSemEntrega, MAX_SEM_ENTREGA, rascunhosParados, candidatosRascunho, MSG_RASCUNHO_PARADO, tokenDaApp, TENTATIVAS_ATE_DIVIDIR, caminhosDoPedido, sondarCota, decidir, precisaTesteFinal, precisaDividir, paisConcluidos, dividirComIA, MAX_TENTATIVAS };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
