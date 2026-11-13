'use strict';
// MURAL da KERNEX (Fase 8, 13/11/2026): onde os agentes das áreas conversam entre si e pedem o OK do dono.
// D1 grátis, coleção "escritorio_mural". Cada recado:
//   { id, area, agente, tipo: 'info'|'pedido'|'precisa-ok'|'feito'|'alerta', texto, para?: area, ref?: {tipo,id,url},
//     status: 'aberto'|'feito'|'aprovado'|'recusado', em, decidido_em?, decisao_motivo? }
// 'precisa-ok' só muda de status pelo dono (decidir). Nada aqui envia mensagem, cobra ou publica: é só o registro.
const crypto = require('crypto');
const { area: acharArea } = require('./areas');

const TIPOS = ['info', 'pedido', 'precisa-ok', 'feito', 'alerta'];
const COL = 'escritorio_mural';

function driverPadrao(env) {
  if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return null;
  return require('../../lib/firebase-lite/d1-backend').createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
}

function createMural({ env = process.env, driver, agora = () => new Date() } = {}) {
  const d = () => driver || (driver = driverPadrao(env));
  const iso = () => agora().toISOString();
  const up = (path, fields, create_time) => ({ type: 'upsert', path, fields, create_time: create_time || iso(), update_time: iso() });
  const limpa = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

  /** Um agente escreve no mural. Devolve o recado gravado. */
  async function postar({ area, agente = '', tipo = 'info', texto, para = '', ref = null }) {
    if (!acharArea(area)) throw new Error('área inválida: ' + area);
    if (!TIPOS.includes(tipo)) throw new Error('tipo inválido: ' + tipo);
    if (!limpa(texto, 1)) throw new Error('texto vazio');
    if (para && !acharArea(para)) throw new Error('área de destino inválida: ' + para);
    const id = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const fields = { id, area, agente: limpa(agente, 60), tipo, texto: limpa(texto, 600), para: para || '',
      ref: ref ? { tipo: limpa(ref.tipo, 30), id: limpa(ref.id, 80), url: /^https:\/\//.test(String(ref.url || '')) ? limpa(ref.url, 300) : '' } : null,
      status: tipo === 'feito' ? 'feito' : 'aberto', em: iso() };
    await d().apply([up(`${COL}/${id}`, fields)]);
    return fields;
  }

  /** Últimos recados (mais novos primeiro). Filtros opcionais: area, tipo, status. */
  async function listar({ area = '', tipo = '', status = '', limite = 50 } = {}) {
    const todos = (await d().list('', COL, false)).map((x) => x.fields)
      .filter((r) => (!area || r.area === area || r.para === area) && (!tipo || r.tipo === tipo) && (!status || r.status === status));
    return todos.sort((a, b) => (a.em < b.em ? 1 : -1)).slice(0, Math.max(1, Math.min(500, limite)));
  }

  /** O dono aprova ou recusa um 'precisa-ok'. */
  async function decidir(id, aprovado, motivo = '') {
    const path = `${COL}/${String(id || '').replace(/[^a-z0-9-]/gi, '')}`;
    const atual = (await d().get([path])).get(path);
    if (!atual) return { erro: 'recado não existe' };
    if (atual.fields.tipo !== 'precisa-ok') return { erro: 'este recado não pede OK' };
    if (atual.fields.status !== 'aberto') return { erro: 'já foi decidido' };
    const fields = { ...atual.fields, status: aprovado ? 'aprovado' : 'recusado', decidido_em: iso(), decisao_motivo: limpa(motivo, 300) };
    await d().apply([up(path, fields, atual.create_time)]);
    return fields;
  }

  /** A área que recebeu um 'pedido' marca como feito (com o que fez). 'precisa-ok' não: esse só o dono decide. */
  async function concluir(id, resultado = '') {
    const path = `${COL}/${String(id || '').replace(/[^a-z0-9-]/gi, '')}`;
    const atual = (await d().get([path])).get(path);
    if (!atual) return { erro: 'recado não existe' };
    if (atual.fields.tipo === 'precisa-ok') return { erro: 'só o dono decide este recado' };
    if (atual.fields.status !== 'aberto') return { erro: 'já foi concluído' };
    const fields = { ...atual.fields, status: 'feito', concluido_em: iso(), resultado: limpa(resultado, 400) };
    await d().apply([up(path, fields, atual.create_time)]);
    return fields;
  }

  return { postar, listar, decidir, concluir, ligado: () => !!d() };
}

module.exports = { createMural, TIPOS };
