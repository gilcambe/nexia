'use strict';
// NEXIA · Central de Leilões (Bezsan): o "agente de leilão" do painel do dono.
//
// Só funciona para agendas com `leilao: true` em clientes/agendas.js e só com o painel logado
// (o mesmo token da NEXIA Agenda, ou o Bearer do master). Nada pago:
//   - IA: a lista GRÁTIS do Model Router (Groq, GitHub Models, Gemini, ... Kilo), sem Anthropic.
//   - Processo judicial: API pública do CNJ (DataJud), com a chave pública que o próprio CNJ publica.
//   - Imóveis: agenda_contas/<slug>/imoveis/<id> (Firestore grátis).
// O que pede login/captcha (prefeitura, condomínio, cartório, site da Caixa) não é raspado: a página
// mostra o passo a passo e o dono digita o que encontrou.
//
// POST (texto JSON) { site, token, acao, ... }
//   analisar  { tipo: 'edital'|'matricula', texto?, imagens?: ['data:image/jpeg;base64,...'] } → { dados }
//   parecer   { imovel, conta }                                                            → { texto }
//   processo  { numero }                                                                   → { processo }
//   buscar    { busca, uf? }   → imóveis de vários leiloeiros pela API pública do Leilões Judiciais → { imoveis }
//   arquivo   { url }          → PDF público de um lote (edital, matrícula) em base64, para a página ler
//   listar | salvar { imovel } | apagar { id }

const COLLECTION = 'agenda_contas';
const SLUG_RE = /^[a-z0-9-]{3,40}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TEXTO_MAX = 60000;
const IMAGENS_MAX = 4;
const IMAGEM_MAX = 1400000; // base64
const IMOVEL_MAX = 60 * 1024;
const IMOVEIS_MAX = 300;
const IA_POR_HORA = 60;
// Chave pública do DataJud, publicada pelo CNJ em https://datajud-wiki.cnj.jus.br/api-publica/acesso
// (troca de tempos em tempos: DATAJUD_API_KEY muda sem mexer no código).
const DATAJUD_CHAVE = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(s) { return hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }

// ── Processo judicial (número CNJ NNNNNNN-DD.AAAA.J.TR.OOOO → tribunal no DataJud) ──
const TJ = { '01': 'ac', '02': 'al', '03': 'ap', '04': 'am', '05': 'ba', '06': 'ce', '07': 'dft', '08': 'es', '09': 'go', 10: 'ma', 11: 'mt', 12: 'ms', 13: 'mg', 14: 'pa', 15: 'pb', 16: 'pr', 17: 'pe', 18: 'pi', 19: 'rj', 20: 'rn', 21: 'rs', 22: 'ro', 23: 'rr', 24: 'sc', 25: 'se', 26: 'sp', 27: 'to' };
function tribunalDoProcesso(numero) {
  const d = String(numero || '').replace(/\D/g, '');
  if (d.length !== 20) return null;
  const j = d[13];
  const tr = d.slice(14, 16);
  let alias = null;
  if (j === '8' && TJ[tr]) alias = 'tj' + TJ[tr];
  else if (j === '4' && Number(tr) >= 1 && Number(tr) <= 6) alias = 'trf' + Number(tr);
  else if (j === '5' && Number(tr) >= 1 && Number(tr) <= 24) alias = 'trt' + Number(tr);
  return alias ? { numero: d, alias } : null;
}
// Movimentações que pesam para quem arremata (procura em todas, não só nas últimas).
const SINAIS_RE = /embargo|agravo|apela|recurso|suspens|sobrest|nulidade|anula|impugna|arremata|adjudica|remi[cç]|acordo|homologa|extin|arquiv|cancel|desist/i;
function sinaisDoProcesso(movs) {
  const vistos = new Map();
  for (const m of movs) {
    const nome = str(m && m.nome, 120);
    if (!nome || !SINAIS_RE.test(nome) || vistos.has(nome)) continue;
    vistos.set(nome, { data: m.dataHora, nome });
  }
  return [...vistos.values()].slice(0, 20);
}
function resumirProcesso(src) {
  const movs = Array.isArray(src.movimentos) ? src.movimentos.slice() : [];
  movs.sort((a, b) => String(b.dataHora || '').localeCompare(String(a.dataHora || '')));
  return {
    numero: src.numeroProcesso,
    tribunal: src.tribunal,
    classe: src.classe && src.classe.nome,
    assuntos: (src.assuntos || []).map(a => a && a.nome).filter(Boolean),
    orgao: src.orgaoJulgador && src.orgaoJulgador.nome,
    ajuizado_em: src.dataAjuizamento,
    atualizado_em: src.dataHoraUltimaAtualizacao,
    movimentos: movs.slice(0, 15).map(m => ({ data: m.dataHora, nome: m.nome })),
    sinais: sinaisDoProcesso(movs),
  };
}

