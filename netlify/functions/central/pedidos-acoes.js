'use strict';
// Cortex no celular: o que o dono pode fazer num pedido (pedir, responder, tentar de novo, cancelar, aprovar PR).
let montarPedido = null;
try { ({ montarPedido } = require('./pedidos-pedir')); } catch { /* sem o roteador por projeto, vale o pedido simples */ }

const { publicar } = require('./pedidos-publicar');
const { mandarParaJules } = require('./pedidos-jules');

const issue = (c) => '/repos/gilcambe/nexia/issues/' + c;
// Dispara um robô (workflow_dispatch) pelo mesmo token dos pedidos. Antes o socorro importava um "rodar" que não existe.
const disparar = (p, arquivo, inputs) => p.gh('/repos/gilcambe/nexia/actions/workflows/' + arquivo + '/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'develop', inputs }) });
const ROTULO_PAUSA = 'fila-pausada';
const r = (status, corpo) => ({ status, corpo });

// Anexo de qualquer tipo (foto, PDF, planilha...): vai para o ramo cortex-anexos e o pedido cita o caminho.
const RAMO_ANEXOS = 'cortex-anexos';
const MAX_BASE64 = 950000;
async function anexar(p, b) {
  const nome = String(b.nome || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '').slice(-80) || 'arquivo';
  const dados = String(b.base64 || '');
  if (!/^[A-Za-z0-9+/=]+$/.test(dados) || dados.length < 4) return r(400, { error: 'Arquivo inválido.' });
  if (dados.length > MAX_BASE64) return r(400, { error: 'Arquivo grande demais (máximo uns 700 KB; fotos são reduzidas sozinhas).' });
  const repo = '/repos/gilcambe/nexia';
  let ramoExiste = true;
  try { await p.gh(repo + '/git/ref/heads/' + RAMO_ANEXOS); } catch { ramoExiste = false; }
  if (!ramoExiste) {
    const base = await p.gh(repo + '/git/ref/heads/develop');
    await p.gh(repo + '/git/refs', { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/' + RAMO_ANEXOS, sha: base.object.sha }) });
  }
  const caminho = 'cortex-anexos/' + new Date().toISOString().slice(0, 10) + '-' + Date.now().toString(36) + '-' + nome;
  await p.gh(repo + '/contents/' + caminho, { method: 'PUT', body: JSON.stringify({ message: 'Anexo do Cortex: ' + nome, content: dados, branch: RAMO_ANEXOS }) });
  return r(200, { ok: true, caminho, ramo: RAMO_ANEXOS, mensagem: 'Anexo guardado.' });
}

async function agir(p, b, quem) {
  // #825: entende o anexo (descrição da imagem, texto do PDF/planilha, transcrição do áudio) com IA grátis.
  if (b.acao === 'entender') {
    const x = await require('../../../lib/anexos-entender').entenderAnexo({ nome: b.nome, tipo: b.tipo, base64: b.base64 }, globalThis.__NEXIA_AI__ ? { ...process.env, AI: globalThis.__NEXIA_AI__ } : process.env);
    return x.erro ? r(200, { ok: false, tipo: x.tipo, mensagem: x.erro }) : r(200, { ok: true, tipo: x.tipo, texto: x.texto, mensagem: 'Anexo entendido.' });
  }
  const texto = String(b.texto || '').trim();
  const n = Number(b.n) || 0;
  if (b.acao === 'pedir') {
    if (texto.length < 10) return r(400, { error: 'Escreva o pedido com pelo menos 10 letras.' });
    if (texto.length > 60000) return r(400, { error: 'Pedido grande demais. Divida em pedidos menores (até 60000 letras).' });
    const ped = montarPedido ? montarPedido(texto, quem) : { titulo: texto.split('\n')[0].slice(0, 90), labels: ['cortex-fila'], body: texto + '\n\n_Pedido de ' + quem + '._' };
    const i = await p.gh('/repos/gilcambe/nexia/issues', { method: 'POST', body: JSON.stringify({ title: ped.titulo, labels: ped.labels, body: ped.body }) });
    return r(200, { ok: true, numero: i.number, mensagem: 'Pedido #' + i.number + ' na fila. O Cortex pega em até 15 minutos.' });
  }
  if (b.acao === 'anexar') return anexar(p, b);
  if (b.acao === 'publicar') return publicar(p.gh);
  // #2718: AJUDA AO CORTEX. Socorro geral, botão de emergência e pedir ajuda às IAs conectadas numa tarefa.
  if (b.acao === 'socorro') { const x = await socorro(p, { jules: !!b.jules }); return r(200, x); }
  if (b.acao === 'pausar-fila' || b.acao === 'voltar-fila') return pausa(p, b.acao === 'pausar-fila', quem);
  if (!n && b.acao !== 'juntar') return r(400, { error: 'Falta o número do pedido.' });
  if (b.acao === 'reserva') {
    await disparar(p, 'cortex-reserva.yml', { numero: String(n) });
    return r(200, { ok: true, mensagem: 'Pedi às IAs conectadas na Central para fazer o pedido #' + n + '. Elas abrem o PR sozinhas.' });
  }
  // Cortex → Jules (grátis): manda a tarefa travada para o Jules resolver e abrir o PR.
  if (b.acao === 'jules') { const x = await require('./pedidos-jules').mandarParaJules(p, n, quem); return r(x.status, x.corpo); }
  if (b.acao === 'comentar') {
    if (texto.length < 2) return r(400, { error: 'Escreva a mensagem.' });
    await p.gh(issue(n) + '/comments', { method: 'POST', body: JSON.stringify({ body: texto + '\n\n_Nota de ' + quem + '._' }) });
    return r(200, { ok: true, mensagem: 'Mensagem guardada no pedido #' + n + '.' });
  }
  if (b.acao === 'tentar') {
    const i = await p.gh(issue(n));
    const tirar = (i.labels || []).map((l) => l.name).filter((l) => l === 'cortex-travado' || l === 'cortex-rodando' || /^tentativa-\d+$/.test(l) || /^pista-\d+$/.test(l));
    for (const l of tirar) await p.gh(issue(n) + '/labels/' + encodeURIComponent(l), { method: 'DELETE' }).catch(() => null);
    await p.gh(issue(n), { method: 'PATCH', body: JSON.stringify({ state: 'open' }) });
    return r(200, { ok: true, mensagem: 'O pedido #' + n + ' voltou para a fila, com as tentativas zeradas.' });
  }
  if (b.acao === 'cancelar' || b.acao === 'reabrir') {
    const abrir = b.acao === 'reabrir';
    await p.gh(issue(n), { method: 'PATCH', body: JSON.stringify(abrir ? { state: 'open' } : { state: 'closed', state_reason: 'not_planned' }) });
    return r(200, { ok: true, mensagem: abrir ? 'Pedido #' + n + ' reaberto.' : 'Pedido #' + n + ' cancelado. Dá para reabrir quando quiser.' });
  }
  if (b.acao === 'juntar') {
    const pr = await p.gh('/repos/gilcambe/nexia/pulls/' + (Number(b.pr) || 0));
    if (pr.state !== 'open' || !String(pr.head.ref).startsWith('nexia/')) return r(400, { error: 'Só PR aberto do Cortex (ramo nexia/...) entra por aqui.' });
    await p.gh(issue(pr.number) + '/labels', { method: 'POST', body: JSON.stringify({ labels: ['automerge'] }) });
    return r(200, { ok: true, mensagem: 'PR #' + pr.number + ' aprovado. Entra sozinho quando os testes ficarem verdes.' });
  }
  return r(400, { error: 'Ação desconhecida.' });
}

// Socorro (#2324, consertado no #2718): as travadas mais recentes vão para as IAs conectadas (Reserva) ou, com a opção
// "Incluir o Jules", as que mexem em workflow ou já passaram 2 vezes pela Reserva vão para o Jules.
async function socorro(p, { jules }) {
  const lista = await p.gh('/repos/gilcambe/nexia/issues?state=open&labels=cortex-travado&sort=updated&direction=desc&per_page=5');
  const issues = (Array.isArray(lista) ? lista : []).filter((i) => !i.pull_request);
  const seisHorasAtras = Date.now() - 6 * 36e5;
  const resultado = [];
  for (const i of issues) {
    const labels = (i.labels || []).map((l) => l.name || l);
    if (labels.includes('reserva-tentou') && Date.parse(i.updated_at) > seisHorasAtras) continue;
    const praJules = jules && (/\.github\/workflows\//.test(String(i.title || '')) || labels.filter((l) => l.startsWith('reserva-tentativa-')).length >= 2);
    try {
      if (praJules) {
        const x = await mandarParaJules(p, i.number, 'socorro');
        if (x.status !== 200) continue;
      } else {
        await disparar(p, 'cortex-reserva.yml', { numero: String(i.number) });
      }
      resultado.push({ numero: i.number, titulo: i.title, para: praJules ? 'jules' : 'reserva', link: i.html_url });
    } catch { /* uma tarefa que falhou não impede as outras */ }
  }
  return {
    total: resultado.length, ias: resultado.filter((x) => x.para === 'reserva').length, jules: resultado.filter((x) => x.para === 'jules').length,
    travadas: issues.length, links: resultado.map((x) => ({ numero: x.numero, titulo: x.titulo })), ultimaExecucao: new Date().toISOString(), resultado,
  };
}

// Botão de emergência: uma issue aberta com fila-pausada faz a fila (scripts/cortex-fila.js) parar de despachar.
async function pausa(p, pausar, quem) {
  const abertas = await p.gh('/repos/gilcambe/nexia/issues?state=open&labels=' + ROTULO_PAUSA + '&per_page=10');
  const lista = (Array.isArray(abertas) ? abertas : []).filter((i) => !i.pull_request);
  if (pausar) {
    if (!lista.length) await p.gh('/repos/gilcambe/nexia/issues', { method: 'POST', body: JSON.stringify({ title: '🛑 Fila do Cortex pausada', body: 'Pausada pelo botão de emergência da Central por ' + quem + '. Feche esta issue (ou toque em "Voltar a rodar") para a fila andar de novo.', labels: ['cortex-fila', ROTULO_PAUSA] }) });
    return r(200, { ok: true, pausada: true, mensagem: 'Fila pausada. O que já está rodando termina; nada novo começa até você tocar em "Voltar a rodar".' });
  }
  for (const i of lista) await p.gh(issue(i.number), { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
  return r(200, { ok: true, pausada: false, mensagem: 'A fila voltou a rodar.' });
}

module.exports = { agir, socorro, pausa };
