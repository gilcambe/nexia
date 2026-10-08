'use strict';

// NEXIA Body Coach — conversa direta entre coach/personal e aluno (como um WhatsApp interno).
// Tudo passa por aqui (login do Firebase + banco no servidor), então não precisa abrir regras do Firestore
// e um aluno nunca lê conversa de outra pessoa. Só texto curto; sem armazenamento pago.
// ações: perfil, vincular, contatos, enviar, ler

const { verifyBearerToken, checkRateLimit, makeHeaders } = require('./middleware');

const resposta = (event, statusCode, body) => ({ statusCode, headers: makeHeaders(event), body: JSON.stringify(body) });
const par = (a, b) => [a, b].sort().join('__');
const limpa = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const codigoNovo = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');

async function executar(body, uid, db) {
  const dir = db.collection('bc_diretorio');
  const eu = (await dir.doc(uid).get()).data?.() || null;
  const acao = body.acao;

  if (acao === 'perfil') {
    const papel = body.papel === 'coach' ? 'coach' : 'aluno';
    const nome = limpa(body.nome, 60) || 'Sem nome';
    const atual = eu || {};
    const novo = { papel: atual.papel || papel, nome, foto: typeof body.foto === 'string' && body.foto.length < 40000 ? body.foto : (atual.foto || ''), coachUid: atual.coachUid || '', codigo: atual.codigo || (papel === 'coach' ? codigoNovo() : '') };
    await dir.doc(uid).set(novo, { merge: true });
    return [200, { perfil: novo }];
  }
  if (!eu) return [409, { error: 'Antes, escolha se você é aluno ou coach.' }];

  if (acao === 'vincular') {
    if (eu.papel !== 'aluno') return [403, { error: 'Só aluno entra pelo código do coach.' }];
    const codigo = limpa(body.codigo, 10).toUpperCase();
    if (codigo.length < 4) return [400, { error: 'Digite o código que o seu coach passou.' }];
    const achados = await dir.where('codigo', '==', codigo).limit(1).get();
    const doc = achados.docs && achados.docs[0];
    if (!doc || doc.data().papel !== 'coach') return [404, { error: 'Não achei esse código. Confira com o seu coach.' }];
    await dir.doc(uid).set({ coachUid: doc.id }, { merge: true });
    return [200, { coach: { uid: doc.id, nome: doc.data().nome, foto: doc.data().foto || '' } }];
  }

  if (acao === 'contatos') {
    if (eu.papel === 'coach') {
      const alunos = await dir.where('coachUid', '==', uid).limit(100).get();
      return [200, { papel: 'coach', codigo: eu.codigo, contatos: alunos.docs.map((d) => ({ uid: d.id, nome: d.data().nome, foto: d.data().foto || '' })) }];
    }
    if (!eu.coachUid) return [200, { papel: 'aluno', contatos: [] }];
    const c = (await dir.doc(eu.coachUid).get()).data?.() || {};
    return [200, { papel: 'aluno', contatos: [{ uid: eu.coachUid, nome: c.nome || 'Seu coach', foto: c.foto || '' }] }];
  }

  // enviar / ler: só entre coach e aluno vinculados
  const outro = limpa(body.com, 128);
  if (!outro) return [400, { error: 'Escolha com quem falar.' }];
  const dOutro = (await dir.doc(outro).get()).data?.() || null;
  const vinculados = dOutro && ((eu.papel === 'aluno' && eu.coachUid === outro && dOutro.papel === 'coach') || (eu.papel === 'coach' && dOutro.coachUid === uid));
  if (!vinculados) return [403, { error: 'Você só conversa com o seu coach ou com os seus alunos.' }];
  const msgs = db.collection('bc_conversas').doc(par(uid, outro)).collection('mensagens');

  if (acao === 'enviar') {
    const texto = limpa(body.texto, 1500);
    if (!texto) return [400, { error: 'Escreva a mensagem.' }];
    const m = { de: uid, texto, em: Date.now() };
    const ref = await msgs.add(m);
    return [200, { mensagem: { id: ref.id, ...m } }];
  }
  if (acao === 'ler') {
    const snap = await msgs.orderBy('em', 'desc').limit(100).get();
    return [200, { mensagens: snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse() }];
  }
  return [400, { error: 'Pedido inválido.' }];
}

exports.executar = executar;

exports.handler = async (event) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: makeHeaders(event), body: '' };
  if (method !== 'POST') return resposta(event, 405, { error: 'Method Not Allowed' });
  const auth = await verifyBearerToken(event);
  if (!auth.ok) return resposta(event, 401, { error: 'Entre na sua conta para conversar.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return resposta(event, 400, { error: 'Pedido inválido.' }); }
  // leituras (a tela confere a cada poucos segundos) não gastam o limite nem a cota do banco grátis
  if (['enviar', 'perfil', 'vincular'].includes(body.acao)) {
    const rl = await checkRateLimit(auth.uid, 'body-coach-chat');
    if (!rl.ok) return resposta(event, 429, { error: 'Muitos pedidos seguidos. Aguarde um instante.' });
  }
  try {
    const { db } = require('./firebase-init');
    if (!db) return resposta(event, 503, { error: 'Conversa indisponível agora.' });
    const [status, out] = await executar(body, auth.uid, db);
    return resposta(event, status, out);
  } catch {
    return resposta(event, 503, { error: 'Conversa indisponível agora. Tente de novo.' });
  }
};
