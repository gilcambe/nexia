'use strict';
// Kernex Finance: leitor de documentos, lançamentos, contas, dívidas, painel e ferramentas.
// Toda conta sai do motor determinístico (motor.js). A IA só lê e classifica documentos.
// Dados em prumo_users/{uid}/{colecao}/{id}; nunca escreve valores da pessoa em log.
const crypto = require('crypto');
const motor = require('./motor');

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;
const TIPOS_LANC = ['despesa', 'receita', 'transferencia_propria', 'pagamento_fatura'];
const TIPOS_CONTA = ['corrente', 'poupanca', 'digital', 'carteira', 'dinheiro', 'internacional'];
const SUBCATEGORIAS_PADRAO = ['moradia', 'alimentacao', 'transporte', 'saude', 'educacao', 'familia', 'lazer', 'compras', 'assinaturas', 'financeiro', 'impostos', 'investimentos', 'outros'];
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const erro = (m) => ({ ok: false, erro: m });
const dinheiro = (n) => Math.round(n * 100) / 100;
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) : NaN);
const somarMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

const LER_DOC = `Você lê documentos financeiros brasileiros (fatura de cartão, extrato bancário, comprovante Pix, nota fiscal, cupom, boleto, comprovante de pagamento, extrato de corretora ou de milhas). Devolva SOMENTE um JSON:
{"documento":"fatura|extrato|pix|nota|boleto|corretora|milhas|outro","instituicao":"","conta_ou_cartao":"","total_documento":número ou null,
"lancamentos":[{"data":"AAAA-MM-DD","data_processamento":"AAAA-MM-DD ou null","descricao":"","estabelecimento":"","valor":0,"moeda":"BRL","categoria":"","subcategoria":"","parcela":null,"parcelas_total":null,"vencimento":"AAAA-MM-DD ou null","tipo":"despesa|receita|transferencia_propria|pagamento_fatura","confianca":0.0}]}
Regras: um lançamento para CADA linha com valor; valor sempre positivo (o tipo diz se entra ou sai); pagamento da fatura do próprio cartão e transferência entre contas do próprio dono NÃO são despesa nem receita (use os tipos próprios); parcela "3/10" vira parcela 3 e parcelas_total 10; confianca de 0 a 1 conforme a nitidez da leitura; números com ponto decimal (R$ 1.234,56 vira 1234.56); não copie CPF, número de cartão completo nem senhas; não invente o que não está legível.`;

