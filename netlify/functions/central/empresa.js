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
async function clientes(db, agendas, agora = Date.now()) {
  const empresas = Object.entries(agendas).filter(([, c]) => !c.codigo_sempre)
    .map(([site, c]) => ({ site, nome: c.nome || site, leilao: c.leilao === true }));
  const snap = await db.collection('bc_acesso').where('tipo', '==', 'coach').limit(200).get();
  const personais = snap.docs.map((d) => d.data()).map((x) => ({
    email: x.email || '', plano: x.plano || '', faixa: x.faixa || 0,
    situacao: x.isento ? 'isento' : x.pagoAte > agora ? 'pagando' : x.gratisAte > agora ? 'teste' : 'vencido',
    desde: x.inicio || 0,
  })).sort((a, b) => b.desde - a.desde);
  return { empresas, personais };
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
      whatsapp: l.whatsapp || '', email: l.email || '', quando: l.criado_em || '', origem: (l.utm && l.utm.source) || l.site || '' })),
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
