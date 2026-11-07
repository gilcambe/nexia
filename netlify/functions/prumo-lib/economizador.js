'use strict';
/**
 * Kernex Finance, fase 10: economizador e renda extra.
 * Aponta onde REVISAR (assinaturas, cobranças repetidas, tarifas, delivery acima da média); nunca acusa nem promete economia.
 * Oportunidades de renda: catálogo fixo filtrado pelo perfil; NUNCA promete ganho (ganho "varia e pode ser zero").
 */
const { recorrencias, cobrancasSuspeitas, somarMes } = require('./cartoes');

const AVISO_RENDA = 'Não prometo renda: os ganhos variam, podem ser zero e dependem de você e do mercado. Veja os custos e riscos antes de começar.';
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cent = (v) => Math.round(Number(v) * 100);
const reais = (c) => c / 100;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')));

const RE_TARIFA = /tarifa|anuidade|\biof\b|multa|\bmora\b|juros|encargo|taxa de manuten|pacote de servi|cesta de servi/;
const RE_DELIVERY = /ifood|rappi|99 ?food|uber ?eats|delivery|aiqfome/;

function tarifas(lancs, mes) {
  const itens = (lancs || []).filter((l) => l.tipo === 'despesa' && String(l.data).startsWith(mes) && RE_TARIFA.test(sem(`${l.descricao} ${l.estabelecimento || ''}`)));
  const total = itens.reduce((s, l) => s + cent(l.valor), 0);
  return { total: reais(total), itens: itens.slice(0, 20).map((l) => ({ descricao: l.descricao, data: l.data, valor: l.valor })) };
}

/** Delivery do mês contra a média dos meses anteriores (até 3) que tiveram delivery. Sem histórico, não compara. */
function delivery(lancs, mes) {
  const soma = (m) => (lancs || []).filter((l) => l.tipo === 'despesa' && String(l.data).startsWith(m) && RE_DELIVERY.test(sem(`${l.descricao} ${l.estabelecimento || ''}`))).reduce((s, l) => s + cent(l.valor), 0);
  const atual = soma(mes);
  const antes = [1, 2, 3].map((i) => soma(somarMes(mes, -i))).filter((v) => v > 0);
  if (!antes.length) return { atual: reais(atual), media: null, acima: null, lacuna: atual > 0 ? 'Ainda não há meses anteriores com delivery para comparar.' : null };
  const media = Math.round(antes.reduce((s, v) => s + v, 0) / antes.length);
  return { atual: reais(atual), media: reais(media), meses_base: antes.length, acima: atual > media * 1.3, diferenca: reais(atual - media) };
}

function visao(lancs, mes) {
  const recorrentes = recorrencias(lancs);
  const assin = recorrentes.map((r) => ({ ...r, por_ano: reais(cent(r.valor_medio) * 12) }));
  const suspeitas = cobrancasSuspeitas(lancs).filter((s) => s.motivo.startsWith('cobrança repetida'));
  const t = tarifas(lancs, mes); const d = delivery(lancs, mes);
  const lacunas = [];
  if (!(lancs || []).length) lacunas.push('Sem documentos lidos ainda: não há o que analisar. Envie extratos e faturas.');
  else if (!assin.length) lacunas.push('Ainda não vi nenhuma cobrança que se repete em 3 meses ou mais.');
  const dicas = [];
  if (assin.length) dicas.push(`Você tem ${assin.length} cobrança(s) recorrente(s) somando ${reais(assin.reduce((s, a) => s + cent(a.valor_medio), 0)).toFixed(2).replace('.', ',')} por mês: veja se ainda usa todas.`);
  if (suspeitas.length) dicas.push(`${suspeitas.length} cobrança(s) repetida(s) em até 1 dia: confira se foi duplicada.`);
  if (t.total > 0) dicas.push('Há tarifas, juros ou anuidade no mês: vale perguntar ao banco se dá para isentar ou reduzir.');
  if (d.acima) dicas.push('Delivery está acima da sua média dos meses anteriores.');
  return { mes, assinaturas: assin, cobrancas_repetidas: suspeitas.map((s) => ({ descricao: s.lancamento.descricao, data: s.lancamento.data, valor: s.lancamento.valor })), tarifas: t, delivery: d, dicas, lacunas, aviso: 'São pontos para você REVISAR, não acusações. Não garanto economia.' };
}

