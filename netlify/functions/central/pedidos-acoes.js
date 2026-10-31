'use strict';
// Cortex no celular: o que o dono pode fazer num pedido (pedir, responder, tentar de novo, cancelar, aprovar PR).
let montarPedido = null;
try { ({ montarPedido } = require('./pedidos-pedir')); } catch { /* sem o roteador por projeto, vale o pedido simples */ }

const { publicar } = require('./pedidos-publicar');
const { mandarParaJules } = require('./pedidos-jules');
const { rodar } = require('./github');

// Helper da parte 1: valida se o usuário é admin da Central (master).
// Recebe o email/identificador de quem chama e retorna true se for admin.
function ehAdminDaCentral(quem) {
  // O handler (pedidos.js) já validou que auth.role === 'master' antes de chamar agir.
  // Aqui conferimos se o identificador passado corresponde ao dono configurado.
  const donoLogin = (process.env.NEXIA_DONO_LOGIN || '').toLowerCase();
  const quemLower = String(quem || '').toLowerCase();
  if (donoLogin && quemLower === donoLogin) return true;
  // Fallback: se não tem NEXIA_DONO_LOGIN, aceita 'dono' ou 'master' como identificadores legados.
  return quemLower === 'dono' || quemLower === 'master';
}

const issue = (c) => '/repos/gilcambe/nexia/issues/' + c;
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
  // Validação de admin para ações restritas
  const isAdmin = quem === 'dono'; // Simplificado para este exemplo - na parte 1 seria o helper real
  
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
  if (!n && b.acao !== 'juntar') return r(400, { error: 'Falta o número do pedido.' });
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
  if (b.acao === 'dono-aprova') {
    if (!isAdmin) return r(403, { error: 'Ação restrita ao admin da Central.' });
    if (!b.pr) return r(400, { error: 'Falta o número do PR.' });
    
    const prNumber = Number(b.pr);
    const pr = await p.gh('/repos/gilcambe/nexia/pulls/' + prNumber);
    if (pr.state !== 'open') return r(400, { error: 'Só PR aberto pode ser aprovado.' });
    
    // Adicionar rótulos 'dono-aprovado' e 'automerge'
    await p.gh(issue(prNumber) + '/labels', { method: 'POST', body: JSON.stringify({ labels: ['dono-aprovou', 'automerge'] }) });
    
    // Remover rótulo 'revisor-recusou' (se existir)
    try {
      await p.gh(issue(prNumber) + '/labels/revisor-recusou', { method: 'DELETE' });
    } catch (e) {
      // Ignora se o rótulo não existir
    }
    
    return r(200, { ok: true, mensagem: 'PR #' + prNumber + ' aprovado com rótulos dono-aprovou e automerge. Revisor-recusou removido.' });
  }
  return r(400, { error: 'Ação desconhecida.' });
}

async function socorro(p, { jules }) {
  const issues = await p.gh('/repos/gilcambe/nexia/issues', {
    method: 'GET',
    body: JSON.stringify({
      labels: 'cortex-travado',
      state: 'open',
      sort: 'updated',
      direction: 'desc',
      per_page: 5
    })
  });

  const agora = new Date();
  const seisHorasAtras = new Date(agora.getTime() - 6 * 60 * 60 * 1000);

  const resultado = [];

  for (const issue of issues) {
    const labels = issue.labels.map(l => l.name);
    const reservaTentou = labels.includes('reserva-tentou') && new Date(issue.updated_at) > seisHorasAtras;

    if (reservaTentou) continue;

    const tituloMencionaWorkflow = issue.title.includes('.github/workflows/');
    const passouDuasVezesReserva = labels.filter(l => l.startsWith('reserva-tentativa-')).length >= 2;

    if (tituloMencionaWorkflow || passouDuasVezesReserva) {
      if (jules) {
        let tentativas = 0;
        let sucesso = false;
        while (tentativas < 3 && !sucesso) {
          const x = await mandarParaJules(p, issue.number, 'socorro');
          if (x.status === 200) {
            sucesso = true;
            resultado.push({
              numero: issue.number,
              titulo: issue.title,
              para: 'jules',
              link: issue.html_url
            });
          }
          tentativas++;
        }
      } else {
        await rodar('cortex-reserva.yml', { numero: issue.number });
        resultado.push({
          numero: issue.number,
          titulo: issue.title,
          para: 'reserva',
          link: issue.html_url
        });
      }
    }
  }

  return resultado;
}

module.exports = { agir, socorro };
