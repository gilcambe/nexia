// Bateria NO AR do Kernex Finance (API publicada, com as IAs que o Worker usa de verdade, inclusive Workers AI).
// Usuário de TESTE (nunca o do dono) e só prints FALSOS de tests/fixtures/kf-prints.
// Precisa de FIREBASE_SERVICE_ACCOUNT_BASE64 e FIREBASE_API_KEY. Uso: node scripts/kf-bateria-ao-vivo.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const BASE = process.env.FORTUNE_URL || 'https://nexia.gcbezerra.workers.dev';
const DIR = path.join(__dirname, '../tests/fixtures/kf-prints');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const perto = (a, b) => Math.abs(a - b) <= Math.max(0.05, b * 0.01);
const soma = (l) => Math.round((l || []).reduce((s, x) => s + (Number(x.valor) || 0), 0) * 100) / 100;

async function token() {
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, sub: sa.client_email, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: agora, exp: agora + 3600, uid: 'teste-kf-bateria' })}`;
  const custom = `${corpo}.${crypto.createSign('RSA-SHA256').update(corpo).sign(sa.private_key, 'base64url')}`;
  const chave = process.env.FIREBASE_API_KEY || (await (await fetch(`${BASE}/api/firebase-config`)).json()).apiKey;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${chave}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const j = await r.json();
  if (!j.idToken) throw new Error('sem token de teste: ' + (j.error && j.error.message));
  return j.idToken;
}

(async () => {
  const tk = await token();
  const api = async (corpo, ms = 190000) => {
    const t = Date.now();
    const x = await fetch(`${BASE}/api/prumo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(ms) });
    let j = null; const txt = await x.text(); try { j = JSON.parse(txt); } catch { /* texto */ }
    return { status: x.status, ms: Date.now() - t, j, txt };
  };
  const linhas = []; let falhas = 0;
  const marca = (ok, txt) => { if (!ok) falhas++; const l = `${ok ? 'OK   ' : 'FALHA'} ${txt}`; linhas.push(l); console.log(l); };
  const esperado = JSON.parse(fs.readFileSync(path.join(DIR, 'esperado.json'), 'utf8'));
  for (const [nome, e] of Object.entries(esperado)) {
    const img = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(DIR, nome + '.jpg')).toString('base64');
    try {
      if (e.modo === 'carteira') {
        const r = await api({ acao: 'ler_print', imagens: [img] });
        const it = (r.j && r.j.itens) || []; const s = soma(it);
        marca(r.status === 200 && perto(s, e.soma) && it.length >= e.itens, `${nome} (${Math.round(r.ms / 1000)} s): HTTP ${r.status}, itens ${it.length}/${e.itens}, soma ${s} (esperado ${e.soma}) ${it.map((i) => `${i.nome}=${i.valor}`).join('; ') || r.txt.slice(0, 200)}`);
      } else {
        const r = await api({ acao: 'doc_ler', imagens: [img] });
        const pr = (r.j && r.j.prontos) || []; const cf = (r.j && r.j.conferir) || [];
        const todos = [...pr, ...cf.filter((x) => x.tipo)];
        const desp = soma(todos.filter((x) => x.tipo === 'despesa')); const rec = soma(todos.filter((x) => x.tipo === 'receita'));
        const ok = r.status === 200 && (e.despesas == null || perto(desp, e.despesas)) && (e.receitas == null || perto(rec, e.receitas));
        marca(ok, `${nome} (${Math.round(r.ms / 1000)} s): HTTP ${r.status}, doc ${r.j && r.j.documento}, prontos ${pr.length}, conferir ${cf.length}, despesas ${desp} (esperado ${e.despesas})${e.receitas ? `, receitas ${rec} (esperado ${e.receitas})` : ''} ${todos.map((x) => `${x.descricao}=${x.valor}/${x.tipo}/${x.categoria}`).join('; ')}${cf.length ? ' | conferir: ' + cf.map((x) => x.motivo || '').join(', ') : ''}${r.status !== 200 ? ' ' + r.txt.slice(0, 200) : ''}`);
      }
    } catch (err) { marca(false, `${nome}: ERRO ${String(err.message).slice(0, 150)}`); }
  }
  // Robôs de consultoria (o usuário de teste tem poucos dados: vale responder certo e rápido, sem erro).
  const robos = [
    ['saude_financeira', { acao: 'saude_financeira' }, (j) => j && (j.nota != null || (Array.isArray(j.lacunas) && j.lacunas.length > 0))],
    ['posso_comprar', { acao: 'posso_comprar', valor: 500, parcelas: 1 }, (j) => j && JSON.stringify(j).length > 20],
    ['assistente_perguntar', { acao: 'assistente_perguntar', texto: 'Quanto gastei este mês?' }, (j) => j && j.tipo !== 'nao_entendi' && typeof j.resposta === 'string' && j.resposta.length > 5],
    ['avaliar_carteira', { acao: 'avaliar_carteira' }, (j) => j && JSON.stringify(j).length > 20],
    ['consultor (IA)', { acao: 'consultor', mensagem: 'Minha reserva de emergência está boa? Responda curto.' }, (j) => j && JSON.stringify(j).length > 40],
  ];
  for (const [nome, corpo, bom] of robos) {
    try { const r = await api(corpo, 90000); marca(r.status === 200 && bom(r.j), `robô ${nome} (${Math.round(r.ms / 1000)} s): HTTP ${r.status} ${r.txt.slice(0, 260).replace(/\n/g, ' ')}`); } catch (err) { marca(false, `robô ${nome}: ERRO ${String(err.message).slice(0, 150)}`); }
  }
  const resumo = `\n== Kernex Finance NO AR: ${linhas.length - falhas} de ${linhas.length} certos ==`;
  console.log(resumo);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['## Bateria no ar', '', ...linhas.map((l) => '- ' + l), resumo].join('\n') + '\n');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
