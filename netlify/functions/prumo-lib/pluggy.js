'use strict';
// Dono 20/11: "buscar as informações dos bancos para controlar os gastos". Open Finance pelo Meu Pluggy (grátis para
// uso pessoal): a pessoa autoriza o banco no próprio banco; o app NUNCA vê senha. Chaves só como segredos do servidor
// (PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET, nos segredos do GitHub, que o deploy copia para o Worker).
// Sincronizar: saldo das contas -> 'contas'; movimentos -> 'lancamentos' (sem duplicar); cartão -> compras com o
// vencimento da fatura e o total da fatura no "A pagar".
const BASE = 'https://api.pluggy.ai';
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const CAT = [
  [/supermarket|grocer|mercado|food|restaurant|delivery|alimenta/i, 'alimentacao'], [/transport|gas station|fuel|uber|taxi|parking|combust/i, 'transporte'],
  [/health|pharmac|farm|hospital|medic|saude/i, 'saude'], [/educa|school|course|escola/i, 'educacao'], [/leisure|entertain|travel|lazer|viage/i, 'lazer'],
  [/shopping|clothing|eletr|compras/i, 'compras'], [/subscri|streaming|digital service|assinat/i, 'assinaturas'], [/tax|imposto|iof/i, 'impostos'],
  [/invest|aplica/i, 'investimentos'], [/salary|income|salario|proventos/i, 'renda'], [/housing|rent|utilit|electric|water|internet|telefon|aluguel|condom/i, 'moradia'],
];
const categoria = (t) => { const s = `${t.category || ''} ${t.description || ''}`; for (const [re, k] of CAT) if (re.test(s)) return k; return 'outros'; };
const ehPagFatura = (t) => /pag(amento|to)?\.?\s*(de\s+)?(fatura|cart)|fatura\s+cart/i.test(String(t.description || ''));
const ehMesmaTitularidade = (t) => /same ownership|mesma titularidade/i.test(String(t.category || ''));

