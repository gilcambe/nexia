'use strict';
// #833 (Melhoria C15): aviso de conclusão e resumo diário do Cortex, grátis.
// - Push no celular: Web Push do próprio servidor (mesmas chaves VAPID e criptografia do Body Coach, em
//   ../body-coach/push.js). O app Cortex assina em Configurações; a assinatura fica em cortex_push/dono.
// - E-mail (opcional): Brevo grátis (300/dia) com BREVO_API_KEY e LEADS_NOTIFY_EMAIL; sem as chaves, só push.
// - Quem avisa é a fila (scripts/cortex-fila.js): tarefa feita ou travada = 1 linha; resumo às 8h (Brasília).
// Nada aqui pode derrubar a fila nem o app: todo erro vira "não avisou".
const push = require('../body-coach/push');

const DOC = ['cortex_push', 'dono'];
const ref = (db) => db.collection(DOC[0]).doc(DOC[1]);
const lerDoc = async (db) => ((await ref(db).get()).data?.()) || {};

const ENDPOINT_OK = (e) => { try { return new URL(e).protocol === 'https:'; } catch { return false; } };

/** Ações do app (só o dono): chave pública, assinar, cancelar e testar. Devolve [status, corpo] ou null. */
async function acoesAvisos(body, db) {
  const acao = body && body.acao;
  if (acao === 'avisos_chave') return [200, { chave: (await push.chavesVapid(db)).publica }];
  if (acao === 'avisos_ver') { const d = await lerDoc(db); return [200, { aparelhos: Array.isArray(d.subs) ? d.subs.length : 0 }]; }
  if (acao === 'avisos_assinar') {
    const s = body.sub || {};
    const sub = { endpoint: typeof s.endpoint === 'string' ? s.endpoint.slice(0, 800) : '', p256dh: String((s.keys && s.keys.p256dh) || '').slice(0, 200), auth: String((s.keys && s.keys.auth) || '').slice(0, 60), em: Date.now() };
    if (!ENDPOINT_OK(sub.endpoint) || push.deB64u(sub.p256dh).length !== 65 || push.deB64u(sub.auth).length < 16) return [400, { error: 'Este aparelho não aceitou os avisos.' }];
    const d = await lerDoc(db);
    const subs = [...(Array.isArray(d.subs) ? d.subs : []).filter((x) => x.endpoint !== sub.endpoint), sub].slice(-5);
    await ref(db).set({ subs, em: Date.now() }, { merge: true });
    return [200, { aparelhos: subs.length }];
  }
  if (acao === 'avisos_cancelar') {
    const d = await lerDoc(db);
    const subs = (Array.isArray(d.subs) ? d.subs : []).filter((x) => x.endpoint !== body.endpoint);
    await ref(db).set({ subs }, { merge: true });
    return [200, { aparelhos: subs.length }];
  }
  if (acao === 'avisos_testar') {
    const n = await avisarPush(db, { titulo: 'Cortex', corpo: 'Pronto! Os avisos do Cortex chegam neste celular.', tag: 'teste' });
    return n ? [200, { enviados: n }] : [409, { error: 'Não consegui avisar este celular. Ative os avisos de novo.' }];
  }
  return null;
}

/** Push para todos os aparelhos do dono; tira os que o navegador já descartou. Devolve quantos receberam. */
async function avisarPush(db, conteudo, enviar = push.enviarUm) {
  const d = await lerDoc(db);
  if (!Array.isArray(d.subs) || !d.subs.length) return 0;
  const msg = { url: '/cortex', ...conteudo };
  const status = await Promise.all(d.subs.map((s) => enviar(db, s, msg).catch(() => 0)));
  const vivas = d.subs.filter((_, i) => status[i] !== 404 && status[i] !== 410);
  if (vivas.length !== d.subs.length) await ref(db).set({ subs: vivas }, { merge: true });
  return status.filter((s) => s >= 200 && s < 300).length;
}

/** E-mail grátis pelo Brevo (opcional). */
async function avisarEmail(assunto, texto, env = process.env, fetchImpl = fetch) {
  const key = env.BREVO_API_KEY, to = env.CORTEX_AVISO_EMAIL || env.LEADS_NOTIFY_EMAIL;
  if (!key || !to) return false;
  try {
    const r = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { name: 'Cortex', email: to }, to: [{ email: to }], subject: String(assunto).slice(0, 150), textContent: String(texto).slice(0, 5000) }),
    });
    return !!(r && r.ok);
  } catch { return false; }
}

/** Uma linha por evento da fila. */
function linhaEvento(tipo, n, titulo) {
  const t = String(titulo || '').replace(/^\[Parte \d+\/\d+ de #\d+\]\s*/, '').slice(0, 90);
  if (tipo === 'feito') return { titulo: '✅ Cortex terminou', corpo: `#${n} ${t}`, tag: `cx-${n}` };
  if (tipo === 'travado') return { titulo: '🛑 Cortex travou', corpo: `#${n} ${t}: precisa de você`, tag: `cx-${n}`, urgente: true };
  return { titulo: 'Cortex', corpo: `#${n} ${t}`, tag: `cx-${n}` };
}

/** Resumo das 8h: o que ficou pronto nas últimas 24 h, o que travou e o que está na fila. */
function textoResumo({ feitas = [], travadas = [], naFila = 0, planos = [] }) {
  const nomes = (l) => l.slice(0, 5).map((i) => `#${i.number}`).join(', ');
  let texto = `Ontem: ${feitas.length} feita(s)${feitas.length ? ` (${nomes(feitas)})` : ''}. Travadas: ${travadas.length}${travadas.length ? ` (${nomes(travadas)})` : ''}. Na fila: ${naFila}.`;
  
  if (planos.length > 0) {
    texto += `\nPedidos grandes: ${planos.length} concluídos em partes`;
  }
  
  return texto;
}

/** Hora do resumo (8h de Brasília, UTC-3) e ainda não mandado hoje? */
function horaDoResumo(agora, ultimoDia) {
  const br = new Date(agora - 3 * 3600e3);
  const dia = br.toISOString().slice(0, 10);
  return { mandar: br.getUTCHours() === 8 && ultimoDia !== dia, dia };
}

module.exports = { acoesAvisos, avisarPush, avisarEmail, linhaEvento, textoResumo, horaDoResumo, lerDoc, ref, DOC };
