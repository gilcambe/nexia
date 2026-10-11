'use strict';
// Respostas simuladas das fontes públicas da região (IBGE, Banco Central, Nominatim, Overpass),
// no mesmo formato que elas devolvem de verdade (copiado de uma consulta real em 11/10/2026).
function fetchRegiao({ cidade = 'São Paulo', id = 3550308, servicos = [26, 37, 28, 54, 29, 68], semMapa = false } = {}) {
  const pedidos = [];
  const json = j => ({ ok: true, json: async () => j });
  const fn = async (url, o = {}) => {
    pedidos.push({ url, o });
    if (/localidades\/estados\/[A-Z]{2}\/municipios/.test(url)) return json([{ id: 3500105, nome: 'Adamantina' }, { id, nome: cidade }]);
    if (/pesquisas\/indicadores/.test(url)) {
      return json([
        { id: 96385, res: [{ localidade: String(id).slice(0, 6), res: { 2010: '11253503', 2022: '11451245' } }] },
        { id: 29171, res: [{ localidade: String(id).slice(0, 6), res: { 2020: '12325232', 2021: '12396372' } }] },
        { id: 47001, res: [{ localidade: String(id).slice(0, 6), res: { 2016: '57071.43', 2021: '66872.84' } }] },
        { id: 29765, res: [{ localidade: String(id).slice(0, 6), res: { 2021: '4.1' } }] },
      ]);
    }
    if (/bcdata\.sgs\.21340/.test(url)) return json(Array.from({ length: 13 }, (_, i) => ({ data: `01/${String(((i + 6) % 12) + 1).padStart(2, '0')}/2026`, valor: String((750 * (1 + 0.0527 * i / 12)).toFixed(2)) })));
    if (/bcdata\.sgs\.432/.test(url)) return json([{ data: '04/11/2026', valor: '13.75' }]);
    if (/nominatim/.test(url)) return json(semMapa ? [] : [{ lat: '-23.5527363', lon: '-46.6539535', class: 'place', type: 'house', addresstype: 'place', display_name: '200, Rua das Palmeiras, Santa Cecília, São Paulo, SP, Brasil', address: { suburb: 'Santa Cecília', city: cidade } }]);
    if (/overpass/.test(url)) return json({ elements: servicos.map(t => ({ type: 'count', tags: { total: String(t) } })) });
    return null;
  };
  return { fn, pedidos };
}
module.exports = { fetchRegiao };
