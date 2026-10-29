#!/usr/bin/env node
'use strict';
// Converte um briefing markdown num spec do NEXIA Site Kit.
//   node scripts/briefing-para-spec.js clientes/<slug>/briefing.md [clientes/<slug>/site.json]
// Fluxo: IA (Groq -> Gemini -> Mistral -> OpenRouter free -> NVIDIA) -> extractJson -> normalizeSpec -> site.json
// Sem IA: molde do nicho (nome, contatos e serviços do briefing).
const fs = require('fs');
const path = require('path');
const { extractJson, normalizeSpec, slugify } = require('../nexia-ai/site-kit/spec');
const { SPEC_SYSTEM, specPrompt } = require('../nexia-ai/site-kit/prompt');

const RAIZ = path.resolve(__dirname, '..');

const MODELOS = [
  { nome: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', chave: process.env.GROQ_API_KEY, modelo: 'llama-3.1-8b-instant' },
  { nome: 'Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent', chave: process.env.GEMINI_API_KEY },
  { nome: 'Mistral', url: 'https://api.mistral.ai/v1/chat/completions', chave: process.env.MISTRAL_API_KEY, modelo: 'mistral-small-latest' },
  { nome: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', chave: process.env.OPENROUTER_API_KEY, modelo: 'openrouter/auto' },
  { nome: 'NVIDIA', url: 'https://integrate.api.nvidia.com/v1/chat/completions', chave: process.env.NVIDIA_API_KEY, modelo: 'meta/llama-3.1-8b-instruct' },
];

function extrairContatos(texto) {
  const c = {};
  const mW = texto.match(/whatsapp[^0-9]*([0-9()\s\-\+]{7,})/i) || texto.match(/wa\.me\/([0-9]{7,})/i);
  if (mW) c.whatsapp = mW[1].replace(/\D/g, '');
  const mE = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (mE) c.email = mE[0];
  const mA = texto.match(/(rua|avenida|av\.?|alameda|travessa)\s+[^\n,]{3,}/i);
  if (mA) c.address = mA[0].trim();
  return c;
}

function extrairNome(texto) {
  const m = texto.match(/^#\s+(.{3,60})$/m) || texto.match(/nome[:–\-]\s*([^\n]{3,60})/i);
  return m ? m[1].trim() : null;
}

function moldeNicho(nome, slug, contatos, servicos) {
  return {
    kind: 'site', name: nome || 'Meu Negócio', tagline: '', description: '',
    folder: `clientes/${slug}`, style: 'modern', photo_theme: 'business professional',
    fonts: { heading: 'Poppins', body: 'Inter' },
    palette: { primary: '#1f6f5c', accent: '#f2a541', bg: '#fbfaf7', surface: '#ffffff', text: '#1d2426', muted: '#5d6b6e', dark: '#12201d' },
    contact: contatos,
    sections: [
      { type: 'hero', eyebrow: nome, title: 'Bem-vindo ao ' + (nome || 'nosso negócio'), subtitle: 'Atendimento de qualidade para você.', cta: { label: 'Fale pelo WhatsApp', href: 'whatsapp' } },
      { type: 'services', id: 'servicos', title: 'Nossos serviços', subtitle: 'O que fazemos de melhor.', items: (servicos || []).map(s => ({ title: s, text: '', image_query: '' })) },
      { type: 'about', title: 'Sobre nós', text: 'Conheça nossa história.', stats: [] },
      { type: 'testimonials', title: 'Depoimentos', items: [] },
      { type: 'faq', title: 'Dúvidas frequentes', items: [] },
      { type: 'cta', title: 'Entre em contato', subtitle: 'Resposta rápida.', cta: { label: 'WhatsApp', href: 'whatsapp' } },
      { type: 'contact', title: 'Fale com a gente' },
    ],
  };
}

async function httpJson(modelo, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  let init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal };
  if (modelo.nome === 'Gemini') init = { method: 'POST', headers: {}, body: JSON.stringify(body), signal: ctrl.signal };
  else if (modelo.nome === 'NVIDIA') init.headers.Authorization = `Bearer ${modelo.chave}`;
  else init.headers.Authorization = `Bearer ${modelo.chave}`;
  const res = await fetch(modelo.url, init);
  clearTimeout(t);
  if (!res.ok) throw new Error(`${modelo.nome} ${res.status}`);
  return res.json();
}

async function textoIA(modelo, system, user) {
  const dados = {
    Groq: { model: modelo.modelo, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.4 },
    Gemini: { contents: [{ parts: [{ text: system + '\n\n' + user }] }] },
    Mistral: { model: modelo.modelo, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.4 },
    OpenRouter: { model: modelo.modelo, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.4 },
    NVIDIA: { model: modelo.modelo, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.4 },
  }[modelo.nome];
  const r = await httpJson(modelo, dados);
  if (modelo.nome === 'Gemini') return r.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return r.choices?.[0]?.message?.content || '';
}

async function gerarComIA(message, project) {
  const system = SPEC_SYSTEM;
  const user = specPrompt({ message, kind: 'site', project });
  for (const m of MODELOS) {
    if (!m.chave) continue;
    try {
      const texto = await textoIA(m, system, user);
      const json = extractJson(texto);
      if (json && json.name) return json;
    } catch { /* tenta o próximo */ }
  }
  return null;
}

function mesclarDesign(spec, slug) {
  const dp = path.join(RAIZ, 'clientes', slug, 'design.json');
  if (!fs.existsSync(dp)) return spec;
  try {
    const d = JSON.parse(fs.readFileSync(dp, 'utf8'));
    if (d.palette) spec.palette = { ...spec.palette, ...d.palette };
    if (d.fonts) spec.fonts = { ...spec.fonts, ...d.fonts };
    if (d.style) spec.style = d.style;
    if (d.photo_theme) spec.photo_theme = d.photo_theme;
    if (Array.isArray(d.sections) && d.sections.length) spec.sections = d.sections;
  } catch { /* ignora design invalido */ }
  return spec;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('uso: node scripts/briefing-para-spec.js clientes/<slug>/briefing.md [clientes/<slug>/site.json]');
    process.exit(2);
  }
  const briefingPath = args[0];
  const outputPath = args[1] || path.join(path.dirname(briefingPath), 'site.json');
  const briefing = fs.readFileSync(briefingPath, 'utf8');
  const slug = slugify(path.basename(path.dirname(briefingPath)) || 'novo-site');
  const contatos = extrairContatos(briefing);
  const nome = extrairNome(briefing) || slug;

  let specJson = await gerarComIA(briefing, slug);
  const usouMolde = !specJson;
  if (usouMolde) {
    const servicos = briefing.match(/serviço[s]?[:–\-]\s*([^\n]+)/i);
    specJson = moldeNicho(nome, slug, contatos, servicos ? [servicos[1]] : []);
  } else {
    specJson.contact = { ...specJson.contact, ...contatos };
  }

  specJson = mesclarDesign(specJson, slug);

  const { spec, errors } = normalizeSpec(specJson, { kind: 'site', request: briefing });
  if (!spec) {
    console.error('spec inválido: ' + errors.join('; '));
    process.exit(1);
  }

  const out = path.resolve(RAIZ, outputPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(spec, null, 2));
  console.log(`spec salvo em ${outputPath} (${usouMolde ? 'molde' : 'ia'})`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
