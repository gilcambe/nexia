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

/** Jurídico: a página inicial tem link para privacidade/LGPD? null = não dá para conferir (app montado no navegador ou API). */
async function temPrivacidade(url) {
  if (!url) return null;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' });
  if (!/html/i.test(r.headers.get('content-type') || '')) return null;
  const html = await r.text();
  if (/privacidade|privacy|lgpd/i.test(html)) return true;
  const texto = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return texto.length < 200 ? null : false;   // casca vazia de app: o texto só aparece no navegador
}

// Prospecção: comércio do mapa aberto (OpenStreetMap/Overpass, grátis) SEM a etiqueta website. Só lê; ninguém é contatado.
const RAMOS = { hairdresser: 'cabeleireiro', beauty: 'estética', dentist: 'dentista', restaurant: 'restaurante', cafe: 'café', bakery: 'padaria', car_repair: 'oficina', veterinary: 'veterinário' };
// Uma região por turno (a cidade inteira é grande demais para o serviço grátis responder a tempo). Troque pela variável
// PROSPECCAO_REGIOES no workflow: "Nome|sul,oeste,norte,leste;Nome2|...". O turno escolhe a região pelo dia do ano.
const REGIOES_PADRAO = 'Av. Paulista (São Paulo)|-23.575,-46.672,-23.552,-46.640;Pinheiros (São Paulo)|-23.575,-46.705,-23.555,-46.675;Moema (São Paulo)|-23.610,-46.675,-23.590,-46.650;Tatuapé (São Paulo)|-23.550,-46.585,-23.530,-46.560';
function regiaoDoDia(texto = process.env.PROSPECCAO_REGIOES || REGIOES_PADRAO, agora = new Date()) {
  const lista = texto.split(';').map((x) => x.split('|')).filter((x) => x.length === 2 && /^-?[0-9.]+,-?[0-9.]+,-?[0-9.]+,-?[0-9.]+$/.test(x[1].trim()));
  const dia = Math.floor(Date.parse(agora.toISOString().slice(0, 10)) / 864e5);
  const [nome, caixa] = lista[dia % lista.length]; return { nome: nome.trim(), caixa: caixa.trim() };
}
async function semSite({ nome, caixa } = regiaoDoDia()) {
  const filtros = ['shop~"^(hairdresser|beauty|bakery|car_repair)$"', 'amenity~"^(dentist|restaurant|cafe|veterinary)$"']
    .map((f) => `nwr[${f}][name][!website][!"contact:website"](${caixa});`).join('');
  const q = `[out:json][timeout:25];(${filtros});out tags 400;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'KERNEX-Escritorio/1.0', accept: 'application/json' }, signal: AbortSignal.timeout(40000) });
  if (!r.ok) throw new Error('mapa aberto HTTP ' + r.status);
  const el = ((await r.json()).elements || []).filter((e) => e.tags && e.tags.name);
  const ramo = (t) => RAMOS[t.shop] || RAMOS[t.amenity] || 'comércio';
  return { cidade: nome, total: el.length, cheio: el.length >= 400, exemplos: el.slice(0, 3).map((e) => ({ nome: e.tags.name, ramo: ramo(e.tags) })) };
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
  await tentar('juridico', async () => {
    const { NO_AR } = require('../central/produtos.js');
    const sites = sitesParaConferir(NO_AR);
    return ex.juridico(await Promise.all(sites.map(async (s) => ({ nome: s.nome, temPrivacidade: await temPrivacidade(s.url || s.site) }))));
  });
  await tentar('prospeccao', async () => ex.prospeccao(await semSite()));
  recados.push(...ex.consultor(recados));
  // tira repetidos (o mesmo run aparece nas duas listas da T.I.)
  const vistos = new Set(); const finais = recados.filter((r) => (vistos.has(r.area + r.texto) ? false : vistos.add(r.area + r.texto)));
  finais.forEach((r) => log(`[${r.area}] ${r.tipo}: ${r.texto}`));
  if (seco) return { ok: true, recados: finais };
  if (!mural.ligado()) { log('Escritório sem D1 (NEXIA_D1_TOKEN/NEXIA_D1_ACCOUNT_ID): só mostrei no log.'); return { ok: false, recados: finais }; }
  for (const r of finais) await mural.postar(r);
  log(`postados no mural: ${finais.length}`);
  return { ok: true, recados: finais };
}

module.exports = { rodar, regiaoDoDia };
if (require.main === module) rodar().catch((e) => { console.error('ERRO:', e && e.message); process.exit(1); });
