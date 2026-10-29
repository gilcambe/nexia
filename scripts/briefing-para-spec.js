#!/usr/bin/env node
'use strict';
// Converte um briefing markdown num spec do NEXIA Site Kit.
//   node scripts/briefing-para-spec.js clientes/<slug>/briefing.md [clientes/<slug>/site.json]
// Fluxo: IA (Groq -> Gemini -> Mistral -> OpenRouter free -> NVIDIA)
//         -> extractJson -> normalizeSpec -> clientes/<slug>/site.json
// Sem IA: molde do nicho com nome, contatos e serviços do briefing (nunca inventa contatos).
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
  const mP = texto.match(/telefone[^0-9]*([0-9()\s\-\+]{7,})/i) || texto.match(/fone[^0-9]*([0-9()\s\-\+]{7,})/i);
  if (mP) c.phone = mP[1].replace(/\D/g, '');
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

function extrairServicos(texto) {
  const m = texto.match(/serviços?[:\-–]\s*([^\n]{3,200})/i);
  if (!m) return [];
  return m[1].split(/[,;•/]/).map(s => s.trim()).filter(Boolean).slice(0, 6);
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

async function llmChat(modelo, system, user) {
  const headers = { 'Content-Type': 'application/json' };
  let body;
  if (modelo.nome === 'Gemini') {
    headers['x-goog-api-key'] = modelo.chave;
    body = { contents: [{ parts: [{ text: system + '\n\n' + user }] }] };
  } else {
    headers.Authorization = 'Bearer ' + modelo.chave;
    body = { model: modelo.modelo, messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ], temperature: 0.4 };
    if (modelo.nome === 'OpenRouter') {
      headers['HTTP-Referer'] = 'https://nexia.ai';
      headers['X-Title'] = 'NEXIA Site Kit';
    }
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  const init = { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal };
  const res = await fetch(modelo.url, init);
  clearTimeout(t);
  if (!res.ok) throw new Error(modelo.nome + ' ' + res.status);
  const data = await res.json();
  let texto = '';
  if (modelo.nome === 'Gemini') {
    const c = data.candidates?.[0]?.content?.parts?.[0];
    texto = c?.text || '';
  } else {
    texto = data.choices?.[0]?.message?.content || '';
  }
  return texto;
}

async function gerarComIA(message, project) {
  const system = SPEC_SYSTEM;
  const user = specPrompt({ message: message, kind: 'site', project: project });
  for (const m of MODELOS) {
    if (!m.chave) continue;
    try {
      const texto = await llmChat(m, system, user);
      const json = extractJson(texto);
      if (json && json.name) return json;
    } catch { /* tenta o próximo modelo */ }
  }
  return null;
}

function mesclarDesign(spec, slug) {
  const dp = path.join(RAIZ, 'clientes', slug, 'design.json');
  if (!fs.existsSync(dp)) return spec;
  try {
    const d = JSON.parse(fs.readFileSync(dp, 'utf8'));
    if (d.palette && typeof d.palette === 'object') spec.palette = Object.assign({}, spec.palette, d.palette);
    if (d.fonts && typeof d.fonts === 'object') spec.fonts = Object.assign({}, spec.fonts, d.fonts);
    if (typeof d.style === 'string') spec.style = d.style;
    if (typeof d.photo_theme === 'string') spec.photo_theme = d.photo_theme;
    if (Array.isArray(d.sections) && d.sections.length) {
      const ordem = d.sections.map(function (s) { return s && (s.type || s.id || String(s)); }).filter(Boolean);
      const porTipo = {};
      spec.sections.forEach(function (s) { if (s && s.type) porTipo[s.type] = s; });
      const novas = [];
      ordem.forEach(function (t) { if (porTipo[t]) novas.push(porTipo[t]); });
      spec.sections.forEach(function (s) { if (s && novas.indexOf(s) < 0) novas.push(s); });
      spec.sections = novas;
    }
  } catch { /* ignora design invalido */ }
  return spec;
}

async function briefingParaSpec(briefingPath, outputPath) {
  const briefing = fs.readFileSync(briefingPath, 'utf8');
  const slug = slugify(path.basename(path.dirname(briefingPath)) || 'novo-site');
  const contatos = extrairContatos(briefing);
  const nome = extrairNome(briefing) || slug;
  const servicos = extrairServicos(briefing);

  let spec = null;
  let usouMolde = false;

  const jsonIA = await gerarComIA(briefing, slug);
  if (jsonIA) {
    // Contatos vêm direto do briefing; nunca inventar.
    if (contatos.whatsapp) jsonIA.contact = Object.assign({}, jsonIA.contact, { whatsapp: contatos.whatsapp });
    if (contatos.phone) jsonIA.contact = Object.assign({}, jsonIA.contact, { phone: contatos.phone });
    if (contatos.email) jsonIA.contact = Object.assign({}, jsonIA.contact, { email: contatos.email });
    if (contatos.address) jsonIA.contact = Object.assign({}, jsonIA.contact, { address: contatos.address });
    const res = normalizeSpec(jsonIA, { kind: 'site', request: briefing });
    if (res.spec) spec = res.spec;
  }

  if (!spec) {
    usouMolde = true;
    const res = normalizeSpec(moldeNicho(nome, slug, contatos, servicos), { kind: 'site', request: briefing });
    if (!res.spec) throw new Error('nao foi possivel montar o spec (mesmo com molde): ' + res.errors.join('; '));
    spec = res.spec;
  }

  spec = mesclarDesign(spec, slug);

  const out = outputPath || path.join(path.dirname(briefingPath), 'site.json');
  const destino = path.resolve(RAIZ, out);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(spec, null, 2));
  return { spec: spec, output: destino, usouMolde: usouMolde, slug: slug };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('uso: node scripts/briefing-para-spec.js clientes/<slug>/briefing.md [clientes/<slug>/site.json]');
    process.exit(2);
  }
  briefingParaSpec(args[0], args[1]).then(function (r) {
    console.log('spec salvo em ' + r.output + ' (' + (r.usouMolde ? 'molde' : 'ia') + ')');
  }).catch(function (e) {
    console.error(e.message || e);
    process.exit(1);
  });
}

module.exports = { briefingParaSpec: briefingParaSpec };
