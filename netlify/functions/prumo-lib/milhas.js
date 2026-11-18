'use strict';
/**
 * Kernex Finance, fase 8: milhas e pontos. Custo e valor por milheiro vêm do motor.
 * Promoções só entram com FONTE e VALIDADE (nada inventado); vencida some da lista.
 */
const { custoMilheiro, resgateMilhas } = require('./motor');
const { retornoPct } = require('./cartoes');

const AVISO = 'Valores de pontos e milhas mudam; confira no programa antes de decidir. Não é recomendação financeira.';
const PROGRAMAS_SUGERIDOS = ['Livelo', 'Esfera', 'LATAM Pass', 'Smiles', 'Azul Fidelidade', 'TAP Miles&Go'];
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
};
// Inteiro em pt-BR: 45.300 = 45300 (ponto é milhar); com vírgula vira decimal.
const inteiroBR = (v) => (typeof v === 'string' && /^\s*\d{1,3}(\.\d{3})+\s*$/.test(v) ? Number(v.replace(/\./g, '')) : numero(v));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function validarCompra(o) {
  const programa = texto(o && o.programa, 60);
  if (!programa) return { ok: false, erro: 'Diga o programa.' };
  const milhas = numero(o.milhas); const preco = numero(o.preco);
  if (!Number.isFinite(milhas) || milhas <= 0 || !Number.isInteger(milhas)) return { ok: false, erro: 'As milhas precisam ser um número inteiro maior que zero.' };
  if (!Number.isFinite(preco) || preco < 0) return { ok: false, erro: 'O preço pago precisa ser zero ou mais.' };
  const data = texto(o.data, 10);
  if (data && !DATA.test(data)) return { ok: false, erro: 'Data inválida.' };
  return { ok: true, item: { programa, milhas, preco: Math.round(preco * 100) / 100, data: data || null } };
}
function validarPromo(o) {
  const titulo = texto(o && o.titulo, 100);
  if (!titulo) return { ok: false, erro: 'Diga qual é a promoção.' };
  const fonte = texto(o.fonte, 120);
  if (!fonte) return { ok: false, erro: 'Sem fonte (site, e-mail do programa) não registro promoção.' };
  const validade = texto(o.validade, 10);
  if (!DATA.test(validade)) return { ok: false, erro: 'Diga até quando vale a promoção (AAAA-MM-DD).' };
  const bonus = o.bonus_pct === undefined || o.bonus_pct === '' ? null : numero(o.bonus_pct);
  if (bonus !== null && (!Number.isFinite(bonus) || bonus < 0 || bonus > 1000)) return { ok: false, erro: 'Bônus inválido.' };
  return { ok: true, item: { titulo, programa: texto(o.programa, 60) || null, fonte, url: texto(o.url, 300) || null, validade, bonus_pct: bonus } };
}

// Nomes de programa: cada grupo tem o nome padrão e os jeitos de escrever (SUPOSIÇÃO: lista dos programas mais comuns em 2026).
const GRUPOS = [
  ['Smiles', ['smiles']], ['LATAM Pass', ['latam pass', 'latampass', 'latam', 'multiplus']],
  ['Azul Fidelidade', ['azul fidelidade', 'tudoazul', 'tudo azul', 'azul']], ['Livelo', ['livelo']], ['Esfera', ['esfera']],
  ['TAP Miles&Go', ['tap miles&go', 'tap miles and go', 'tap']], ['Iupp', ['iupp']],
];
function nomePadrao(nome) {
  const n = norm(nome);
  const g = GRUPOS.find(([, ap]) => ap.includes(n));
  return g ? g[0] : texto(nome, 60);
}

const LER_PRINT = `Você lê UM print (ou página de PDF) do app ou site de um programa de pontos/milhas do Brasil (Smiles, LATAM Pass, TudoAzul, Livelo, Esfera, etc.). Responda SÓ com JSON:
{"programa":"","saldo":0,"a_vencer":[{"pontos":0,"data":"AAAA-MM-DD"}]}
saldo = pontos ou milhas disponíveis agora (número inteiro; 12.345 vira 12345). a_vencer = pontos que vencem, cada grupo com a data de vencimento; lista vazia se não aparecer.
Não copie CPF, nome da pessoa, número de cliente, senha nem login.`;

/** Valida o que a IA leu num print. a_vencer vira { pontos, data } do vencimento mais próximo. */
function validarPrint(o) {
  const programa = nomePadrao(texto(o && o.programa, 60));
  if (!programa) return { ok: false, erro: 'Não achei o nome do programa neste print.' };
  const saldo = inteiroBR(o.saldo);
  if (!Number.isFinite(saldo) || saldo < 0) return { ok: false, erro: 'Não achei o saldo neste print.' };
  const venc = (Array.isArray(o.a_vencer) ? o.a_vencer : []).map((x) => ({ pontos: Math.round(inteiroBR(x && x.pontos)), data: texto(x && x.data, 10) }))
    .filter((x) => x.pontos > 0 && DATA.test(x.data)).sort((a, b) => a.data.localeCompare(b.data))[0];
  if (!venc && DATA.test(texto(o.validade, 10))) { const pts = Math.round(inteiroBR(o.a_vencer_pontos)); return { ok: true, item: { programa, saldo: Math.round(saldo), validade: texto(o.validade, 10), a_vencer_pontos: pts > 0 ? pts : null } }; }
  return { ok: true, item: { programa, saldo: Math.round(saldo), validade: venc ? venc.data : null, a_vencer_pontos: venc ? venc.pontos : null } };
}