function dataLida(v) {
  const t = String(v == null ? '' : v).trim();
  if (DATA.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (!m) return '';
  return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Valida um lançamento (vindo da IA ou do usuário). Dado incompleto volta com motivo, nunca vira dado confirmado. */
function validarLancamento(o, documento) {
  if (!o || typeof o !== 'object') return erro('Lançamento vazio.');
  const valorBruto = numero(o.valor);
  if (!Number.isFinite(valorBruto) || valorBruto === 0) return erro('Valor ilegível.');
  const data = dataLida(o.data);
  if (!data) return erro('Data ilegível.');
  const tipo = TIPOS_LANC.includes(o.tipo) ? o.tipo : (valorBruto < 0 ? 'despesa' : 'despesa');
  const parcela = Number.isInteger(Number(o.parcela)) && Number(o.parcela) >= 1 ? Number(o.parcela) : null;
  const parcelasTotal = Number.isInteger(Number(o.parcelas_total)) && Number(o.parcelas_total) >= 1 ? Number(o.parcelas_total) : null;
  const conf = Number(o.confianca);
  const venc = dataLida(o.vencimento);
  const proc = dataLida(o.data_processamento);
  const cat = texto(o.categoria, 40).toLowerCase();
  const item = {
    data, data_processamento: proc || null,
    descricao: texto(o.descricao, 160) || texto(o.estabelecimento, 160) || 'Sem descrição',
    estabelecimento: texto(o.estabelecimento, 120) || null,
    valor: dinheiro(Math.abs(valorBruto)), moeda: texto(o.moeda, 3).toUpperCase() || 'BRL',
    categoria: SUBCATEGORIAS_PADRAO.includes(cat) ? cat : 'outros', subcategoria: texto(o.subcategoria, 60) || null,
    instituicao: texto(o.instituicao, 80) || null, conta_ou_cartao: texto(o.conta_ou_cartao, 80) || null,
    parcela, parcelas_total: parcelasTotal, vencimento: venc || null, tipo,
    documento: texto(documento || o.documento, 60) || null,
    confianca: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 1,
  };
  return { ok: true, item };
}
const idLancamento = (l) => crypto.createHash('sha1').update(motor.chave(l)).digest('hex').slice(0, 20);

/** Pergunta à primeira IA grátis com visão que responder. Devolve o JSON lido ou null. */
async function lerDocumento(imagens, deps, extrairJson, visao) {
  const router = deps.getRouter();
  const vistos = new Set();
  const lista = [...(visao || []), ...deps.listFor('fast')].filter((d) => d.provider !== 'anthropic' && !vistos.has(d.provider + d.model) && vistos.add(d.provider + d.model));
  const inicio = Date.now();
  const um = async (img) => {
    let tentou = 0;
    for (const d of lista) {
      try {
        const cap = router.capabilities(d);
        if (!cap.available || !cap.vision) continue;
        const resta = 150000 - (Date.now() - inicio);
        if (resta < 5000) break;
        const ms = Math.min(tentou++ === 0 ? 90000 : 30000, resta);
        let relogio;
        const out = await Promise.race([router.chat(d, { system: LER_DOC, messages: [{ role: 'user', content: 'Leia este documento e devolva o JSON.' }], images: [img], maxTokens: 8192, temperature: 0, timeoutMs: ms }), new Promise((_, rej) => { relogio = setTimeout(() => rej(new Error('timeout')), ms + 3000); })]).finally(() => clearTimeout(relogio));
        const j = extrairJson(out && out.text);
        if (j && Array.isArray(j.lancamentos)) return j;
      } catch { /* tenta o próximo modelo grátis */ }
    }
    return null;
  };
  return Promise.all(imagens.map(um));
}

function validarConta(o) {
  const nome = texto(o && o.nome, 60);
  if (!nome) return erro('Dê um nome para a conta.');
  const tipo = TIPOS_CONTA.includes(o.tipo) ? o.tipo : 'corrente';
  const saldo = numero(o.saldo ?? 0);
  if (!Number.isFinite(saldo)) return erro('O saldo precisa ser um número.');
  return { ok: true, item: { nome, tipo, instituicao: texto(o.instituicao, 80) || null, saldo: dinheiro(saldo), pessoa_juridica: o.pessoa_juridica === true } };
}
function validarDivida(o) {
  const nome = texto(o && o.nome, 80);
  if (!nome) return erro('Dê um nome para a dívida.');
  const saldo = numero(o.saldo);
  if (!Number.isFinite(saldo) || saldo < 0) return erro('O saldo devedor precisa ser zero ou mais.');
  const juros = numero(o.juros_mes ?? 0);
  if (!Number.isFinite(juros) || juros < 0 || juros > 30) return erro('Os juros ao mês vão de 0 a 30%.');
  const minima = numero(o.parcela_minima ?? 0);
  if (!Number.isFinite(minima) || minima < 0) return erro('A parcela mínima precisa ser zero ou mais.');
  const venc = texto(o.vencimento, 10);
  if (venc && !DATA.test(venc)) return erro('O vencimento precisa estar no formato AAAA-MM-DD.');
  return { ok: true, item: { nome, credor: texto(o.credor, 80) || null, saldo: dinheiro(saldo), juros_mes: Math.round(juros * 100) / 100, parcela_minima: dinheiro(minima), vencimento: venc || null } };
}

const ehMes = (l, mes) => String(l.data).slice(0, 7) === mes;
/** Receitas e despesas do mês a partir dos lançamentos confirmados (a conciliação já tirou transferências e faturas). */
function resumoLancamentos(lancs, mes) {
  const r = motor.conciliar((lancs || []).filter((l) => ehMes(l, mes)).map((l) => ({ ...l, confianca: 1 })));
  const por_categoria = {};
  for (const l of r.confirmados) if (l.tipo === 'despesa') por_categoria[l.categoria] = dinheiro((por_categoria[l.categoria] || 0) + l.valor);
  return { receitas: r.receitas, despesas: r.despesas, saldo: r.saldo, por_categoria };
}

async function agirKf(acao, body, c) {
  const { base, listar, salvar, apagar, deps, agoraIso } = c;
  const mesAtual = agoraIso.slice(0, 7);
  const diasAte = (iso) => Math.round((Date.parse(iso) - Date.parse(agoraIso.slice(0, 10))) / 86400000);
  switch (acao) {
    case 'doc_enviar': {
      const im = c.lerImagens(body.imagens);
      if (!im.ok) return [400, { error: im.erro }];
      const lidos = await lerDocumento(im.imagens, deps, c.extrairJson, c.visao);
      if (!lidos.some(Boolean)) return [503, { error: 'Não consegui ler agora. Tente de novo com uma foto mais nítida.' }];
      const existentes = await listar(base.collection('lancamentos'));
      const candidatos = []; const invalidos = [];
      lidos.forEach((lido, n) => {
        if (!lido) { invalidos.push({ motivo: `Documento ${n + 1}: não consegui ler.` }); return; }
        const doc = `${texto(lido.documento, 20) || 'documento'}-${n + 1}`;
        for (const bruto of lido.lancamentos) {
          const v = validarLancamento({ ...bruto, instituicao: bruto && bruto.instituicao || lido.instituicao, conta_ou_cartao: bruto && bruto.conta_ou_cartao || lido.conta_ou_cartao }, doc);
          if (v.ok) candidatos.push(v.item); else invalidos.push({ ...bruto, motivo: v.erro });
        }
      });
      // Duplicidade contra o que já foi salvo antes: primeiro as existentes, depois as novas.
      const r = motor.conciliar([...existentes.map((e) => ({ ...e, confianca: 1, documento: 'já salvo' })), ...candidatos]);
      const novos = r.confirmados.filter((l) => l.documento !== 'já salvo');
      const conferir = r.conferir.filter((l) => l.documento !== 'já salvo').concat(invalidos);
      const somaLida = lidos.filter(Boolean).reduce((t, l) => t + (Number.isFinite(numero(l.total_documento)) ? numero(l.total_documento) : 0), 0);
      const somaNovos = dinheiro(novos.filter((l) => l.tipo === 'despesa').reduce((t, l) => t + l.valor, 0));
      return [200, { novos, conferir, total_documento: somaLida || null, soma_despesas_lidas: somaNovos, aviso: 'Confira os lançamentos antes de salvar. Nada foi gravado ainda.' }];
    }
    case 'lanc_salvar_lote': {
      const itens = Array.isArray(body.itens) ? body.itens.slice(0, 500) : [];
      if (!itens.length) return [400, { error: 'Nenhum lançamento para salvar.' }];
      const existentes = await listar(base.collection('lancamentos'));
      const r = motor.conciliar([...existentes.map((e) => ({ ...e, confianca: 1 })), ...itens.map((i) => { const v = validarLancamento(i); return v.ok ? { ...v.item, confianca: 1, documento: v.item.documento || 'confirmado' } : { ...i, valor: NaN }; })]);
      const novos = r.confirmados.filter((l) => !existentes.some((e) => motor.chave(e) === motor.chave(l)));
      for (const l of novos) await base.collection('lancamentos').doc(idLancamento(l)).set({ ...l, confirmado_em: agoraIso });
      return [200, { ok: true, salvos: novos.length, ignorados: itens.length - novos.length }];
    }
    case 'lanc_listar': {
      const mes = texto(body.mes, 7) || mesAtual;
      if (!MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      const todos = await listar(base.collection('lancamentos'));
      const doMes = todos.filter((l) => ehMes(l, mes)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
      return [200, { mes, lancamentos: doMes, ...resumoLancamentos(todos, mes) }];
    }
    case 'lanc_apagar': return apagar('lancamentos');
    case 'conta_salvar': return salvar('contas', validarConta(body));
    case 'conta_listar': return [200, { contas: await listar(base.collection('contas')) }];
    case 'conta_apagar': return apagar('contas');
    case 'divida_salvar': return salvar('dividas', validarDivida(body));
    case 'divida_listar': return [200, { dividas: (await listar(base.collection('dividas'))).sort((a, b) => b.juros_mes - a.juros_mes) }];
    case 'divida_apagar': return apagar('dividas');
    case 'divida_estrategia': {
      const extra = numero(body.extra ?? 0);
      if (!Number.isFinite(extra) || extra < 0) return [400, { error: 'O valor extra precisa ser zero ou mais.' }];
      const dividas = await listar(base.collection('dividas'));
      const av = motor.estrategiaDividas(dividas, extra, 'avalanche');
      const bn = motor.estrategiaDividas(dividas, extra, 'bola_de_neve');
      const melhor = av.viavel && bn.viavel ? (av.jurosPagos <= bn.jurosPagos ? 'avalanche' : 'bola_de_neve') : null;
      return [200, { avalanche: av, bola_de_neve: bn, melhor, economia: melhor ? dinheiro(Math.abs(av.jurosPagos - bn.jurosPagos)) : null, aviso: 'Quitar mais rápido reduz juros, mas deixa menos dinheiro disponível. Mantenha uma reserva.' }];
    }
    case 'painel': return [200, await montarPainel(c, mesAtual, diasAte)];
    case 'posso_comprar': {
      const valor = numero(body.valor); const parcelas = Math.max(1, Math.min(48, Math.floor(Number(body.parcelas) || 1)));
      if (!Number.isFinite(valor) || valor <= 0) return [400, { error: 'Diga o valor da compra.' }];
      const p = await montarPainel(c, mesAtual, diasAte);
      const imp = motor.impactoCompra({ valor, parcelas, sobraMensal: p.sobra_mes, reserva: p.reserva, despesaMensal: p.despesa_mensal_base });
      return [200, { ...imp, base: { sobra_mes: p.sobra_mes, reserva: p.reserva, despesa_mensal: p.despesa_mensal_base }, aviso: 'Cálculo com os dados que você já informou. Se faltar dado, o resultado fica incompleto.' }];
    }
    case 'futuro_simular': {
      const meses = Math.floor(Number(body.meses));
      if (!Number.isInteger(meses) || meses < 1 || meses > 720) return [400, { error: 'O prazo vai de 1 a 720 meses.' }];
      const n = (v, d) => { const x = numero(v ?? d); return Number.isFinite(x) ? x : NaN; };
      const inicial = n(body.inicial, 0); const aporte = n(body.aporte, 0); const taxa = n(body.taxa_anual, 10); const infl = n(body.inflacao_anual, 4.5); const meta = body.meta === undefined || body.meta === '' ? null : n(body.meta);
      if ([inicial, aporte, taxa, infl].some((x) => !Number.isFinite(x) || x < 0)) return [400, { error: 'Use números iguais ou maiores que zero.' }];
      const proj = motor.projecao({ inicial, aporte, meses, taxaAnual: taxa, inflacaoAnual: infl });
      return [200, { ...proj, aporte_necessario: meta ? motor.aporteNecessario({ meta, inicial, meses, taxaAnual: taxa }) : null, premissas: { taxa_anual: taxa, inflacao_anual: infl }, aviso: 'Simulação com taxas suas. Não é garantia de rendimento.' }];
    }
    case 'milhas_calcular': {
      const out = {};
      const preco = numero(body.preco); const milhas = numero(body.milhas); const anuidade = numero(body.anuidade ?? 0);
      if (Number.isFinite(preco) && Number.isFinite(milhas) && milhas > 0) out.custo_milheiro = motor.custoMilheiro({ preco, milhas, anuidade: Number.isFinite(anuidade) ? anuidade : 0 });
      const pontos = numero(body.pontos); const bonus = numero(body.bonus_pct ?? 0);
      if (Number.isFinite(pontos) && pontos > 0) out.milhas_com_bonus = motor.milhasComBonus({ pontos, bonusPct: Number.isFinite(bonus) ? bonus : 0 });
      const pd = numero(body.preco_dinheiro); const mr = numero(body.milhas_resgate); const vm = numero(body.valor_milheiro ?? 20); const tx = numero(body.taxas ?? 0);
      if (Number.isFinite(pd) && Number.isFinite(mr) && mr > 0) out.resgate = motor.valeResgate({ milhas: mr, taxas: Number.isFinite(tx) ? tx : 0, precoDinheiro: pd, valorMilheiro: Number.isFinite(vm) ? vm : 20 });
      if (!Object.keys(out).length) return [400, { error: 'Preencha os campos de pelo menos um cálculo.' }];
      return [200, { ...out, aviso: 'Promoções e preços mudam. Confirme no site do programa antes de comprar.' }];
    }
    default: return null;
  }
}

/** Painel inicial: tudo calculado pelo motor, com lacunas explícitas. */
async function montarPainel(c, mes, diasAte) {
  const { base, listar } = c;
  const [contas, carteira, pontos, dividas, lancs, gastos, cartoes, orc] = await Promise.all(['contas', 'carteira', 'pontos', 'dividas', 'lancamentos', 'gastos', 'cartoes'].map((n) => listar(base.collection(n))).concat([base.collection('orcamento').doc('atual').get().then((s) => (s && s.exists ? s.data() : null)).catch(() => null)]));
  const pf = (l) => l.filter((x) => !x.pessoa_juridica);
  const pat = motor.patrimonio({
    contas: pf(contas).map((x) => ({ valor: x.saldo })), investimentos: carteira.map((x) => ({ valor: x.valor })),
    milhas: pontos.map((p) => ({ valor: dinheiro((p.saldo / 1000) * (p.valor_milheiro || 0)) })), dividas: dividas.map((d) => ({ valor: d.saldo })),
  });
  const rl = resumoLancamentos(lancs, mes);
  const cartaoMes = c.resumoMes(gastos, mes).total;
  const temLanc = lancs.some((l) => ehMes(l, mes));
  const renda = rl.receitas || (orc && Number(orc.renda_extra) > 0 ? Number(orc.renda_extra) : 0);
  const despesas = dinheiro(rl.despesas + cartaoMes);
  const fixas = orc && Array.isArray(orc.fixas) ? orc.fixas.reduce((s, f) => s + (Number(f.valor) || 0), 0) : 0;
  const despesaBase = despesas > 0 ? despesas : (fixas > 0 ? fixas : null);
  const reserva = dinheiro(pf(contas).reduce((s, x) => s + (Number(x.saldo) || 0), 0) + carteira.filter((i) => ['poupanca', 'renda_fixa', 'tesouro'].includes(i.tipo)).reduce((s, i) => s + (Number(i.valor) || 0), 0));
  const mesesRes = motor.mesesReserva(reserva, despesaBase);
  const parcelas = dividas.reduce((s, d) => s + (Number(d.parcela_minima) || 0), 0);
  const vencidas = dividas.filter((d) => d.vencimento && diasAte(d.vencimento) < 0 && d.saldo > 0).length;
  const saude = motor.saudeFinanceira({
    renda: renda || 0, despesas: renda > 0 && (temLanc || cartaoMes > 0) ? despesas : null, parcelasDividas: dividas.length ? parcelas : null,
    reservaMeses: mesesRes, dividaTotal: dividas.length ? pat.passivos : null, patrimonioAtivos: pat.ativos, vencidas: dividas.length ? vencidas : null,
  });
  const proximos = [];
  const dia = Number(mes && String(c.agoraIso).slice(8, 10));
  for (const ct of cartoes) { const f = ((Number(ct.dia_vencimento) - dia) + 31) % 31; if (f <= 7) proximos.push({ tipo: 'fatura', nome: ct.nome, dia: ct.dia_vencimento, em_dias: f }); }
  for (const d of dividas) if (d.vencimento && d.saldo > 0) { const e = diasAte(d.vencimento); if (e <= 7) proximos.push({ tipo: 'divida', nome: d.nome, data: d.vencimento, em_dias: e }); }
  proximos.sort((a, b) => a.em_dias - b.em_dias);
  const alertas = [];
  if (vencidas) alertas.push({ nivel: 'perigo', texto: `${vencidas} dívida(s) com vencimento passado.` });
  if (mesesRes !== null && mesesRes < 3) alertas.push({ nivel: 'aviso', texto: `Sua reserva cobre ${mesesRes} mês(es) de despesas. O ideal é 6.` });
  if (renda > 0 && despesas > renda) alertas.push({ nivel: 'perigo', texto: 'As despesas do mês estão acima da renda.' });
  for (const p of pontos) if (p.validade && p.saldo > 0) { const e = diasAte(p.validade); if (e >= 0 && e <= 30) alertas.push({ nivel: 'aviso', texto: `${p.programa}: ${p.saldo} pontos vencem em ${e} dia(s).` }); }
  const lacunas = [];
  if (!contas.length) lacunas.push('Cadastre suas contas para ver o saldo disponível.');
  if (!temLanc) lacunas.push('Envie um extrato ou fatura para ver receitas e despesas do mês.');
  if (!carteira.length) lacunas.push('Cadastre seus investimentos.');
  return {
    mes, patrimonio_liquido: pat.liquido, ativos: pat.ativos, passivos: pat.passivos,
    saldo_disponivel: dinheiro(pf(contas).reduce((s, x) => s + (Number(x.saldo) || 0), 0)),
    investimentos: dinheiro(carteira.reduce((s, i) => s + (Number(i.valor) || 0), 0)),
    milhas_estimado: dinheiro(pontos.reduce((s, p) => s + (p.saldo / 1000) * (p.valor_milheiro || 0), 0)),
    dividas: pat.passivos, renda_mes: dinheiro(renda), despesas_mes: despesas, sobra_mes: dinheiro(renda - despesas),
    reserva, despesa_mensal_base: despesaBase, meses_reserva: mesesRes, saude, proximos, alertas, lacunas,
    por_categoria: rl.por_categoria, atualizado_em: c.agoraIso,
  };
}

module.exports = { agirKf, validarLancamento, validarConta, validarDivida, resumoLancamentos, idLancamento, montarPainel, LER_DOC, SUBCATEGORIAS_PADRAO };
