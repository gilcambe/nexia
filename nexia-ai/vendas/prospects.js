'use strict';
// Funil de prospecção (Fase 4, 13/11/2026): guarda os negócios achados (D1 "vendas_prospects"), sem repetir, e o
// estágio: novo → contatado → proposta → fechado | perdido | nao-quer (LGPD: quem pede para sair nunca mais é contatado).
// A mensagem de WhatsApp é só preparada (link wa.me): quem envia é o dono, com 1 toque (regra: nada de disparo).
const ETAPAS = ['novo', 'contatado', 'proposta', 'fechado', 'perdido', 'nao-quer'];
const COL = 'vendas_prospects';

function driverPadrao(env) {
  if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return null;
  return require('../../lib/firebase-lite/d1-backend').createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
}

const NOMES_RAMO = { barbearia: 'barbearia', salao: 'salão', estetica: 'estética', restaurante: 'restaurante', lanchonete: 'lanchonete', pizzaria: 'pizzaria', padaria: 'padaria', doceria: 'doceria', academia: 'academia', dentista: 'consultório', clinica: 'clínica', psicologo: 'consultório', petshop: 'pet shop', veterinario: 'clínica veterinária', advocacia: 'escritório', contabilidade: 'escritório', imobiliaria: 'imobiliária', oficina: 'oficina', hotel: 'hospedagem', escola: 'escola', igreja: 'igreja', loja: 'loja', otica: 'ótica', floricultura: 'floricultura', mercado: 'mercado', farmacia: 'farmácia', fotografo: 'estúdio', construtora: 'construtora' };

/** Texto da 1ª mensagem (curta, educada, com saída). Sem IA: o mesmo modelo revisado para todos. */
function mensagemAbordagem(p, { demo = '' } = {}) {
  const tipo = NOMES_RAMO[p.ramo] || 'negócio';
  const linhas = [
    `Olá, ${p.nome}! Tudo bem? Sou da KERNEX, de ${p.cidade || 'perto de vocês'}.`,
    p.temSite ? `Vi que vocês já têm site; fazemos sites com agendamento/pedido pelo WhatsApp que trazem mais clientes.`
      : `Procurei a ${tipo} de vocês no Google e não achei um site. Hoje muita gente escolhe pelo celular antes de chamar.`,
    `Montamos um site profissional para ${tipo} em poucos dias${demo ? `. Veja um exemplo: ${demo}` : ''}.`,
    'Posso te mandar uma prévia grátis com o nome de vocês, sem compromisso?',
    'Se não quiser receber mensagens, é só responder "sair".',
  ];
  return linhas.join('\n');
}
const linkWhats = (p, texto) => (p.whatsapp ? `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(texto)}` : '');

function createProspects({ env = process.env, driver, agora = () => new Date() } = {}) {
  const d = () => driver || (driver = driverPadrao(env));
  const iso = () => agora().toISOString();
  const up = (path, fields, create_time) => ({ type: 'upsert', path, fields, create_time: create_time || iso(), update_time: iso() });
  const pathDe = (id) => `${COL}/${String(id).replace(/[^a-z0-9-]/gi, '')}`;

  /** Guarda os achados; quem já existe não volta para "novo" (nem quem pediu para sair). Devolve { novos, repetidos }. */
  async function salvar(lista) {
    const paths = lista.map((p) => pathDe(p.id));
    const atuais = paths.length ? await d().get(paths) : new Map();
    const ops = []; let novos = 0;
    lista.forEach((p, i) => {
      const a = atuais.get(paths[i]);
      if (a) return;
      novos++;
      ops.push(up(paths[i], { ...p, etapa: 'novo', achado_em: iso(), historico: [] }));
    });
    if (ops.length) await d().apply(ops);
    return { novos, repetidos: lista.length - novos };
  }

  async function listar({ etapa = '', ramo = '', cidade = '', quente = false, limite = 100 } = {}) {
    return (await d().list('', COL, false)).map((x) => x.fields)
      // LGPD: quem pediu para sair só aparece se pedirem essa etapa de propósito
      .filter((p) => (etapa ? p.etapa === etapa : p.etapa !== 'nao-quer') && (!ramo || p.ramo === ramo) && (!cidade || String(p.cidade).toLowerCase() === String(cidade).toLowerCase()) && (!quente || p.quente))
      .sort((a, b) => Number(b.quente) - Number(a.quente) || (a.achado_em < b.achado_em ? 1 : -1))
      .slice(0, Math.max(1, Math.min(500, limite)));
  }

  /** Muda a etapa (o dono ou um agente). "nao-quer" é definitivo. */
  async function mudarEtapa(id, etapa, nota = '') {
    if (!ETAPAS.includes(etapa)) return { erro: 'etapa inválida' };
    const path = pathDe(id);
    const a = (await d().get([path])).get(path);
    if (!a) return { erro: 'não achei esse contato' };
    if (a.fields.etapa === 'nao-quer') return { erro: 'essa pessoa pediu para não ser contatada' };
    const fields = { ...a.fields, etapa, historico: [...(a.fields.historico || []), { etapa, nota: String(nota).slice(0, 200), em: iso() }].slice(-30) };
    await d().apply([up(path, fields, a.create_time)]);
    return fields;
  }

  async function contagem() {
    const todos = (await d().list('', COL, false)).map((x) => x.fields);
    return Object.fromEntries(ETAPAS.map((e) => [e, todos.filter((p) => p.etapa === e).length]));
  }

  return { salvar, listar, mudarEtapa, contagem, ligado: () => !!d() };
}

module.exports = { createProspects, mensagemAbordagem, linkWhats, ETAPAS };