function validarViagem(o) {
  const origem = texto(o && o.origem, 60); const destino = texto(o && o.destino, 60);
  if (!origem || !destino) return { ok: false, erro: 'Diga a origem e o destino.' };
  const ida = texto(o.data_ida, 10); const volta = texto(o.data_volta, 10);
  if (!DATA.test(ida)) return { ok: false, erro: 'Diga a data de ida.' };
  if (volta && (!DATA.test(volta) || volta < ida)) return { ok: false, erro: 'A volta precisa ser uma data depois da ida.' };
  const preco = numero(o.preco_dinheiro);
  if (!Number.isFinite(preco) || preco <= 0) return { ok: false, erro: 'Diga o preço em dinheiro que você viu (maior que zero).' };
  const milhas = inteiroBR(o.milhas);
  if (!Number.isFinite(milhas) || milhas <= 0) return { ok: false, erro: 'Diga quantas milhas o programa pediu.' };
  const taxas = o.taxas === undefined || o.taxas === null || o.taxas === '' ? 0 : numero(o.taxas);
  if (!Number.isFinite(taxas) || taxas < 0) return { ok: false, erro: 'As taxas precisam ser zero ou mais.' };
  return { ok: true, item: { origem, destino, data_ida: ida, data_volta: volta || null, preco_dinheiro: Math.round(preco * 100) / 100, milhas: Math.round(milhas), taxas: Math.round(taxas * 100) / 100, programa: nomePadrao(texto(o.programa, 60)) || null, obs: texto(o.obs, 200) || null } };
}

function visao(pontosTodos, compras, promos, hoje) {
  const pontos = (pontosTodos || []).filter((p) => p && p.programa); // a coleção também guarda a folha de ponto do Salário (sem programa)
  const programas = pontos.map((p) => {
    const cs = (compras || []).filter((c) => norm(c.programa) === norm(p.programa));
    const milhasC = cs.reduce((s, c) => s + c.milhas, 0);
    const pagoC = cs.reduce((s, c) => s + Math.round(c.preco * 100), 0) / 100;
    const custo = milhasC > 0 ? custoMilheiro({ preco: pagoC, milhas: milhasC }) : null;
    const dias = p.validade ? Math.round((Date.parse(p.validade) - Date.parse(hoje)) / 86400000) : null;
    return { id: p.id, programa: p.programa, saldo: p.saldo, validade: p.validade || null, dias_para_vencer: dias, a_vencer_30d: dias !== null && dias >= 0 && dias <= 30 ? p.saldo : 0,
      valor_milheiro: p.valor_milheiro || null, valor_estimado: Math.round((p.saldo / 1000) * (p.valor_milheiro || 0) * 100) / 100,
      custo_aquisicao: milhasC > 0 ? pagoC : null, custo_milheiro: custo };
  });
  const sem = (compras || []).filter((c) => !programas.some((p) => norm(p.programa) === norm(c.programa)));
  const lacunas = [];
  if (!programas.length) lacunas.push('Cadastre seus programas de pontos para ver saldo e vencimentos.');
  if (programas.some((p) => p.custo_milheiro === null)) lacunas.push('Sem compras registradas em alguns programas: não calculei o custo do milheiro deles.');
  if (sem.length) lacunas.push('Há compras de programas que ainda não estão cadastrados com saldo.');
  const vigentes = (promos || []).filter((x) => x.validade >= hoje).sort((a, b) => a.validade.localeCompare(b.validade));
  return { programas, promocoes: vigentes, lacunas, sugeridos: PROGRAMAS_SUGERIDOS, aviso: AVISO };
}

