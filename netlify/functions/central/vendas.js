'use strict';
// Vendas na Central (Fase 4, 13/11/2026) — CONTRATO para a tela (PC 2):
//   GET  parte=vendas-ramos                          → { ramos: ['barbearia', 'restaurante', ...] }
//   GET  parte=vendas-prospects&etapa=&ramo=&cidade=&quente=1&limite=
//        → { prospects: [{ id, nome, ramo, cidade, telefone, whatsapp, site, instagram, endereco, temSite, quente, etapa,
//                          mensagem, linkWhats }], contagem: { novo, contatado, proposta, fechado, perdido, nao-quer } }
//   POST acao=vendas-buscar { ramo, cidade }         → { achados, novos, repetidos, quentes } (OpenStreetMap; grava no funil;
//                                                      posta no mural: Prospecção "feito" + "precisa-ok" para enviar)
//   POST acao=vendas-etapa { id, etapa, nota? }      → { prospect }  (novo|contatado|proposta|fechado|perdido|nao-quer)
// Os pedidos de orçamento do SITE continuam em parte=leads (coleção nexia_leads, já existente).
const osm = require('../../../nexia-ai/vendas/osm');
const { createProspects, mensagemAbordagem, linkWhats } = require('../../../nexia-ai/vendas/prospects');
const { createMural } = require('../../../nexia-ai/escritorio/mural');

async function rota({ parte, acao, query = {}, body = {} }, { prospects = null, mural = null, env = process.env, fetchFn = fetch } = {}) {
  if (parte === 'vendas-ramos') return { status: 200, corpo: { ramos: Object.keys(osm.RAMOS) } };
  if (!['vendas-prospects'].includes(parte) && !['vendas-buscar', 'vendas-etapa'].includes(acao)) return null;
  const pr = prospects || createProspects({ env });
  if (!pr.ligado()) return { status: 503, corpo: { error: 'Vendas ainda não ligado (banco D1 não configurado).' } };
  if (parte === 'vendas-prospects') {
    const lista = await pr.listar({ etapa: query.etapa || '', ramo: query.ramo || '', cidade: query.cidade || '', quente: query.quente === '1', limite: Number(query.limite) || 100 });
    return { status: 200, corpo: { prospects: lista.map((p) => { const m = mensagemAbordagem(p); return { ...p, mensagem: m, linkWhats: linkWhats(p, m) }; }), contagem: await pr.contagem() } };
  }
  if (acao === 'vendas-buscar') {
    let achados;
    try { achados = await osm.buscar({ ramo: body.ramo, cidade: body.cidade }, fetchFn); } catch (e) { return { status: 400, corpo: { error: e.message } }; }
    const r = await pr.salvar(achados);
    const quentes = achados.filter((p) => p.quente).length;
    const m = mural || createMural({ env });
    try {
      if (m.ligado()) {
        await m.postar({ area: 'prospeccao', agente: 'Caçador', tipo: 'feito', texto: `Busquei ${osm.ramoId(body.ramo)} em ${body.cidade}: ${achados.length} achados, ${r.novos} novos, ${quentes} quentes (sem site e com WhatsApp).` });
        if (r.novos && quentes) await m.postar({ area: 'prospeccao', agente: 'Redator de abordagem', tipo: 'precisa-ok', para: 'comercial', texto: `Mensagens prontas para ${quentes} negócios sem site (${osm.ramoId(body.ramo)}, ${body.cidade}). Abra Vendas e envie com 1 toque cada.` });
      }
    } catch { /* o mural é extra: a busca vale mesmo sem ele */ }
    return { status: 200, corpo: { achados: achados.length, novos: r.novos, repetidos: r.repetidos, quentes } };
  }
  if (acao === 'vendas-etapa') {
    const r = await pr.mudarEtapa(body.id, body.etapa, body.nota);
    return r.erro ? { status: 409, corpo: { error: r.erro } } : { status: 200, corpo: { prospect: r } };
  }
  return null;
}

module.exports = { rota };
