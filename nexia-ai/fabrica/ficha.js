'use strict';
// Ficha do sistema novo (fábrica por módulos): o pouco que o dono preenche na Central.
const { sem } = require('./catalogo');

const slugDe = s => sem(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function normalizarFicha(f = {}) {
  let whats = String(f.whatsapp || '').replace(/\D/g, '');
  if (whats && !whats.startsWith('55') && whats.length <= 11) whats = `55${whats}`;
  const lista = v => (Array.isArray(v) ? v : String(v || '').split(','));
  return {
    nome: String(f.nome || '').trim(),
    slug: f.slug ? slugDe(f.slug) : slugDe(f.nome),
    ramo: sem(f.ramo),
    cidade: String(f.cidade || '').trim(),
    whatsapp: whats,
    cores: lista(f.cores).map(x => String(x).trim()).filter(Boolean).slice(0, 3),
    precisa: [...new Set(lista(f.precisa).map(sem).filter(Boolean))],
    fotos: lista(f.fotos).map(x => String(x).trim()).filter(x => /^https:\/\//.test(x)).slice(0, 20),
    textos: f.textos && typeof f.textos === 'object' ? f.textos : {},
  };
}

function validarFicha(f) {
  const e = [];
  if (f.nome.length < 3) e.push('nome obrigatório (3 letras ou mais)');
  if (!/^[a-z0-9-]{3,40}$/.test(f.slug)) e.push('endereço inválido (use letras e números)');
  if (!f.ramo) e.push('ramo obrigatório (ex.: dentista, agência de viagens)');
  if (f.whatsapp && !/^55\d{10,11}$/.test(f.whatsapp)) e.push('WhatsApp com DDD (ex.: 81 99999-9999)');
  return e;
}

module.exports = { normalizarFicha, validarFicha, slugDe };