function config(c) {
  const env = (c.deps && c.deps.env) || (typeof process !== 'undefined' ? process.env : {}) || {};
  // Dono 20/11: chave colada com espaço/aspas/quebra de linha é recusada pela Pluggy; limpa antes de usar.
  const limpa = (v) => String(v || '').replace(/^[s"'`]+|[s"'`]+$/g, '');
  return { id: limpa(env.PLUGGY_CLIENT_ID || env.PLUGGY_CLIEND_ID), segredo: limpa(env.PLUGGY_CLIENT_SECRET), fetch: (c.deps && c.deps.fetch) || ((...a) => fetch(...a)) };
}
async function chamar(cfg, chave, caminho, opts = {}) {
  const r = await cfg.fetch(BASE + caminho, { method: opts.method || 'GET', headers: { 'content-type': 'application/json', ...(chave ? { 'X-API-KEY': chave } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (!r.ok) throw Object.assign(new Error('Pluggy respondeu ' + r.status), { status: r.status });
  return r.json();
}
async function apiKey(cfg) {
  try { return (await chamar(cfg, null, '/auth', { method: 'POST', body: { clientId: cfg.id, clientSecret: cfg.segredo } })).apiKey; } catch (e) { e.etapa = 'auth'; throw e; }
}

/** Converte uma transação da Pluggy num lançamento do app (ou null se for transferência entre contas da pessoa). */
function paraLancamento(t, conta, hoje, agoraIso) {
  if (ehMesmaTitularidade(t)) return null;
  const valor = Math.abs(Number(t.amount) || 0); if (!(valor > 0)) return null;
  const credito = conta.type === 'CREDIT';
  const entrada = t.type ? t.type === 'CREDIT' : Number(t.amount) > 0;
  if (credito && entrada && /pagamento|pagto|pgto/i.test(String(t.description || ''))) return null; // pagamento da fatura dentro do cartão: não é entrada
  const data = String(t.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const l = { data, descricao: String(t.description || 'Movimento').slice(0, 120), estabelecimento: String((t.merchant && t.merchant.name) || t.description || '').slice(0, 120), valor: r2(valor),
    tipo: entrada ? 'receita' : 'despesa', categoria: entrada ? 'renda' : categoria(t), documento: credito ? 'fatura' : 'openfinance', meio: credito ? 'cartao' : 'conta',
    origem: 'openfinance', status: data > hoje ? 'previsto' : 'realizado', criado_em: agoraIso };
  if (!credito && !entrada && ehPagFatura(t)) l.categoria = 'fatura'; // pagar a fatura não é gasto novo (as compras já contam)
  if (credito && conta.creditData && conta.creditData.balanceDueDate) l.vencimento = String(conta.creditData.balanceDueDate).slice(0, 10);
  return l;
}

async function agirPluggy(acao, body, c) {
  if (!['pluggy_status', 'pluggy_token', 'pluggy_item_salvar', 'pluggy_sincronizar', 'pluggy_desligar'].includes(acao)) return null;
  const { base, agoraIso } = c;
  const cfg = config(c);
  const ref = base.collection('config').doc('pluggy');
  const s = await ref.get(); const atual = (s && s.exists && s.data()) || { itens: [] };
  const itens = Array.isArray(atual.itens) ? atual.itens : [];
  if (acao === 'pluggy_status') return [200, { configurado: !!(cfg.id && cfg.segredo), conectado: itens.length > 0, itens: itens.length, ultima_sync: atual.ultima_sync || null }];
  if (!cfg.id || !cfg.segredo) return [503, { error: 'A conexão com os bancos ainda não foi ligada no servidor. Siga o passo a passo do Perfil.' }];
  if (acao === 'pluggy_desligar') { await ref.set({ ...atual, itens: [] }); return [200, { ok: true }]; }
  try {
    const chave = await apiKey(cfg);
    if (acao === 'pluggy_token') {
      const t = await chamar(cfg, chave, '/connect_token', { method: 'POST', body: { options: { clientUserId: 'kernex-finance', avoidDuplicates: true } } });
      return [200, { token: t.accessToken }];
    }
    if (acao === 'pluggy_item_salvar') {
      const id = String(body.itemId || '').slice(0, 80); if (!id) return [400, { error: 'Conexão inválida.' }];
      await ref.set({ ...atual, itens: [...new Set([...itens, id])] });
      return [200, { ok: true }];
    }
    // pluggy_sincronizar
    const hoje = require('./previsto').hojeDe(agoraIso);
    const desde = atual.ultima_sync ? new Date(Date.parse(atual.ultima_sync) - 5 * 86400000).toISOString().slice(0, 10) : new Date(Date.parse(hoje) - 90 * 86400000).toISOString().slice(0, 10);
    const doc = require('./documentos');
    const regras = await doc.lerRegras(base);
    const col = base.collection('lancamentos');
    const existentes = new Set((await c.listar(col)).map((x) => x.id));
    let novos = 0; const contasPara = []; const faturas = [];
    for (const itemId of itens) {
      const contas = (await chamar(cfg, chave, '/accounts?itemId=' + encodeURIComponent(itemId))).results || [];
      for (const conta of contas) {
        let cursor = `/v2/transactions?accountId=${encodeURIComponent(conta.id)}&dateFrom=${desde}`; let voltas = 0;
        while (cursor && voltas++ < 20) {
          const pg = await chamar(cfg, chave, cursor);
          const lista = pg.results || [];
          const prontos = lista.map((t) => ({ t, l: paraLancamento(t, conta, hoje, agoraIso) })).filter((x) => x.l && !existentes.has('pg-' + x.t.id));
          doc.aplicarRegras(prontos.map((x) => x.l), regras);
          for (const { t, l } of prontos) { await col.doc('pg-' + t.id).set(l); existentes.add('pg-' + t.id); novos++; }
          const nx = pg.next ? String(pg.next) : '';
          cursor = !nx ? null : nx.startsWith(BASE) ? nx.slice(BASE.length) : nx.startsWith('/') ? nx : `/v2/transactions?accountId=${encodeURIComponent(conta.id)}&cursor=${encodeURIComponent(nx)}`;
        }
        if (conta.type === 'CREDIT') {
          const cd = conta.creditData || {};
          if (cd.balanceDueDate && Number(conta.balance) > 0) faturas.push({ nome: conta.name || conta.marketingName || 'Cartão', valor: r2(conta.balance), vencimento: String(cd.balanceDueDate).slice(0, 10) });
        } else contasPara.push(conta);
      }
    }
    for (const f of faturas) await require('./faturas').agirFaturas('fatura_gravar', f, c);
    // Saldo por último: o que entrou antes dele já está no saldo (não soma de novo no "Tenho").
    for (const k of contasPara) await base.collection('contas').doc('pg-' + k.id).set({ nome: String(k.name || k.marketingName || 'Conta').slice(0, 60), tipo: /saving|poupan/i.test(String(k.subtype || '')) ? 'poupanca' : 'corrente', saldo: r2(k.balance), moeda: k.currencyCode || 'BRL', instituicao: null, origem: 'openfinance', atualizado_em: new Date(Date.parse(agoraIso) + 1000).toISOString() });
    await ref.set({ ...atual, itens, ultima_sync: agoraIso });
    return [200, { ok: true, novos, contas: contasPara.length, faturas: faturas.length }];
  } catch (e) {
    // Diz em qual passo falhou, sem nunca mostrar a chave: 'auth' = Client ID/Secret; outro = permissão da aplicação.
    const negado = e.status === 400 || e.status === 401 || e.status === 403;
    const msg = !negado ? 'Não consegui falar com o Open Finance agora. Tente de novo mais tarde.'
      : e.etapa === 'auth' ? `A Pluggy não aceitou o Client ID e o Client Secret (erro ${e.status}). Confira se são da MESMA aplicação no dashboard.pluggy.ai e se foram colados sem espaço.`
      : `A Pluggy aceitou as chaves, mas não liberou a conexão (erro ${e.status}). No dashboard.pluggy.ai, ative o conector MeuPluggy nessa aplicação.`;
    return [502, { error: msg, etapa: e.etapa || acao, status: e.status || null, tamanho_id: cfg.id.length, tamanho_segredo: cfg.segredo.length }];
  }
}

module.exports = { agirPluggy, paraLancamento };
