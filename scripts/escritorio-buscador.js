#!/usr/bin/env node
'use strict';
// Rodada do BUSCADOR (Fase 8, 13/11/2026) — workflow escritorio-buscador.yml (de hora em hora).
// Pega os pedidos "falta X" do mural (para: buscador), busca no GitHub com licença aceita, põe os aprovados em
// nexia-ai/fabrica/prontos.json (o Cortex já consulta esse arquivo ao planejar) e conclui o pedido no mural.
// O workflow commita prontos.json num branch nexia/buscador-* e abre PR (o merge automático junta com CI verde).
const fs = require('node:fs');
const path = require('node:path');
const { createMural } = require('../nexia-ai/escritorio/mural');
const { consultaGithub, avaliar } = require('../nexia-ai/escritorio/buscador');

const PRONTOS = path.join(__dirname, '..', 'nexia-ai', 'fabrica', 'prontos.json');
const LIC_BUSCA = ['mit', 'apache-2.0', 'bsd-3-clause', 'isc'];
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const faltaDe = (texto) => ((/módulo "([^"]+)"/.exec(texto) || [])[1] || '').trim();

async function rodar({ mural = createMural(), gh, prontosPath = PRONTOS, log = console.log, agora = new Date() } = {}) {
  if (!mural.ligado()) { log('sem D1: nada a fazer'); return { ok: false, achados: 0 }; }
  const pedidos = (await mural.listar({ area: 'buscador', tipo: 'pedido', status: 'aberto', limite: 20 })).filter((p) => p.para === 'buscador');
  if (!pedidos.length) { log('nenhum pedido para o Buscador'); return { ok: true, achados: 0, mudou: false }; }
  const p = JSON.parse(fs.readFileSync(prontosPath, 'utf8'));
  const ja = new Set(p.prontos.map((x) => x.repo.toLowerCase()));
  let total = 0;
  for (const ped of pedidos.slice(0, 5)) {
    const falta = faltaDe(ped.texto);
    if (!falta) { await mural.concluir(ped.id, 'pedido sem o nome do módulo'); continue; }
    const itens = [];
    for (const lic of LIC_BUSCA) { try { itens.push(...((await gh(consultaGithub(falta, lic))).items || [])); } catch (e) { log(`busca ${lic}: ${e.message}`); } }
    const bons = avaliar(itens, agora).filter((x) => !ja.has(x.repo.toLowerCase())).slice(0, 3);
    const cat = `buscado-${sem(falta).replace(/ /g, '-').slice(0, 30)}`;
    if (bons.length) {
      p.palavras[cat] = [...new Set([sem(falta), ...sem(falta).split(' ').filter((w) => w.length > 3)])];
      for (const b of bons) { p.prontos.push({ repo: b.repo, url: `https://github.com/${b.repo}`, categoria: cat, uso: `${b.uso} (achado pelo Buscador para "${falta}")`, licenca: b.licenca, estrelas: b.estrelas, atualizado: b.atualizado, linguagem: '-', tipo: 'peca', servidor: false }); ja.add(b.repo.toLowerCase()); }
      total += bons.length;
    }
    const res = bons.length ? `Achei ${bons.length}: ${bons.map((b) => `${b.repo} (${b.licenca}, ${b.estrelas}⭐)`).join('; ')}. Já está na Biblioteca do Cortex.` : 'Nada confiável (licença aceita, ativo, 50+ estrelas). Vira tarefa de criar módulo próprio.';
    await mural.concluir(ped.id, res);
    await mural.postar({ area: 'buscador', agente: 'Catalogador', tipo: bons.length ? 'feito' : 'alerta', para: 'producao', texto: `"${falta}": ${res}` });
    log(`"${falta}": ${res}`);
  }
  if (total) fs.writeFileSync(prontosPath, JSON.stringify(p, null, 1) + '\n');
  return { ok: true, achados: total, mudou: total > 0 };
}

module.exports = { rodar, faltaDe };
if (require.main === module) {
  const token = process.env.GITHUB_TOKEN || '';
  const gh = async (caminho) => {
    const r = await fetch('https://api.github.com' + caminho, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'kernex-buscador', ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    return r.json();
  };
  rodar({ gh }).then((r) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `mudou=${r.mudou ? 'sim' : 'nao'}\nachados=${r.achados}\n`); })
    .catch((e) => { console.error('ERRO:', e && e.message); process.exit(1); });
}
