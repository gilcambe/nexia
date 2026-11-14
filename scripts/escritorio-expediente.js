#!/usr/bin/env node
'use strict';
// Rodada do EXPEDIENTE (13/11/2026): as áreas trabalham com dados reais e postam no mural (D1).
// Roda pelo workflow escritorio-expediente.yml (8h e 17h de Brasília) ou à mão: node scripts/escritorio-expediente.js [--seco]
const { createMural } = require('../nexia-ai/escritorio/mural');
const ex = require('../nexia-ai/escritorio/expediente');
const { sitesParaConferir, conferirSite } = require('./sentinel');
const { comGroq, extrasGroq } = require('../lib/groq-modelo');

const REPO = process.env.GITHUB_REPOSITORY || 'gilcambe/nexia';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const gh = async (p) => {
  const r = await fetch(`https://api.github.com/repos/${REPO}${p}`, { headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`GitHub ${p} → ${r.status}`);
  return r.json();
};
const busca = async (q) => (await (await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${REPO} ${q}`)}`, { headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json' } })).json()).total_count || 0;

async function ideiasIA() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return '';
  // o nome do modelo morre com o tempo (13/11: o antigo deu 404): comGroq troca sozinho
  const r = await comGroq(key, (model) => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0.7, max_tokens: 300, ...extrasGroq(model, 300), messages: [
      { role: 'system', content: 'Você é redator de Instagram de uma empresa brasileira de tecnologia (KERNEX: sites, sistemas e IA para pequenos negócios; app Body Coach de treino e dieta). Responda só 3 linhas, uma ideia de post por linha, em português simples, sem hashtags, sem promessas de resultado.' },
      { role: 'user', content: 'Dê 3 ideias de post para esta semana.' }] }),
  })).catch(() => null);
  if (!r || !r.ok) return '';
  const j = await r.json().catch(() => ({}));
  return (((j.choices || [])[0] || {}).message || {}).content || '';
}

async function rodar({ mural = createMural(), agora = new Date().toISOString(), log = console.log, seco = process.argv.includes('--seco') } = {}) {
  const recados = [];
  const tentar = async (nome, fn) => { try { recados.push(...await fn()); } catch (e) { log(`${nome}: sem dado agora (${e.message})`); } };
  await tentar('suporte', async () => {
    const { NO_AR } = require('../central/produtos.js');
    const sites = sitesParaConferir(NO_AR);
    const res = await Promise.all(sites.map(async (s) => { const p = await conferirSite(s); return { nome: s.nome, ok: !p, motivo: p ? p.motivo : '' }; }));
    return ex.suporte(res);
  });
  if (TOKEN) {
    await tentar('ti', async () => ex.ti((await gh(`/actions/runs?per_page=100&created=>${agora.slice(0, 10)}`)).workflow_runs.concat((await gh('/actions/runs?per_page=100')).workflow_runs), agora));
    await tentar('producao', async () => {
      const ontem = new Date(Date.parse(agora) - ex.HORAS * 36e5).toISOString().slice(0, 19);
      return ex.producao({
        fechadas24h: await busca(`is:issue is:closed reason:completed closed:>${ontem}`),
        prsJuntados24h: await busca(`is:pr is:merged merged:>${ontem}`),
        naFila: await busca('is:issue is:open label:cortex-fila'),
        travadas: await busca('is:issue is:open label:cortex-travado'),
      });
    });
    await tentar('rh', async () => ex.rh(await gh('/pulls?state=closed&sort=updated&direction=desc&per_page=100'), agora));
  }
  await tentar('marketing', async () => ex.marketing(await ideiasIA()));
  // tira repetidos (o mesmo run aparece nas duas listas da T.I.)
  const vistos = new Set(); const finais = recados.filter((r) => (vistos.has(r.area + r.texto) ? false : vistos.add(r.area + r.texto)));
  finais.forEach((r) => log(`[${r.area}] ${r.tipo}: ${r.texto}`));
  if (seco) return { ok: true, recados: finais };
  if (!mural.ligado()) { log('Escritório sem D1 (NEXIA_D1_TOKEN/NEXIA_D1_ACCOUNT_ID): só mostrei no log.'); return { ok: false, recados: finais }; }
  for (const r of finais) await mural.postar(r);
  log(`postados no mural: ${finais.length}`);
  return { ok: true, recados: finais };
}

module.exports = { rodar };
if (require.main === module) rodar().catch((e) => { console.error('ERRO:', e && e.message); process.exit(1); });