const CATALOGO = [
  { id: 'vender_usados', nome: 'Vender itens parados em casa', habilidades: [], horas_min: 2, capital_min: 0, investimento: 'nenhum ou quase nenhum', tempo: 'dias a semanas', risco: 'baixo' },
  { id: 'aulas', nome: 'Aulas particulares ou reforço', habilidades: ['ensino', 'idiomas', 'matematica', 'musica'], horas_min: 4, capital_min: 0, investimento: 'baixo (material)', tempo: 'semanas', risco: 'baixo' },
  { id: 'freelancer', nome: 'Freelancer (design, texto, programação, tradução)', habilidades: ['design', 'redacao', 'programacao', 'traducao', 'video'], horas_min: 5, capital_min: 0, investimento: 'baixo (computador que você já tem)', tempo: 'semanas a meses', risco: 'médio' },
  { id: 'servicos_casa', nome: 'Pequenos serviços e reparos', habilidades: ['reparos', 'eletrica', 'pintura', 'limpeza', 'jardinagem'], horas_min: 4, capital_min: 200, investimento: 'ferramentas básicas', tempo: 'semanas', risco: 'médio' },
  { id: 'pets_criancas', nome: 'Cuidar de pets ou crianças', habilidades: ['pets', 'criancas'], horas_min: 4, capital_min: 0, investimento: 'baixo', tempo: 'semanas', risco: 'médio' },
  { id: 'artesanato_comida', nome: 'Vender comida ou artesanato', habilidades: ['culinaria', 'artesanato', 'costura'], horas_min: 6, capital_min: 300, investimento: 'ingredientes e embalagens', tempo: 'semanas', risco: 'médio' },
  { id: 'entregas', nome: 'Entregas por aplicativo', habilidades: ['moto', 'bike', 'carro'], horas_min: 10, capital_min: 0, investimento: 'veículo que você já tem (combustível e manutenção)', tempo: 'dias', risco: 'médio' },
  { id: 'organizacao', nome: 'Organização de casa ou finanças de outras pessoas', habilidades: ['organizacao', 'financas'], horas_min: 3, capital_min: 0, investimento: 'baixo', tempo: 'semanas', risco: 'baixo' },
];

function oportunidades(perfil) {
  const hab = (perfil.habilidades || []).map(sem);
  const lista = CATALOGO.filter((o) => perfil.horas_semana >= o.horas_min && perfil.capital >= o.capital_min)
    .map((o) => ({ ...o, combina: o.habilidades.length ? o.habilidades.filter((h) => hab.includes(h)) : [], ganho: 'varia e pode ser zero; sem promessa' }))
    .filter((o) => !o.habilidades.length || o.combina.length)
    .sort((a, b) => b.combina.length - a.combina.length);
  return lista.map(({ habilidades, ...o }) => o);
}

function validarPerfil(o) {
  const horas = numero(o && o.horas_semana); const capital = numero(o && o.capital);
  if (!Number.isFinite(horas) || horas < 0 || horas > 80) return { ok: false, erro: 'As horas livres por semana vão de 0 a 80.' };
  if (!Number.isFinite(capital) || capital < 0 || capital > 1e7) return { ok: false, erro: 'O capital disponível precisa ser zero ou mais.' };
  const habilidades = (Array.isArray(o.habilidades) ? o.habilidades : String(o.habilidades || '').split(',')).map((h) => texto(h, 30)).filter(Boolean).slice(0, 15);
  return { ok: true, item: { habilidades, horas_semana: horas, capital: Math.round(capital * 100) / 100 } };
}

async function agirEconomizador(acao, body, c) {
  if (!['econ_visao', 'econ_perfil_salvar', 'econ_oportunidades'].includes(acao)) return null;
  const { base, listar, agoraIso } = c;
  switch (acao) {
    case 'econ_visao': return [200, visao(await listar(base.collection('lancamentos')), agoraIso.slice(0, 7))];
    case 'econ_perfil_salvar': {
      const v = validarPerfil(body);
      if (!v.ok) return [400, { error: v.erro }];
      await base.collection('config').doc('perfil_renda').set({ ...v.item, atualizado_em: agoraIso });
      return [200, { ok: true, perfil: v.item }];
    }
    case 'econ_oportunidades': {
      const s = await base.collection('config').doc('perfil_renda').get();
      if (!s || !s.exists) return [200, { perfil: null, oportunidades: [], lacuna: 'Conte suas habilidades, horas livres e capital para eu sugerir ideias.', aviso: AVISO_RENDA }];
      return [200, { perfil: s.data(), oportunidades: oportunidades(s.data()), aviso: AVISO_RENDA }];
    }
    default: return null;
  }
}

module.exports = { agirEconomizador, visao, delivery, tarifas, oportunidades, validarPerfil, AVISO_RENDA };