// ── Busca automática: API pública do Leilões Judiciais (www.leiloesjudiciais.com.br/api/openapi.json:
// "Acesso público, sem autenticação"; robots.txt: ai-input=yes). Junta lotes de vários leiloeiros do país.
// Os outros portais testados bloqueiam robôs (Cloudflare/captcha) ou proíbem cópia nos termos: ficam como links. ──
const LJ_MCP = 'https://www.leiloesjudiciais.com.br/api/mcp/messages';
const LJ_SITE = 'https://www.leiloesjudiciais.com.br';
const ANEXO_RE = /^https:\/\/s3-sa-east-1\.amazonaws\.com\/906de634c48fb7d34136160b4c353ae4\/public\/anexo\/[A-Za-z0-9_-]{1,80}\.pdf$/;
const ARQUIVO_MAX = 12 * 1024 * 1024;
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
const _cacheBusca = new Map();

const semHtml = h => String(h || '').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const reaisNum = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
function valorNoTexto(texto, rotulo) {
  const m = new RegExp(rotulo + '[^R]{0,40}R\\$\\s*([\\d.]+,\\d{2})', 'i').exec(texto);
  return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : 0;
}
function loteParaImovel(r) {
  if (!r || typeof r !== 'object') return null;
  const texto = semHtml(r.nm_descricao).slice(0, 6000);
  const avaliacao = valorNoTexto(texto, 'avalia[cç][aã]o') || (r.bn_exibeavaliacao ? reaisNum(r.vl_lanceminimo) : 0);
  const lance = reaisNum(r.vl_lanceinicialsegundoleilao) || reaisNum(r.vl_lanceinicial) || reaisNum(r.vl_lanceminimo);
  const proc = /\b(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})\b/.exec(texto);
  const leilaoId = String(r.leilao_id || '').replace(/\D/g, '');
  const loteId = String(r.lote_id || '').replace(/\D/g, '');
  if (!loteId) return null;
  const anexos = (Array.isArray(r.anexos) ? r.anexos : []).filter(a => a && ANEXO_RE.test(String(a.nm_path_completo || ''))).slice(0, 8).map(a => ({ nome: String(a.nm || 'Anexo').slice(0, 60), url: a.nm_path_completo }));
  return {
    fonte: 'Leilões Judiciais', lote_id: loteId, titulo: String(r.nm_titulo_lote || '').slice(0, 200), leilao: String(r.nm_titulo_leilao || '').slice(0, 200),
    cidade: String(r.nm_cidade || '').slice(0, 80), uf: String(r.nm_estado || '').toUpperCase().slice(0, 2), tipo: String(r.nm_subcategoria || '').slice(0, 60),
    lance, avaliacao, desconto: avaliacao && lance ? Math.round((1 - lance / avaliacao) * 1000) / 10 : 0,
    fechamento: String(r.dt_fechamento || '').slice(0, 25), situacao: String(r.nm_statuslote || '').slice(0, 60),
    leiloeiro: String(r.nm_leiloeiro || '').slice(0, 100), parcelas: Number(r.nu_parcelas) || 0, entrada_pct: Number(r.vl_percentualentrada) || 0,
    processo: proc ? proc[1] : '', descricao: texto,
    link: leilaoId ? `${LJ_SITE}/lote/${leilaoId}/${loteId}` : LJ_SITE, anexos,
    judicial: /judicial/i.test(String(r.nm_titulo_leilao || '')) && !/extrajudicial/i.test(String(r.nm_titulo_leilao || '')),
  };
}
async function buscarLeiloesJudiciais(fetchFn, { busca, uf }, now) {
  const chave = busca + '|' + uf;
  const c = _cacheBusca.get(chave);
  if (c && now - c.em < 10 * 60000) return c.lista;
  const args = { query: busca, categoria: 'imoveis' };
  if (uf) args.estado = uf;
  const r = await fetchFn(LJ_MCP, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'NexiaBezsan/1.0 (+https://bezsan.pages.dev)' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_leiloes', arguments: args } }) });
  if (!r.ok) throw new Error('fonte');
  const j = await r.json();
  const texto = j && j.result && Array.isArray(j.result.content) && j.result.content[0] && j.result.content[0].text;
  const dados = JSON.parse(texto || '{}');
  const lista = (Array.isArray(dados.results) ? dados.results : []).map(loteParaImovel).filter(Boolean);
  _cacheBusca.set(chave, { em: now, lista });
  if (_cacheBusca.size > 200) _cacheBusca.delete(_cacheBusca.keys().next().value);
  return lista;
}

// ── Região: só fontes públicas e grátis (IBGE, Banco Central, OpenStreetMap/Nominatim/Overpass) ──
const UA = 'NEXIA-Bezsan-Leiloes/1.0 (+https://bezsan.pages.dev)';
const DIA = 24 * 60 * 60 * 1000;
const _cacheRegiao = new Map();
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
async function emCache(chave, ms, now, fn) {
  const c = _cacheRegiao.get(chave);
  if (c && now() - c.em < ms) return c.valor;
  const valor = await fn();
  if (valor !== null && valor !== undefined) {
    if (_cacheRegiao.size > 500) _cacheRegiao.clear();
    _cacheRegiao.set(chave, { em: now(), valor });
  }
  return valor;
}
async function jsonDe(fetchFn, url, opcoes = {}, ms = 12000) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), ms) : null;
  try {
    const r = await fetchFn(url, { ...opcoes, headers: { 'User-Agent': UA, Accept: 'application/json', ...(opcoes.headers || {}) }, signal: ctl ? ctl.signal : undefined });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { if (t) clearTimeout(t); }
}
const SERVICOS = [
  ['educacao', 'Escolas e faculdades', 'nwr(around:@)[amenity~"^(school|kindergarten|college|university)$"];'],
  ['saude', 'Saúde (hospital, posto, farmácia)', 'nwr(around:@)[amenity~"^(hospital|clinic|doctors|pharmacy)$"];'],
  ['mercado', 'Mercados e padarias', 'nwr(around:@)[shop~"^(supermarket|convenience|bakery|greengrocer)$"];'],
  ['transporte', 'Ônibus, metrô e trem', 'nwr(around:@)[highway=bus_stop];nwr(around:@)[railway~"^(station|subway_entrance|tram_stop)$"];'],
  ['lazer', 'Praças e parques', 'nwr(around:@)[leisure~"^(park|playground|sports_centre|pitch)$"];'],
  ['comercio', 'Bancos, restaurantes e comércio', 'nwr(around:@)[amenity~"^(bank|restaurant|cafe|fast_food)$"];'],
];
function numIbge(v) { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : null; }
function serieIbge(lista, id) {
  const ind = (Array.isArray(lista) ? lista : []).find(x => x && Number(x.id) === id);
  const res = ind && Array.isArray(ind.res) && ind.res[0] && ind.res[0].res;
  if (!res || typeof res !== 'object') return [];
  return Object.keys(res).map(a => ({ ano: Number(a), valor: numIbge(res[a]) })).filter(x => x.ano > 1900 && x.valor !== null).sort((a, b) => a.ano - b.ano);
}
function taxaAnual(ini, fim, anos) { return ini > 0 && fim > 0 && anos > 0 ? Math.pow(fim / ini, 1 / anos) - 1 : null; }
const arred1 = n => (n === null || n === undefined ? null : Math.round(n * 1000) / 10); // fração → % com 1 casa

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
// Endereço → ponto no mapa. Nominatim primeiro; o Photon (komoot, também OpenStreetMap) quando o Nominatim recusa
// ou só acha a cidade. Só aceita resultado no nível da rua e dentro da cidade do imóvel.
const NIVEL_RUA = /^(road|house|building|place|amenity|street|residential|highway|neighbourhood|quarter)$/;
async function localizar(fetchFn, q, cidadeNorm) {
  const nom = await jsonDe(fetchFn, `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'pt-BR' } });
  const n = Array.isArray(nom) && nom[0];
  if (n && Number.isFinite(Number(n.lat))) {
    const ad = n.address || {};
    const c = semAcento(ad.city || ad.town || ad.village || ad.municipality || '');
    if (c === cidadeNorm && (NIVEL_RUA.test(n.addresstype || '') || NIVEL_RUA.test(n.class || '')))
      return { lat: Number(Number(n.lat).toFixed(5)), lon: Number(Number(n.lon).toFixed(5)), endereco: str(n.display_name, 200), bairro: str(ad.suburb || ad.neighbourhood || ad.city_district || '', 80), na_cidade: true, fonte: 'Nominatim' };
  }
  const ph = await jsonDe(fetchFn, `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}`);
  const f = ph && Array.isArray(ph.features) && ph.features[0];
  const pr = f && f.properties, co = f && f.geometry && f.geometry.coordinates;
  if (pr && Array.isArray(co) && semAcento(pr.city || pr.county || '') === cidadeNorm && /^(street|house)$/.test(pr.type || '')) {
    return { lat: Number(Number(co[1]).toFixed(5)), lon: Number(Number(co[0]).toFixed(5)), endereco: str([pr.name, pr.housenumber, pr.district, pr.city, pr.state].filter(Boolean).join(', '), 200), bairro: str(pr.district || pr.locality || '', 80), na_cidade: true, fonte: 'Photon' };
  }
  return null;
}

async function analisarRegiao(fetchFn, { endereco, cidade, uf }, now) {
  // 1) Município no IBGE (lista oficial do estado, guardada por um dia)
  const municipios = await emCache('mun:' + uf, DIA, now, () => jsonDe(fetchFn, `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`));
  if (!Array.isArray(municipios)) return { erro: 'O IBGE não respondeu. Tente de novo.' };
  const alvo = semAcento(cidade);
  const mun = municipios.find(m => semAcento(m.nome) === alvo);
  if (!mun) return { erro: `Não achei a cidade "${cidade}" em ${uf} no IBGE. Confira o nome da cidade.` };
  const id6 = String(mun.id).slice(0, 6);
  const fontes = ['IBGE (Censo 2010 e 2022, estimativas de população, PIB dos municípios, salário médio)'];

  // 2) Em paralelo: indicadores do município, índice de preço de imóveis do Banco Central e o endereço no mapa
  const q = [endereco, cidade, uf, 'Brasil'].filter(Boolean).join(', ');
  const [ind, ivgr, selic, geo] = await Promise.all([
    emCache('ind:' + id6, DIA, now, () => jsonDe(fetchFn, `https://servicodados.ibge.gov.br/api/v1/pesquisas/indicadores/96385%7C29171%7C47001%7C29765/resultados/${id6}`)),
    emCache('ivgr', DIA, now, () => jsonDe(fetchFn, 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.21340/dados/ultimos/13?formato=json')),
    emCache('selic', DIA, now, () => jsonDe(fetchFn, 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json')),
    endereco ? emCache('geo:' + semAcento(q), 7 * DIA, now, () => localizar(fetchFn, q, alvo)) : null,
  ]);

  const censo = serieIbge(ind, 96385);
  const estim = serieIbge(ind, 29171);
  const pib = serieIbge(ind, 47001);
  const sal = serieIbge(ind, 29765);
  const c10 = censo.find(x => x.ano === 2010), c22 = censo.find(x => x.ano === 2022);
  const crescPop = c10 && c22 ? taxaAnual(c10.valor, c22.valor, 12) : null;
  const pibUlt = pib[pib.length - 1] || null;
  const pibIni = pibUlt ? pib.find(x => x.ano === pibUlt.ano - 5) : null;
  const crescPib = pibUlt && pibIni ? taxaAnual(pibIni.valor, pibUlt.valor, 5) : null;

  let mercado = null;
  if (Array.isArray(ivgr) && ivgr.length >= 13) {
    const a = numIbge(ivgr[0].valor), b = numIbge(ivgr[ivgr.length - 1].valor);
    if (a && b) mercado = { ivgr_12m_pct: arred1(b / a - 1), ivgr_ate: String(ivgr[ivgr.length - 1].data || '').slice(3) };
  }
  if (Array.isArray(selic) && selic[0] && numIbge(selic[0].valor) !== null) mercado = { ...(mercado || {}), selic_pct: numIbge(selic[0].valor) };
  if (mercado) fontes.push('Banco Central (índice IVG-R de preço de imóveis residenciais e taxa Selic)');

  // 3) Serviços a até 1 km (OpenStreetMap). Só quando o endereço foi achado no mapa.
  let local = null, servicos = null;
  if (geo) {
    const { lat, lon } = geo;
    const naCidade = geo.na_cidade;
    local = geo;
    if (naCidade) {
      fontes.push(`OpenStreetMap (${geo.fonte} para o endereço e Overpass para os serviços perto)`);
      const corpo = '[out:json][timeout:20];' + SERVICOS.map(s => '(' + s[2].split('around:@').join(`around:1000,${lat},${lon}`) + ');out count;').join('');
      const op = await emCache('osm:' + lat + ',' + lon, 7 * DIA, now, async () => {
        for (const url of OVERPASS) {
          const j = await jsonDe(fetchFn, url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(corpo) }, 15000);
          if (j && Array.isArray(j.elements) && j.elements.length === SERVICOS.length) return j.elements.map(e => Number(e && e.tags && e.tags.total) || 0);
        }
        return null;
      });
      if (op) servicos = SERVICOS.map((s, i) => ({ id: s[0], nome: s[1], qtd: op[i] }));
    }
  }

  return {
    municipio: { id: mun.id, nome: mun.nome, uf },
    local,
    servicos,
    populacao: {
      censo_2010: c10 ? c10.valor : null,
      censo_2022: c22 ? c22.valor : null,
      cresc_anual_pct: arred1(crescPop),
      estimada: estim.length ? estim[estim.length - 1] : null,
    },
    pib_per_capita: pibUlt ? { ano: pibUlt.ano, valor: pibUlt.valor, cresc_anual_pct: arred1(crescPib) } : null,
    salario_medio_sm: sal.length ? sal[sal.length - 1] : null,
    mercado,
    fontes,
  };
}

// ── IA grátis ──
const PEDIDO_EDITAL = `Você é um advogado especialista em leilões de imóveis no Brasil. Leia o EDITAL abaixo e devolva SÓ um JSON (sem texto antes ou depois, sem markdown) com estes campos, usando null quando o edital não disser:
{"tipo_leilao":"judicial|extrajudicial|venda_direta","processo":"número CNJ ou null","vara":"","leiloeiro":"","site_leilao":"","endereco":"","cidade":"","uf":"","descricao":"","area_m2":null,"matricula":"","cartorio":"","inscricao_iptu":"","praca1_data":"AAAA-MM-DD","praca1_valor":0,"praca2_data":"AAAA-MM-DD","praca2_valor":0,"avaliacao":0,"comissao_pct":0,"pagamento":"à vista, parcelado, FGTS, financiamento","tipo_imovel":"apartamento|casa|terreno|comercial|rural|outro","executado":"nome do devedor/executado","ocupado":true,"ocupante":"quem ocupa: devedor, inquilino, terceiro ou null","debitos_iptu":"quem paga e quanto","debitos_condominio":"quem paga e quanto","iptu_quem_paga":"preco|arrematante|nao_informado","condominio_quem_paga":"preco|arrematante|nao_informado","onus":["penhoras, hipotecas, usufruto, indisponibilidade, ações"],"prazos":["prazos importantes"],"riscos":["riscos concretos para quem compra"],"resumo":"3 frases simples"}
Valores em reais como número (ex.: 250000.5). "preco" quer dizer que a dívida é paga com o dinheiro do próprio leilão (sub-roga no preço, art. 130 do CTN ou art. 908 do CPC); "arrematante" quer dizer que quem compra paga. Não invente nada que não esteja no texto.`;
const PEDIDO_MATRICULA = `Você é um advogado especialista em registro de imóveis no Brasil. Leia a MATRÍCULA abaixo (certidão do cartório) e devolva SÓ um JSON (sem texto antes ou depois, sem markdown):
{"matricula":"","cartorio":"","endereco":"","descricao":"","area_m2":null,"proprietarios":["dono atual"],"onus":["cada registro/averbação AINDA ativo: penhora, hipoteca, alienação fiduciária, usufruto, indisponibilidade, ação, arrolamento"],"cancelados":["ônus já cancelados"],"alertas":["riscos para quem arremata: dono diferente do executado, penhora de terceiros, indisponibilidade, área divergente, falta de averbação da construção"],"resumo":"3 frases simples"}
Não invente nada que não esteja no texto.`;
const PEDIDO_PARECER = `Você é o consultor de leilões da Bezsan. Recebe em JSON o imóvel, a conta de viabilidade, a nota do motor de análise (campo "motor": pilares com pontos ok, atenção e grave) e os dados públicos da região. Escreva um PARECER DE CONSULTORIA em português do Brasil, simples, para um investidor leigo, com estes títulos, cada um sozinho numa linha e nesta ordem:
VEREDITO
O IMÓVEL E OS VALORES
REGIÃO E VALORIZAÇÃO
PARTE JURÍDICA
POSSE (OCUPAÇÃO)
DÍVIDAS (IPTU, CONDOMÍNIO E MATRÍCULA)
ATÉ QUANTO DAR DE LANCE
ANTES DE DAR O LANCE
Em cada título escreva de 1 a 4 frases curtas. Use só os dados do JSON: nunca invente números, leis, datas ou fatos. Quando faltar um dado, diga o que falta conferir. O veredito e o lance limite têm de ser os mesmos do motor (motor.veredito e motor.lance_limite). Sem markdown (sem asteriscos, sem #, sem listas com traço). Termine com a frase: "Análise automática: confirme com um advogado antes de dar lance."`;

function parecerCompleto(t) { return /ANTES DE DAR O LANCE/i.test(t) && /advogado/i.test(t) && String(t).length > 400; }

function extrairJson(texto) {
  const t = String(texto || '').replace(/```(?:json)?/gi, '');
  const i = t.indexOf('{');
  const f = t.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { const o = JSON.parse(t.slice(i, f + 1)); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}

function modelosGratis(FREE, { longo, imagens }) {
  let lista = FREE.reasoning.filter(d => d.provider !== 'anthropic');
  // Texto longo ou imagem: o Gemini grátis aguenta mais contexto e lê imagem; vai primeiro.
  if (longo || imagens) lista = [...lista.filter(d => d.provider === 'google'), ...lista.filter(d => d.provider !== 'google')];
  return lista;
}

async function perguntarIa({ router, FREE, system, conteudo, imagens, maxTokens, timeoutMs = 15000, totalMs = 45000, now = Date.now, aceita }) {
  const inicio = now();
  let reserva = null; // resposta incompleta: só usada se nenhum outro modelo grátis completar
  const lista = modelosGratis(FREE, { longo: conteudo.length > 16000, imagens: imagens && imagens.length });
  for (const d of lista) {
    const resta = totalMs - (now() - inicio);
    if (resta < 3000) break; // nunca deixa a pessoa esperando mais que o total
    try {
      const cap = router.capabilities(d);
      if (!cap || !cap.available || (imagens && imagens.length && !cap.vision)) continue;
      const out = await Promise.race([
        router.chat(d, { system, messages: [{ role: 'user', content: conteudo }], maxTokens, ...(imagens && imagens.length ? { images: imagens } : {}) }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), Math.min(timeoutMs, resta))),
      ]);
      if (out && out.text) {
        const r = { texto: out.text, modelo: `${d.provider}:${d.model}` };
        if (!aceita || aceita(out.text)) return r;
        if (!reserva || out.text.length > reserva.texto.length) reserva = r;
      }
    } catch { /* próximo modelo grátis */ }
  }
  return reserva;
}

// Imóvel salvo: só campos simples (texto, número, booleano, listas curtas, objetos rasos).
function limparValor(v, prof = 0) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v.slice(0, 4000);
  if (Array.isArray(v)) return prof > 4 ? undefined : v.slice(0, 60).map(x => (Array.isArray(x) ? JSON.stringify(x).slice(0, 4000) : limparValor(x, prof + 1))).filter(x => x !== undefined);
  if (typeof v === 'object') {
    if (prof > 4) return undefined;
    const o = {};
    for (const [k, x] of Object.entries(v).slice(0, 80)) { if (/^[A-Za-z0-9_-]{1,40}$/.test(k)) { const y = limparValor(x, prof + 1); if (y !== undefined) o[k] = y; } }
    return o;
  }
  return undefined;
}

const _uso = new Map();
function iaPermitida(chave, now) {
  const hora = Math.floor(now / 3600000);
  const k = chave + ':' + hora;
  const n = (_uso.get(k) || 0) + 1;
  _uso.set(k, n);
  if (_uso.size > 2000) for (const key of _uso.keys()) if (!key.endsWith(':' + hora)) _uso.delete(key);
  return n <= IA_POR_HORA;
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const getCadastro = deps.getCadastro || (slug => require('../../clientes/agendas.js').AGENDAS[slug]);
  const getRouter = deps.getRouter || (() => require('../../nexia-ai/model-router').getRouter());
  const getFree = deps.getFree || (() => require('../../nexia-ai/orchestrator/models').FREE);
  const fetchFn = deps.fetch || ((...a) => globalThis.fetch(...a));
  const env = deps.env || process.env;
  const now = deps.now || (() => Date.now());

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return res(400, { error: 'Pedido inválido.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res(400, { error: 'Pedido inválido.' });
    const slug = str(body.site, 40).toLowerCase();
    if (!SLUG_RE.test(slug)) return res(400, { error: 'Conta inválida.' });
    const cadastro = getCadastro(slug);
    if (!cadastro || !cadastro.leilao) return res(404, { error: 'A Central de Leilões não está ativa nesta conta.' });
    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível. Tente de novo em instantes.' });
    const conta = db.collection(COLLECTION).doc(slug);

    // Mesmo login do painel da NEXIA Agenda.
    let logado = false;
    let quem = 'master';
    const token = str(body.token, 100);
    if (/^[a-f0-9]{64}$/.test(token)) {
      quem = await sha256(token);
      const s = await conta.collection('sessoes').doc(quem).get();
      logado = s.exists && Number(s.data().expira) > now();
    }
    if (!logado && headers.authorization) {
      const auth = await getMw().verifyBearerToken(event);
      logado = !!(auth.ok && auth.role === 'master');
      quem = 'master';
    }
    if (!logado) return res(401, { error: 'Entre de novo no painel.', sair: true });

    const acao = str(body.acao, 20);
    const imoveis = conta.collection('imoveis');

    if (acao === 'listar') {
      const snap = await imoveis.get();
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.atualizado_em || '').localeCompare(String(a.atualizado_em || '')));
      return res(200, { ok: true, imoveis: lista });
    }

    if (acao === 'salvar') {
      const imovel = limparValor(body.imovel);
      if (!imovel || typeof imovel !== 'object' || Array.isArray(imovel)) return res(400, { error: 'Imóvel inválido.' });
      delete imovel.id;
      if (JSON.stringify(imovel).length > IMOVEL_MAX) return res(413, { error: 'Dados demais neste imóvel.' });
      let id = str(body.id, 64);
      if (id && !ID_RE.test(id)) return res(400, { error: 'Imóvel inválido.' });
      if (!id) {
        if ((await imoveis.get()).docs.length >= IMOVEIS_MAX) return res(400, { error: `Limite de ${IMOVEIS_MAX} imóveis. Apague os que já não interessam.` });
        id = hex(globalThis.crypto.getRandomValues(new Uint8Array(10)));
      }
      const agora = new Date(now()).toISOString();
      const antigo = await imoveis.doc(id).get();
      await imoveis.doc(id).set({ ...imovel, criado_em: antigo.exists ? antigo.data().criado_em || agora : agora, atualizado_em: agora });
      return res(200, { ok: true, id });
    }

    if (acao === 'apagar') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'Imóvel inválido.' });
      await imoveis.doc(id).delete();
      return res(200, { ok: true });
    }

    if (acao === 'buscar') {
      const busca = str(body.busca, 60) || 'imóvel';
      const uf = str(body.uf, 2).toUpperCase();
      if (uf && !UFS.includes(uf)) return res(400, { error: 'Estado inválido.' });
      try {
        const imoveis = await buscarLeiloesJudiciais(fetchFn, { busca, uf }, now());
        return res(200, { ok: true, fonte: 'Leilões Judiciais', imoveis });
      } catch { return res(502, { error: 'A busca automática não respondeu agora. Tente de novo ou use os links dos leiloeiros.' }); }
    }

    if (acao === 'regiao') {
      const uf = str(body.uf, 2).toUpperCase();
      const cidade = str(body.cidade, 80);
      if (!UFS.includes(uf) || cidade.length < 2) return res(400, { error: 'Preencha a cidade e o estado do imóvel.' });
      if (!iaPermitida(slug + ':' + quem, now())) return res(429, { error: 'Muitas análises nesta hora. Espere um pouco e tente de novo.' });
      const r = await analisarRegiao(fetchFn, { endereco: str(body.endereco, 160), cidade, uf }, now).catch(() => ({ erro: 'As fontes públicas não responderam. Tente de novo.' }));
      if (r.erro) return res(502, { error: r.erro });
      return res(200, { ok: true, regiao: r });
    }

    if (acao === 'arquivo') {
      const url = str(body.url, 300);
      if (!ANEXO_RE.test(url)) return res(400, { error: 'Arquivo não permitido.' });
      let r;
      try { r = await fetchFn(url, { headers: { 'User-Agent': 'NexiaBezsan/1.0' } }); } catch { return res(502, { error: 'Não consegui baixar o arquivo.' }); }
      if (!r.ok) return res(502, { error: 'Não consegui baixar o arquivo.' });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > ARQUIVO_MAX) return res(413, { error: 'Arquivo grande demais para ler aqui. Abra no site do leilão.' });
      if (buf.slice(0, 4).toString('latin1') !== '%PDF') return res(502, { error: 'O arquivo não é um PDF.' });
      return res(200, { ok: true, pdf: buf.toString('base64') });
    }

    if (acao === 'processo') {
      const t = tribunalDoProcesso(body.numero);
      if (!t) return res(400, { error: 'Número de processo inválido. Use o formato 0000000-00.0000.0.00.0000 (de tribunal estadual, federal ou do trabalho).' });
      const chave = str(env.DATAJUD_API_KEY, 200) || DATAJUD_CHAVE;
      // O DataJud às vezes falha uma vez e responde na seguinte: tenta duas vezes antes de desistir.
      let r = null;
      for (let tentativa = 0; tentativa < 2 && !(r && r.ok); tentativa++) {
        try {
          r = await fetchFn(`https://api-publica.datajud.cnj.jus.br/api_publica_${t.alias}/_search`, {
            method: 'POST',
            headers: { Authorization: 'APIKey ' + chave, 'Content-Type': 'application/json' },
            body: JSON.stringify({ size: 1, query: { match: { numeroProcesso: t.numero } } }),
          });
        } catch { r = null; }
      }
      if (!r) return res(502, { error: 'A consulta do CNJ não respondeu. Tente de novo.' });
      if (!r.ok) return res(502, { error: 'A consulta do CNJ não respondeu. Tente de novo.' });
      const j = await r.json().catch(() => ({}));
      const hit = j && j.hits && Array.isArray(j.hits.hits) && j.hits.hits[0];
      if (!hit) return res(200, { ok: true, processo: null, tribunal: t.alias, aviso: 'Processo não encontrado na base pública do CNJ (processo em segredo de justiça ou ainda não enviado pelo tribunal). Consulte no site do tribunal.' });
      return res(200, { ok: true, processo: resumirProcesso(hit._source || {}) });
    }

    if (acao === 'analisar' || acao === 'parecer') {
      if (!iaPermitida(slug + ':' + quem, now())) return res(429, { error: 'Muitas análises nesta hora. Espere um pouco e tente de novo.' });
      const router = getRouter();
      const FREE = getFree();
      if (acao === 'parecer') {
        const dados = JSON.stringify({ imovel: limparValor(body.imovel), conta: limparValor(body.conta), motor: limparValor(body.motor), regiao: limparValor(body.regiao) }).slice(0, 30000);
        // Modelos que "pensam" gastam parte do limite antes de escrever: limite folgado e só aceita o parecer inteiro.
        const out = await perguntarIa({ router, FREE, system: PEDIDO_PARECER, conteudo: dados, maxTokens: 4000, now, aceita: parecerCompleto });
        if (!out) return res(503, { error: 'A IA grátis está ocupada agora. Tente de novo em instantes.' });
        let texto = out.texto.replace(/[*#]+/g, '').replace(/[ \t]+\n/g, '\n').trim();
        const inteiro = parecerCompleto(texto);
        if (!/confirme com um advogado/i.test(texto)) texto += (inteiro ? '' : '\n\n(O parecer veio cortado pela IA grátis. Toque de novo para pedir outro.)') + '\n\nAnálise automática: confirme com um advogado antes de dar lance.';
        return res(200, { ok: true, texto, modelo: out.modelo, completo: inteiro });
      }
      const tipo = body.tipo === 'matricula' ? 'matricula' : 'edital';
      const texto = str(body.texto, TEXTO_MAX + 1);
      let imagens = [];
      if (Array.isArray(body.imagens)) {
        for (const im of body.imagens.slice(0, IMAGENS_MAX)) {
          const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(im || ''));
          if (!m || m[2].length > IMAGEM_MAX) return res(400, { error: 'Imagem inválida ou grande demais.' });
          imagens.push({ mime: m[1], data: m[2] });
        }
      }
      if (texto.length < 200 && !imagens.length) return res(400, { error: 'Não consegui ler o documento. Envie o PDF do edital ou da matrícula, ou cole o texto.' });
      const conteudo = (tipo === 'edital' ? 'EDITAL:\n' : 'MATRÍCULA:\n') + (texto ? texto.slice(0, TEXTO_MAX) : '(o documento está nas imagens)');
      const out = await perguntarIa({ router, FREE, system: tipo === 'edital' ? PEDIDO_EDITAL : PEDIDO_MATRICULA, conteudo, imagens, maxTokens: 2500, now });
      if (!out) return res(503, { error: 'A IA grátis está ocupada agora. Tente de novo em instantes.' });
      const dados = extrairJson(out.texto);
      if (!dados) return res(502, { error: 'A IA não devolveu uma análise legível. Tente de novo.' });
      return res(200, { ok: true, tipo, dados: limparValor(dados), modelo: out.modelo, cortado: texto.length > TEXTO_MAX });
    }

    return res(400, { error: 'Ação desconhecida.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.tribunalDoProcesso = tribunalDoProcesso;
exports.extrairJson = extrairJson;
exports.modelosGratis = modelosGratis;
exports.loteParaImovel = loteParaImovel;
