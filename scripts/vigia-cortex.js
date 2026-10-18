#!/usr/bin/env node
'use strict';
// Vigia do Cortex: se a fila parou, abre a issue "cortex-alerta" para o dono (o GitHub manda e-mail).

const REPO = process.env.REPO || 'gilcambe/nexia';
const DONO = process.env.DONO || 'gilcambe';
const PAINEL = 'https://nexia.gcbezerra.workers.dev/meu-cortex';

async function gh(token, method, caminho, body) {
  const r = await fetch('https://api.github.com/repos/' + REPO + caminho, { method, body: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'nexia-vigia', 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error(method + ' ' + caminho + ' -> ' + r.status);
  return r.status === 204 ? {} : r.json();
}

const nomes = (i) => (i.labels || []).map((l) => l.name || l);
const parteDe = (i) => { const m = /^\[Parte (\d+)\/\d+ de #(\d+)\]/.exec(i.title || ''); return m ? { k: Number(m[1]), pai: Number(m[2]) } : null; };

// Uma parte que espera outra parte travada do mesmo pai também está parada.
function diagnosticar(abertas, ultimaEntrega, agora = Date.now()) {
  const so = abertas.filter((i) => !i.pull_request && !nomes(i).includes('cortex-dividido'));
  const travadas = so.filter((i) => nomes(i).includes('cortex-travado'));
  const paiTravado = new Map();
  for (const t of travadas) { const p = parteDe(t); if (p) paiTravado.set(p.pai, Math.min(paiTravado.get(p.pai) || 1e9, p.k)); }
  const andando = so.filter((i) => {
    if (nomes(i).includes('cortex-travado')) return false;
    const p = parteDe(i);
    return !(p && paiTravado.has(p.pai) && p.k > paiTravado.get(p.pai));
  });
  const horas = ultimaEntrega ? (agora - new Date(ultimaEntrega).getTime()) / 36e5 : 999;
  const motivos = [];
  if (!andando.length && travadas.length) motivos.push('Tudo o que está na fila está travado ou esperando uma parte travada.');
  if (!so.length) motivos.push('A fila está vazia: o Cortex não tem o que fazer.');
  if (andando.length && horas > 24) motivos.push('Nada foi entregue nas últimas ' + Math.round(horas) + ' horas.');
  return { parado: motivos.length > 0, motivos, travadas: travadas.map((i) => i.number), andando: andando.length };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Falta GITHUB_TOKEN.');
  const abertas = await gh(token, 'GET', '/issues?state=open&labels=cortex-fila&per_page=100');
  const feitas = await gh(token, 'GET', '/issues?state=closed&labels=cortex-feito&sort=updated&direction=desc&per_page=1');
  const d = diagnosticar(abertas, feitas[0] && feitas[0].closed_at);
  const alerta = (await gh(token, 'GET', '/issues?state=open&labels=cortex-alerta&per_page=5'))[0];
  console.log(JSON.stringify(d));
  if (d.parado && !alerta) {
    await gh(token, 'POST', '/issues', { title: '⚠️ O Cortex parou: precisa de você', labels: ['cortex-alerta'], assignees: [DONO],
      body: d.motivos.join('\n') + '\n\nTravadas: ' + (d.travadas.map((n) => '#' + n).join(', ') || 'nenhuma')
        + '\n\nO que fazer (no celular): abra ' + PAINEL + ', toque em "Travados" e use "Tentar de novo", "Cancelar" ou mande um pedido novo e menor.' });
  } else if (!d.parado && alerta) {
    await gh(token, 'POST', '/issues/' + alerta.number + '/comments', { body: 'A fila voltou a andar. Fechando o alerta.' });
    await gh(token, 'PATCH', '/issues/' + alerta.number, { state: 'closed', state_reason: 'completed' });
  }
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { diagnosticar };
