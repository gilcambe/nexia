'use strict';
// Escritório da KERNEX na Central (Fase 8, 13/11/2026) — CONTRATO para a tela (PC 2):
//   GET  parte=escritorio-areas                 → { areas: [{ id, nome, icone, faz, precisaOk[], agentes:[{id,nome,ia,area}] }] }
//   GET  parte=escritorio-mural&area=&tipo=&status=&limite=
//                                              → { recados: [{ id, area, agente, tipo, texto, para, ref, status, em, ... }] }
//   GET  parte=escritorio-resumo                → { titulo, texto, precisaVoce:[recado], atrasados:[recado], feitos, alertas, porArea:{id:{nome,feitos,abertos,ultimo}}, em }
//   POST acao=escritorio-ok { id, aprovado: true|false, motivo? }  → { recado } (o dono aprova/recusa um 'precisa-ok')
//   POST acao=escritorio-postar { area, texto, tipo?, para? }       → { recado } (o dono escreve no mural: "Comercial, priorize X")
// Sem D1 configurado: 503 { error } (a tela mostra "Escritório ainda não ligado").
const { AREAS } = require('../../../nexia-ai/escritorio/areas');
const { createMural } = require('../../../nexia-ai/escritorio/mural');
const { montarResumo } = require('../../../nexia-ai/escritorio/diretor');

async function rota({ parte, acao, query = {}, body = {} }, { mural = null, env = process.env } = {}) {
  if (parte === 'escritorio-areas') return { status: 200, corpo: { areas: AREAS } };
  const m = mural || createMural({ env });
  const pronto = () => { try { return m.ligado(); } catch { return false; } };
  if (!['escritorio-mural', 'escritorio-resumo'].includes(parte) && !['escritorio-ok', 'escritorio-postar'].includes(acao)) return null;
  if (!pronto()) return { status: 503, corpo: { error: 'Escritório ainda não ligado (banco D1 não configurado).' } };
  if (parte === 'escritorio-mural') {
    return { status: 200, corpo: { recados: await m.listar({ area: query.area || '', tipo: query.tipo || '', status: query.status || '', limite: Number(query.limite) || 50 }) } };
  }
  if (parte === 'escritorio-resumo') return { status: 200, corpo: montarResumo(await m.listar({ limite: 500 })) };
  if (acao === 'escritorio-ok') {
    if (typeof body.aprovado !== 'boolean') return { status: 400, corpo: { error: 'Diga aprovado: true ou false.' } };
    const r = await m.decidir(body.id, body.aprovado, body.motivo);
    return r.erro ? { status: 409, corpo: { error: r.erro } } : { status: 200, corpo: { recado: r } };
  }
  if (acao === 'escritorio-postar') {
    try { return { status: 200, corpo: { recado: await m.postar({ area: body.area, agente: 'Dono', tipo: body.tipo === 'pedido' ? 'pedido' : 'info', texto: body.texto, para: body.para || '' }) } }; } catch (e) { return { status: 400, corpo: { error: e.message } }; }
  }
  return null;
}

module.exports = { rota };
