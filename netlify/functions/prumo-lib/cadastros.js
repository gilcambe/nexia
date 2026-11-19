'use strict';
// Dono 19/11: "não deixa eu apagar... editar... nada!". Um lugar só com TUDO que a pessoa cadastrou, de todas as telas,
// com apagar em cada item e "desfazer" do último apagado (melhoria 4). Editar abre a tela do item (o formulário de lá).
const GRUPOS = [
  { colecao: 'lancamentos', nome: 'Lançamentos (gastos e entradas)', aba: 'documentos' },
  { colecao: 'pagamentos', nome: 'Salário, adiantamento e 13º', aba: 'orcamento' },
  { colecao: 'holerites', nome: 'Holerites (sistema antigo)', aba: 'orcamento' },
  { colecao: 'folhas_ponto', nome: 'Folhas de ponto', aba: 'orcamento' },
  { colecao: 'contas', nome: 'Contas do banco', aba: 'contas' },
  { colecao: 'cartoes', nome: 'Cartões', aba: 'cartoes' },
  { colecao: 'gastos', nome: 'Compras no cartão', aba: 'gastos' },
  { colecao: 'dividas', nome: 'Dívidas', aba: 'dividas' },
  { colecao: 'limites', nome: 'Limites por categoria', aba: 'orcamento' },
  { colecao: 'objetivos', nome: 'Objetivos', aba: 'objetivos' },
  { colecao: 'carteira', nome: 'Investimentos', aba: 'investimentos' },
  { colecao: 'dividendos', nome: 'Proventos', aba: 'investimentos' },
  { colecao: 'pontos', nome: 'Milhas e pontos', aba: 'pontos' },
  { colecao: 'scores', nome: 'Score de crédito', aba: 'inicio' },
  { colecao: 'viagens', nome: 'Viagens', aba: 'viagens' },
  { colecao: 'aposentadoria', nome: 'Aposentadoria e FGTS', aba: 'aposentadoria' },
];
const PERMITIDAS = new Set(GRUPOS.map((g) => g.colecao));
const NOME_PAG = { adiantamento: 'Adiantamento', mensal: 'Salário do mês', decimo_terceiro_1: '13º (1ª parcela)', decimo_terceiro_2: '13º (2ª parcela)', ferias: 'Férias', plr: 'PLR', outro: 'Outro recebimento' };
const primeiro = (o, ks) => { for (const k of ks) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return null; };

function rotulo(colecao, o) {
  let titulo = primeiro(o, ['descricao', 'nome', 'credor', 'programa', 'ticker', 'categoria', 'destino', 'orgao', 'empresa']);
  if (colecao === 'pagamentos') titulo = NOME_PAG[o.tipo] || titulo || 'Recebimento';
  if (colecao === 'folhas_ponto') titulo = 'Folha de ponto';
  if (colecao === 'aposentadoria') titulo = o.id === 'fgts' ? 'Saldo do FGTS' : 'Dados do INSS';
  const valor = primeiro(o, ['valor', 'liquido', 'saldo', 'limite', 'alvo', 'pontuacao', 'score']);
  const data = primeiro(o, ['data', 'data_pagamento', 'mes']);
  return { id: o.id, titulo: String(titulo || o.id).slice(0, 80), valor: typeof valor === 'number' ? valor : null, data: data ? String(data).slice(0, 10) : null };
}

async function agirCadastros(acao, body, c) {
  if (!['cadastros_listar', 'cadastro_apagar', 'desfazer'].includes(acao)) return null;
  const { base, listar, agoraIso } = c;
  const lixo = base.collection('lixeira').doc('ultimo');
  if (acao === 'cadastros_listar') {
    const listas = await Promise.all(GRUPOS.map((g) => listar(base.collection(g.colecao)).catch(() => [])));
    const s = await lixo.get();
    const grupos = GRUPOS.map((g, i) => ({ ...g, itens: listas[i].map((o) => rotulo(g.colecao, o)).sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))) })).filter((g) => g.itens.length);
    return [200, { grupos, total: grupos.reduce((t, g) => t + g.itens.length, 0), pode_desfazer: !!(s && s.exists) }];
  }
  if (acao === 'cadastro_apagar') {
    const colecao = String(body.colecao || ''); const id = String(body.id || '').slice(0, 120);
    if (!PERMITIDAS.has(colecao) || !id) return [400, { error: 'Item inválido.' }];
    const ref = base.collection(colecao).doc(id);
    const s = await ref.get();
    if (!s || !s.exists) return [404, { error: 'Esse item já não existe.' }];
    await lixo.set({ colecao, id, dados: s.data(), em: agoraIso }); // guarda para o "desfazer"
    await ref.delete();
    return [200, { ok: true, apagado: rotulo(colecao, { id, ...s.data() }), pode_desfazer: true }];
  }
  // desfazer: devolve o último item apagado por aqui
  const s = await lixo.get();
  if (!s || !s.exists) return [404, { error: 'Não há nada para desfazer.' }];
  const u = s.data();
  if (!PERMITIDAS.has(u.colecao)) return [400, { error: 'Não dá para desfazer este item.' }];
  await base.collection(u.colecao).doc(u.id).set(u.dados);
  await lixo.delete();
  return [200, { ok: true, devolvido: rotulo(u.colecao, { id: u.id, ...u.dados }) }];
}

module.exports = { agirCadastros, GRUPOS, rotulo };