async function agirMilhas(acao, body, c) {
  if (!['pontos_print_ler', 'pontos_print_salvar', 'viagem_salvar', 'viagem_listar', 'viagem_apagar', 'milhas_visao', 'milhas_compra_salvar', 'milhas_compra_apagar', 'milhas_resgate', 'milhas_cartao_ideal', 'milhas_promo_salvar', 'milhas_promo_apagar'].includes(acao)) return null;
  const { base, listar, salvar, apagar, agoraIso } = c;
  const hoje = agoraIso.slice(0, 10);
  switch (acao) {
    case 'pontos_print_ler': {
      const im = c.lerImagens(body.imagens, { pdf: true });
      if (!im.ok) return [400, { error: im.erro }];
      const perguntar = c.deps.perguntarVisao || ((img, s) => require('./salario').perguntarVisaoGratis(c.deps, img, s));
      const lidos = await Promise.all(im.imagens.map(async (img) => { // cada imagem separada
        try {
          const t = await perguntar(img, LER_PRINT);
          const j = t && c.extrairJson(t);
          if (!j) return { ok: false, erro: 'Não consegui ler este print. Tente de novo ou digite o saldo.' };
          const v = validarPrint(j);
          return v.ok ? { ok: true, pontos: v.item } : { ok: false, erro: v.erro };
        } catch { return { ok: false, erro: 'Não consegui ler este print agora.' }; }
      }));
      return [200, { lidos }];
    }
    case 'pontos_print_salvar': { // atualiza o programa se já existe (guarda cartão e valor do milheiro), senão cria
      const v = validarPrint(body);
      if (!v.ok) return [400, { error: v.erro }];
      const existentes = (await listar(base.collection('pontos'))).filter((p) => p && p.programa);
      const achou = existentes.find((p) => nomePadrao(p.programa) === v.item.programa);
      const id = achou ? achou.id : (c.novoId ? c.novoId() : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
      const { id: _i, ...resto } = achou || {};
      const novo = { valor_milheiro: 20, cartao_id: null, ...resto, programa: achou ? achou.programa : v.item.programa, saldo: v.item.saldo, validade: v.item.validade, a_vencer_pontos: v.item.a_vencer_pontos, atualizado_em: agoraIso };
      await base.collection('pontos').doc(id).set(novo);
      return [200, { ok: true, id, atualizado: !!achou, item: { id, ...novo } }];
    }
    case 'viagem_salvar': return salvar('viagens', validarViagem(body));
    case 'viagem_apagar': return apagar('viagens');
    case 'viagem_listar': {
      const viagens = (await listar(base.collection('viagens'))).filter((x) => x && x.origem).sort((a, b) => String(a.data_ida).localeCompare(String(b.data_ida)));
      return [200, { viagens }];
    }
    case 'milhas_compra_salvar': return salvar('milhas_compras', validarCompra(body));
    case 'milhas_compra_apagar': return apagar('milhas_compras');
    case 'milhas_promo_salvar': return salvar('milhas_promos', validarPromo(body));
    case 'milhas_promo_apagar': return apagar('milhas_promos');
    case 'milhas_visao': {
      const [pontos, compras, promos] = await Promise.all([listar(base.collection('pontos')), listar(base.collection('milhas_compras')), listar(base.collection('milhas_promos'))]);
      return [200, { ...visao(pontos, compras, promos, hoje), compras }];
    }
    case 'milhas_resgate': {
      const milhas = numero(body.milhas); const preco = numero(body.preco_dinheiro); const taxas = body.taxas === undefined || body.taxas === '' ? 0 : numero(body.taxas);
      if (!(milhas > 0) || !(preco > 0) || !Number.isFinite(taxas) || taxas < 0 || taxas >= preco) return [400, { error: 'Informe as milhas, o preço em dinheiro da passagem e as taxas (menores que o preço).' }];
      const programa = texto(body.programa, 60);
      const [pontos, compras] = await Promise.all([listar(base.collection('pontos')), listar(base.collection('milhas_compras'))]);
      const v = visao(pontos, compras, [], hoje).programas.find((p) => norm(p.programa) === norm(programa));
      const referencia = v ? (v.custo_milheiro || v.valor_milheiro) : null;
      const r = resgateMilhas({ milhas, preco_dinheiro: preco, taxas, referencia });
      return [200, { ...r, referencia_tipo: v && v.custo_milheiro ? 'custo médio pago' : v && v.valor_milheiro ? 'valor que você informou' : null, aviso: AVISO }];
    }
    case 'milhas_cartao_ideal': {
      const gasto = numero(body.gasto_mensal);
      if (!(gasto > 0) || gasto > 1e7) return [400, { error: 'Diga quanto você gasta por mês no cartão.' }];
      const cartoes = await listar(base.collection('cartoes'));
      const lista = cartoes.map((k) => ({ cartao_id: k.id, nome: k.nome, retorno: retornoPct(k), anuidade: Number(k.anuidade) || 0 }));
      const ranking = lista.filter((x) => x.retorno).map((x) => {
        const bruto = Math.round(gasto * 12 * x.retorno.pct) / 100;
        return { cartao_id: x.cartao_id, nome: x.nome, retorno_pct: x.retorno.pct, parcial: !!x.retorno.parcial, retorno_anual: bruto, anuidade: x.anuidade, liquido_anual: Math.round((bruto - x.anuidade) * 100) / 100 };
      }).sort((a, b) => b.liquido_anual - a.liquido_anual);
      const sem_dados = lista.filter((x) => !x.retorno).map((x) => ({ cartao_id: x.cartao_id, nome: x.nome, falta: 'pontos por real e valor do milheiro (ou cashback)' }));
      return [200, { ranking, sem_dados, melhor: ranking[0] || null, aviso: AVISO }];
    }
    default: return null;
  }
}

module.exports = { agirMilhas, validarCompra, validarPromo, validarPrint, validarViagem, nomePadrao, visao, AVISO };
