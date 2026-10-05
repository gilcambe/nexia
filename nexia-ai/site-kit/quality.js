'use strict';
// Padrão mínimo de qualidade do Cortex (ADR-Q-05). O nível do 3º site da clínica (aprovado pelo usuário em
// 2026-10-05) é o PISO: nada abaixo disso é entregue. Erros de conteúdo voltam para o Designer corrigir o spec;
// falta de foto faz o orquestrador buscar de novo. Fontes e contraste o próprio spec.js já corrige sozinho.

const PLACEHOLDER = /lorem ipsum|dolor sit amet|\b(servi[cç]o|item|produto|t[ií]tulo|nome|pergunta|resposta|depoimento) \d\b|\bxxx+\b|\[[^\]]{2,30}\]|a definir|texto aqui|seu texto/i;
const MIN = { sections: 7, services: 3, gallery: 4, testimonials: 3, faq: 4, photos: 6 };

function texts(spec) {
  const out = [spec.name, spec.tagline, spec.description];
  for (const s of spec.sections || []) {
    out.push(s.title, s.subtitle, s.text);
    for (const i of s.items || []) out.push(i.title, i.text, i.q, i.a, i.name, i.label);
    for (const m of s.members || []) out.push(m.name, m.role);
  }
  for (const e of spec.entities || []) { out.push(e.label); for (const r of e.sample || []) out.push(...Object.values(r)); }
  return out.filter(Boolean).map(String);
}

/**
 * @returns {{ content: string[], media: string[], ok: boolean }}
 *   content: o Designer precisa mudar o spec; media: faltam fotos (o orquestrador busca de novo).
 *   Sem `media` (null), confere só o conteúdo.
 */
function qualityCheck(spec, media) {
  const content = [], miss = [];
  const bad = texts(spec).find(t => PLACEHOLDER.test(t));
  if (bad) content.push(`texto genérico/de exemplo: "${bad.slice(0, 60)}" (escreva o texto real do negócio)`);
  if (!spec.tagline) content.push('falta "tagline" (frase curta do negócio)');
  if (spec.kind === 'system') {
    for (const e of spec.entities) {
      if (e.fields.length < 3) content.push(`o cadastro "${e.label}" precisa de pelo menos 3 campos`);
      if (e.sample.length < 4) content.push(`o cadastro "${e.label}" precisa de pelo menos 4 linhas de exemplo (sample) realistas`);
    }
    if (!spec.entities.some(e => e.fields.some(f => f.type === 'select' && f.options.length >= 2)))
      content.push('pelo menos um cadastro precisa de um campo "select" com opções (ex.: status), para o gráfico do painel');
    return { content, media: miss, ok: !content.length };
  }
  const by = t => spec.sections.filter(s => s.type === t);
  const idx = s => spec.sections.indexOf(s);
  const one = t => by(t)[0];
  if (spec.sections.length < MIN.sections) content.push(`o site precisa de pelo menos ${MIN.sections} seções (tem ${spec.sections.length})`);
  for (const t of ['hero', 'services', 'about', 'gallery', 'testimonials', 'faq', 'cta']) if (!one(t)) content.push(`falta a seção "${t}"`);
  if (one('services') && one('services').items.length < MIN.services) content.push(`"services" precisa de pelo menos ${MIN.services} itens`);
  if (one('gallery') && one('gallery').image_queries.length < MIN.gallery) content.push(`"gallery" precisa de pelo menos ${MIN.gallery} buscas de foto (image_queries)`);
  if (one('testimonials') && one('testimonials').items.length < MIN.testimonials) content.push(`"testimonials" precisa de pelo menos ${MIN.testimonials} depoimentos`);
  if (one('faq') && one('faq').items.length < MIN.faq) content.push(`"faq" precisa de pelo menos ${MIN.faq} perguntas`);
  const c = spec.contact;
  if (!c.whatsapp && !c.phone && !c.email) content.push('falta contato (whatsapp, phone ou email)');
  if (!media) return { content, media: miss, ok: !content.length };   // só o conteúdo (antes de buscar fotos)
  // Mídia resolvida: topo com foto ou vídeo, "sobre" com foto, galeria com 4+, e o site inteiro com 6+ fotos.
  const h = one('hero');
  if (h && !media[`s${idx(h)}.hero`] && !media[`s${idx(h)}.video`]) miss.push('o topo (hero) ficou sem foto');
  const ab = one('about');
  if (ab && !media[`s${idx(ab)}.about`]) miss.push('a seção "sobre" ficou sem foto');
  const g = one('gallery');
  const gn = g ? Object.keys(media).filter(k => k.startsWith(`s${idx(g)}.g`) && media[k]).length : 0;
  if (g && gn < MIN.gallery) miss.push(`a galeria ficou com ${gn} foto(s); o mínimo é ${MIN.gallery}`);
  const photos = Object.values(media).filter(m => m && !/^audio\//.test(m.mime || '')).length;
  if (photos < MIN.photos) miss.push(`o site ficou com ${photos} foto(s)/vídeo(s); o mínimo é ${MIN.photos}`);
  return { content, media: miss, ok: !content.length && !miss.length };
}

module.exports = { qualityCheck, MIN, PLACEHOLDER };
