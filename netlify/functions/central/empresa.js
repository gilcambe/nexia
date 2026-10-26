'use strict';
// Central NEXIA: a empresa inteira (clientes, contatos interessados, fornecedores e as IAs).
// Só leitura, menos "testarIAs", que manda um "oi" curto para cada IA grátis e mede se respondeu.

const DIA = 864e5;
const temChave = (env, k) => !!(k && String(env[k] || '').trim());

/** Fornecedores e integradores: ligado (tem chave), falta ligar, ou o estado do robô que usa o serviço. */
function fornecedores(lista, env, robos = []) {
  return lista.map((f) => {
    const robo = f.robo ? robos.find((r) => r.arquivo === f.robo) : null;
    let situacao = 'ok';
    if (f.chave && !temChave(env, f.chave)) situacao = 'desligado';
    else if (robo) situacao = robo.situacao === 'erro' ? 'erro' : robo.situacao === 'nunca' ? 'desligado' : 'ok';
    return { id: f.id, nome: f.nome, grupo: f.grupo, paraQue: f.paraQue, gratis: f.gratis, link: f.link, situacao, quando: robo ? robo.quando : null };
  });
}

/** Clientes da NEXIA: empresas com painel (agendas) e personais que usam o Body Coach. */
async function clientes(db, agendas, agora = Date.now(), opts = {}) {
  const empresas = Object.entries(agendas).filter(([, c]) => !c.codigo_sempre)
    .map(([site, c]) => ({ site, nome: c.nome || site, leilao: c.leilao === true }));
  const snap = await db.collection('bc_acesso').where('tipo', '==', 'coach').limit(200).get();
  const personais = snap.docs.map((d) => d.data()).map((x) => {
    const gratisAte = x.gratisAte || 0;
    const diasRestantes = gratisAte > agora ? Math.ceil((gratisAte - agora) / DIA) : 0;
    return {
      email: x.email || '', plano: x.plano || '', faixa: x.faixa || 0,
      situacao: x.isento ? 'isento' : x.pagoAte > agora ? 'pagando' : gratisAte > agora ? 'teste' : 'vencido',
      desde: x.inicio || 0,
      gratisAte,
      diasRestantes,
    };
  }).sort((a, b) => b.desde - a.desde);

  // Pix aguardando confirmação (pedidos pendentes em bc_acesso_pedidos)
  let pixAguardando = [];
  try {
    const pSnap = await db.collection('bc_acesso_pedidos').orderBy('em', 'desc').limit(50).get();
    pixAguardando = pSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((p) => !p.status || p.status === 'pendente')
      .map((p) => ({
        id: p.id,
        uid: p.uid || '',
        email: p.email || '',
        nome: p.nome || '',
        plano: p.plano || 'mensal',
        valor: Number(p.valor) || 0,
        em: p.em || 0,
        dias: p.dias || (p.plano === 'anual' ? 365 : 30),
      }));
  } catch { /* se nao existir collection, segue array vazio */ }

  // Receita do mês (pagamentos confirmados) e uso por cliente
  let receitaMes = 0;
  const mesAtual = new Date(agora - 3 * 3600000).toISOString().slice(0, 7);
  try {
    const pagSnap = await db.collection('bc_acesso_pagamentos').where('mes', '==', mesAtual).limit(500).get();
    receitaMes = pagSnap.docs.reduce((tot, doc) => tot + (Number(doc.data().valor) || 0), 0);
  } catch { /* se falhar, fica 0 */ }

  // Uso de IA do mês por cliente e por provedor
  let usoIa = { porCliente: [], porProvedor: [], frear80: false };
  try {
    const env = opts.env || process.env;
    const cotasModule = opts.cotasModule || require('../../lib/cotas');
    const med = await cotasModule.medir(env, { fetchImpl: opts.fetchImpl }).catch(() => null);
    if (med) {
      const iaItem = med.itens.find((i) => i.id === 'ia');
      const pct = iaItem ? iaItem.pct || 0 : 0;
      usoIa.frear80 = pct >= 80;
      usoIa.porProvedor.push({ provedor: 'Workers AI', usado: iaItem?.usado || 0, limite: iaItem?.limite || 10000, pct });
    }

    // Uso de IA por cliente (leitura de registros em bc_uso_ia se houver)
    const usoSnap = await db.collection('bc_uso_ia').where('mes', '==', mesAtual).limit(100).get().catch(() => null);
    if (usoSnap && !usoSnap.empty) {
      usoIa.porCliente = usoSnap.docs.map((d) => {
        const x = d.data();
        return { email: x.email || d.id, requisicoes: Number(x.requisicoes) || 0, tokens: Number(x.tokens) || 0 };
      });
    }
  } catch { /* fallback gracioso */ }

  return { empresas, personais, pixAguardando, usoIa, receitaMes };
}

/** Contatos interessados (leads) de todos os sites e apps: quantos, de onde e os mais novos. */
async function leads(db, agora = Date.now()) {
  const snap = await db.collection('nexia_leads').orderBy('criado_em', 'desc').limit(150).get();
  const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const conta = (f) => todos.reduce((o, l) => { const k = f(l) || 'outro'; o[k] = (o[k] || 0) + 1; return o; }, {});
  const semana = new Date(agora - 7 * DIA).toISOString();
  return {
    total: todos.length,
    semana: todos.filter((l) => l.criado_em >= semana).length,
    novos: todos.filter((l) => l.status === 'novo').length,
    porStatus: conta((l) => l.status),
    porProduto: conta((l) => l.produto),
    porOrigem: conta((l) => (l.utm && l.utm.source) || l.site),
    ultimos: todos.slice(0, 10).map((l) => ({ id: l.id, nome: l.nome || '', produto: l.produto || '', status: l.status || 'novo',
      whatsapp: l.whatsapp || '', email: l.email || '', quando: l.criado_em || '', origem: (l.utm && l.utm.source) || l.site || '', ...(l.indicadoPor ? { indicadoPor: l.indicadoPor } : {}) })),
  };
}

/** Testa cada IA grátis com um pedido mínimo (1 por provedor, em paralelo, 10 s no máximo). */
async function testarIAs(router, candidatos) {
  const um = new Map();
  for (const d of candidatos) if (!um.has(d.provider)) um.set(d.provider, d);
  return Promise.all([...um.values()].map(async (d) => {
    let disponivel = false;
    try { disponivel = router.capabilities(d).available !== false; } catch { /* provedor desconhecido */ }
    if (!disponivel) return { provedor: d.provider, modelo: d.model, situacao: 'desligado' };
    const t0 = Date.now();
    let timer;
    try {
      await Promise.race([
        router.chat(d, { messages: [{ role: 'user', content: 'Responda só: ok' }], max_tokens: 5 }),
        new Promise((_, n) => { timer = setTimeout(() => n(new Error('demorou mais de 10 s')), 10000); }),
      ]);
      return { provedor: d.provider, modelo: d.model, situacao: 'ok', tempo: Date.now() - t0 };
    } catch (e) {
      return { provedor: d.provider, modelo: d.model, situacao: 'erro', tempo: Date.now() - t0, motivo: String(e.message || e).replace(/(key|token)=\S+/gi, '$1=***').slice(0, 120) };
    } finally { clearTimeout(timer); }
  }));
}

module.exports = { fornecedores, clientes, leads, testarIAs };
