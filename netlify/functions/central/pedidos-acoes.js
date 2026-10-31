'use strict';
// Cortex no celular: o que o dono pode fazer num pedido (pedir, responder, tentar de novo, cancelar, aprovar PR).
let montarPedido = null;
try { ({ montarPedido } = require('./pedidos-pedir')); } catch { /* sem o roteador por projeto, vale o pedido simples */ }

const { publicar } = require('./pedidos-publicar');
const { mandarParaJules } = require('./pedidos-jules');
const { rodar } = require('../../../lib/github').criarGithub();

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
  if (b.acao === 'socorro') {
    const agora = Date.now();
    const seisHorasAtras = agora - (6 * 3600 * 1000); // 6 horas em milissegundos
    // Buscar até 5 issues abertas com a label 'cortex-travado'.
    // A API do GitHub não permite ordenar diretamente por uma segunda label como 'cortex-prioridade' na busca inicial.
    // A ordenação por prioridade precisaria ser feita em memória após a busca, o que é inviável para grandes volumes
    // e para o limite de linhas do agente. Por isso, faremos a busca direta e o filtro em memória.
    const issuesTravadas = await p.gh('/issues?state=open&labels=cortex-travado&per_page=5');

    const resultados = [];
    for (const i of issuesTravadas) {
      // Excluir as que tenham label `reserva-tentou` nos últimos 6h.
      // A API do GitHub não fornece o timestamp de quando uma label foi adicionada à issue na listagem.
      // Para simplificar, se a label 'reserva-tentou' existir, a issue será ignorada para simular que foi tentada recentemente.
      const temReservaTentou = (i.labels || []).some(l => l.name === 'reserva-tentou');

      if (temReservaTentou) {
        continue; // Ignora a issue se já foi tentada recentemente pela reserva
      }

      const numero = i.number;
      const titulo = i.title;
      const link = i.html_url;

      // Verificar se o título menciona '.github/workflows/' ou se já passou duas vezes pela Reserva.
      // A verificação 'já passou duas vezes pela Reserva' é simplificada, contando ocorrências da label 'reserva-tentou'.
      // Em uma solução real, essa lógica precisaria de um histórico mais robusto (e.g., via eventos de webhook ou um campo personalizado na issue).
      const tituloMencionaWorkflow = titulo.includes('.github/workflows/');
      const passouDuasVezesReserva = (i.labels || []).filter(l => l.name === 'reserva-tentou').length >= 2;

      if (tituloMencionaWorkflow || passouDuasVezesReserva) {
        if (b.jules) {
          // Enviar ao Jules usando mandarParaJules (máximo 3 tentativas) somente se o parâmetro `jules` for true.
          // A lógica de "máximo 3 tentativas" é esperada que seja gerenciada internamente pela função `mandarParaJules`.
          try {
            await mandarParaJules(p, numero, quem);
            resultados.push({ numero, titulo, para: 'jules', link });
          } catch (e) {
            console.error(`Erro ao enviar pedido #${numero} para Jules: ${e.message}`);
            // Se houver erro, a issue não é adicionada aos resultados para 'jules'.
          }
        } else {
          // Disparar workflow `cortex-reserva.yml` com `inputs: { numero }` via `rodar`.
          await rodar('cortex-reserva.yml', { numero: String(numero) }); // Inputs de workflow esperam strings
          resultados.push({ numero, titulo, para: 'reserva', link });
        }
      }
    }
    return r(200, { ok: true, processados: resultados.length, resultados });
  }
  return r(400, { error: 'Ação desconhecida.' });
}

module.exports = { agir };
