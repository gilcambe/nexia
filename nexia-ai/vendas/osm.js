'use strict';
// Prospecção (Fase 4, 13/11/2026): negócios de um RAMO numa CIDADE pelo OpenStreetMap (Overpass API, grátis, sem
// chave). Só dados comerciais públicos (nome, telefone, site, endereço do estabelecimento). "Sem site" = cliente ideal.
// Puro + uma função de rede (buscar) que recebe fetch, para testar sem internet.

// ramo (como o dono fala) → filtros OSM
const RAMOS = {
  barbearia: ['shop=hairdresser'], salao: ['shop=hairdresser', 'shop=beauty'], estetica: ['shop=beauty'],
  restaurante: ['amenity=restaurant'], lanchonete: ['amenity=fast_food', 'amenity=cafe'], pizzaria: ['amenity=restaurant][cuisine=pizza', 'amenity=fast_food][cuisine=pizza'],
  padaria: ['shop=bakery'], doceria: ['shop=confectionery', 'shop=pastry'], academia: ['leisure=fitness_centre'],
  dentista: ['amenity=dentist', 'healthcare=dentist'], clinica: ['amenity=clinic', 'amenity=doctors', 'healthcare=clinic'],
  psicologo: ['healthcare=psychotherapist'], petshop: ['shop=pet'], veterinario: ['amenity=veterinary'],
  advocacia: ['office=lawyer'], contabilidade: ['office=accountant'], imobiliaria: ['office=estate_agent'],
  oficina: ['shop=car_repair'], hotel: ['tourism=hotel', 'tourism=guest_house'], escola: ['amenity=school', 'amenity=language_school', 'amenity=driving_school'],
  igreja: ['amenity=place_of_worship'], loja: ['shop=clothes', 'shop=shoes', 'shop=gift'], otica: ['shop=optician'],
  floricultura: ['shop=florist'], mercado: ['shop=supermarket', 'shop=convenience'], farmacia: ['amenity=pharmacy'],
  fotografo: ['craft=photographer', 'shop=photo'], construtora: ['office=construction_company', 'craft=builder'],
};
const sem = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const APELIDOS = { 'pet shop': 'petshop', 'salao de beleza': 'salao', clinicas: 'clinica', 'clinica medica': 'clinica', advogado: 'advocacia', advogados: 'advocacia', contador: 'contabilidade', 'mecanica': 'oficina', 'oficina mecanica': 'oficina', pousada: 'hotel', 'loja de roupas': 'loja', cafeteria: 'lanchonete', barbeiro: 'barbearia', nutricionista: 'clinica' };

/** "Pet shop" → "petshop"; desconhecido → null. */
function ramoId(ramo) {
  const r = sem(ramo);
  if (RAMOS[r]) return r;
  if (APELIDOS[r]) return APELIDOS[r];
  const k = Object.keys(RAMOS).find((x) => r.includes(x) || x.includes(r));
  return k || null;
}

const aspas = (s) => String(s).replace(/["\\]/g, '');
/** Consulta Overpass: negócios do ramo dentro do município (admin_level 8) com esse nome, no Brasil. */
function montarConsulta(ramo, cidade, limite = 80) {
  const id = ramoId(ramo);
  if (!id) throw new Error('ramo desconhecido: ' + ramo);
  const c = aspas(String(cidade || '').trim());
  if (!c) throw new Error('cidade vazia');
  const filtros = RAMOS[id].map((f) => `nwr[${f.split('][').map((p) => p.replace('=', '="') + '"').join('][')}](area.c);`).join('');
  return `[out:json][timeout:25];area["ISO3166-1"="BR"]->.br;area(area.br)["name"="${c}"]["admin_level"="8"]->.c;(${filtros});out tags center ${Math.max(1, Math.min(200, limite))};`;
}

/** Telefone BR → 55DDDNÚMERO para wa.me (ou '' se não der). */
function telefoneWhats(t) {
  let d = String(t || '').split(/[;,/]/)[0].replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d;
  return /^55\d{10,11}$/.test(d) ? d : '';
}

/** Elementos do Overpass → prospects (só com nome; ordena: quente = tem telefone e NÃO tem site). */
function normalizar(json, { ramo, cidade }) {
  const id = ramoId(ramo);
  return ((json && json.elements) || []).map((e) => {
    const t = e.tags || {};
    const tel = t.phone || t['contact:phone'] || t['contact:mobile'] || t['contact:whatsapp'] || '';
    const site = t.website || t['contact:website'] || t.url || '';
    const insta = t['contact:instagram'] || '';
    const end = [t['addr:street'], t['addr:housenumber'], t['addr:suburb']].filter(Boolean).join(', ');
    const whats = telefoneWhats(t['contact:whatsapp'] || tel);
    const temSite = !!site;
    return { id: `osm-${e.type}-${e.id}`, nome: String(t.name || '').slice(0, 120), ramo: id, cidade: String(cidade).slice(0, 80),
      telefone: String(tel).slice(0, 40), whatsapp: whats, site: String(site).slice(0, 200), instagram: String(insta).slice(0, 120), endereco: end.slice(0, 200),
      temSite, quente: !temSite && !!whats, fonte: 'OpenStreetMap' };
  }).filter((p) => p.nome)
    .sort((a, b) => Number(b.quente) - Number(a.quente) || Number(!!b.whatsapp) - Number(!!a.whatsapp) || a.nome.localeCompare(b.nome));
}

const OVERPASS = 'https://overpass-api.de/api/interpreter';
/** Rede: busca no Overpass. fetchFn injetável. */
async function buscar({ ramo, cidade, limite = 80 }, fetchFn = fetch) {
  const q = montarConsulta(ramo, cidade, limite);
  const r = await fetchFn(OVERPASS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'KERNEX-prospeccao/1.0 (kernex.com.br)' }, body: 'data=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error(`OpenStreetMap respondeu ${r.status} (tente de novo em 1 min)`);
  return normalizar(await r.json(), { ramo, cidade });
}

module.exports = { RAMOS, ramoId, montarConsulta, telefoneWhats, normalizar, buscar, OVERPASS };
