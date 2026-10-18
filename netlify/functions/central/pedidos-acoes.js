'use strict';
// Cortex no celular: o que o dono pode fazer num pedido (pedir, responder, tentar de novo, cancelar, aprovar PR).
let montarPedido = null;
try { ({ montarPedido } = require('./pedidos-pedir')); } catch { /* sem o roteador por projeto, vale o pedido simples */ }

const { publicar } = require('./pedidos-publicar');

const issue = (c) => '/repos/gilcambe/nexia/issues/' + c;
const r = (status, corpo) => ({ status, corpo });

async function agir(p, b, quem) {
  const texto = String(b.texto || '').trim();
  const n = Number(b.n) || 0;
  if (b.acao === 'pedir') {
    if (texto.length < 10) return r(400, { error: 'Escreva o pedido com pelo menos 10 letras.' });
    if (texto.length > 3500) return r(400, { error: 'Pedido grande demais. Divida em pedidos menores (até 3500 letras).' });
    const ped = montarPedido ? montarPedido(texto, quem) : { titulo: texto.split('\n')[0].slice(0, 90), labels: ['cortex-fila'], body: texto + '\n\n_Pedido pelo Cortex no celular por ' + quem + '._' };
    const i = await p.gh('/repos/gilcambe/nexia/issues', { method: 'POST', body: JSON.stringify({ title: ped.titulo, labels: ped.labels, body: ped.body }) });
    return r(200, { ok: true, numero: i.number, mensagem: 'Pedido #' + i.number + ' na fila. O Cortex pega em até 15 minutos.' });
  }
  if (b.acao === 'publicar') return publicar(p.gh);
  if (!n && b.acao !== 'juntar') return r(400, { error: 'Falta o número do pedido.' });
  if (b.acao === 'comentar') {
    if (texto.length < 2) return r(400, { error: 'Escreva a mensagem.' });
    await p.gh(issue(n) + '/comments', { method: 'POST', body: JSON.stringify({ body: texto + '\n\n_Pelo Cortex no celular por ' + quem + '._' }) });
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

module.exports = { agir };
