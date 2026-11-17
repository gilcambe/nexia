'use strict';
/**
 * Kernex Finance: leitor de extrato bancário (OFX / CSV), sem senha de banco.
 * Chamado por agirExtra (extra.js) na ação 'extrato_ler'. Devolve null para outras ações.
 */
const { normalizarLancamento, idDe } = require('./documentos');

const MAX_CONTEUDO = 2000000;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function texto(v) { return typeof v === 'string' ? v.trim() : ''; }
function numero(v) {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) {
    if (t.includes('.')) t = t.replace(/\./g, '');
    t = t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
function dataValida(v) {
  const t = texto(v);
  if (DATA.test(t)) {
    const [a, m, d] = t.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return '';
    return t;
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (!m) return '';
  const ano = m[3].length === 2 ? '20' + m[3] : m[3];
  const mes = m[2].padStart(2, '0');
  const dia = m[1].padStart(2, '0');
  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return '';
  return `${ano}-${mes}-${dia}`;
}

function lerOFX(textoOfx) {
  const out = [];
  const blocosXml = textoOfx.match(/<STMTTRN[\s>]*[\s\S]*?<\/STMTTRN>/gi);
  if (blocosXml) {
    for (const bloco of blocosXml) {
      const l = lerStmtTrn(bloco);
      if (l) out.push(l);
    }
    return out;
  }
  const partes = textoOfx.split(/<STMTTRN>/gi);
  for (let i = 1; i < partes.length; i++) {
    const l = lerStmtTrn(partes[i]);
    if (l) out.push(l);
  }
  return out;
}
function lerStmtTrn(bloco) {
  const dtposted = (bloco.match(/<DTPOSTED[^>]*>([^<]*)/i) || [])[1] || '';
  const dt = dtposted.replace(/[-:].*$/, '').slice(0, 8);
  const data = /^\d{8}$/.test(dt) ? `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}` : '';
  const valor = numero((bloco.match(/<TRNAMT[^>]*>([^<]*)/i) || [])[1]);
  const descricao = texto((bloco.match(/<MEMO[^>]*>([^<]*)/i) || [])[1]) ||
                    texto((bloco.match(/<NAME[^>]*>([^<]*)/i) || [])[1]);
  const fitid = texto((bloco.match(/<FITID[^>]*>([^<]*)/i) || [])[1]);
  if (!data || !Number.isFinite(valor) || !descricao) return null;
  return { data, valor, descricao, id_banco: fitid || undefined };
}

function lerCSV(textoCsv) {
  const linhas = dividirLinhas(textoCsv);
  if (linhas.length < 2) return [];
  const sep = separadorDaLinha(linhas[0]);
  const cabecalho = dividirCampos(linhas[0], sep).map((c) => semAcento(c));
  const idxData = acharColuna(cabecalho, ['data', 'date']);
  const idxDesc = acharColuna(cabecalho, ['descricao', 'desc', 'historico', 'lancamento', 'title', 'description']);
  const idxValor = acharColuna(cabecalho, ['valor', 'amount', 'value']);
  if (idxData < 0 || idxDesc < 0 || idxValor < 0) return [];
  const out = [];
  for (let i = 1; i < linhas.length; i++) {
    const campos = dividirCampos(linhas[i], sep);
    if (campos.length <= Math.max(idxData, idxDesc, idxValor)) continue;
    const data = dataValida(campos[idxData]);
    const descricao = texto(campos[idxDesc]);
    const valor = numero(campos[idxValor]);
    if (!descricao) continue;
    out.push({ data, valor, descricao });
  }
  return out;
}
function dividirLinhas(t) { return String(t).split(/\r\n|\r|\n/).filter(l => l.trim() !== ''); }
function separadorDaLinha(linha) { return linha.includes(';') ? ';' : ','; }
function dividirCampos(linha, sep) {
  const out = [];
  let atual = '', dentro = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (dentro && i + 1 < linha.length && linha[i + 1] === '"') { atual += '"'; i++; continue; }
      dentro = !dentro;
    } else if (ch === sep && !dentro) {
      out.push(atual.trim()); atual = '';
    } else { atual += ch; }
  }
  out.push(atual.trim());
  return out;
}
function semAcento(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function acharColuna(cab, nomes) {
  for (let i = 0; i < cab.length; i++) if (nomes.includes(cab[i])) return i;
  return -1;
}

async function agirExtrato(acao, body, c) {
  if (acao !== 'extrato_ler') return null;
  const { nome, conteudo } = body || {};
  if (typeof conteudo !== 'string' || conteudo.length === 0) return [400, { error: 'Envie o conteúdo do extrato.' }];
  if (conteudo.length > MAX_CONTEUDO) return [400, { error: 'Arquivo muito grande (limite 2 MB).' }];
  const n = texto(nome);
  const conteudoIni = conteudo.slice(0, 60);
  const isOfx = /\.ofx$/i.test(n) || /^<OFX/.test(conteudoIni) || /^OFXHEADER/i.test(conteudoIni);
  let lancamentos;
  if (isOfx) lancamentos = lerOFX(conteudo);
  else if (/\.csv$/i.test(n)) lancamentos = lerCSV(conteudo);
  else return [400, { error: 'Formato não reconhecido. Use .ofx ou .csv.' }];
  if (!lancamentos || lancamentos.length === 0) return [400, { error: 'Não encontrei lançamentos no arquivo.' }];
  const { base, listar } = c;
  const existentes = await listar(base.collection('lancamentos'));
  const jaIds = new Set();
  for (const e of existentes) { try { jaIds.add(idDe(e.data())); } catch { } }
  const prontos = [], conferir = [], ja_lancados = [];
  let receitas = 0, despesas = 0;
  for (const l of lancamentos) {
    const r = normalizarLancamento({
      data: l.data, descricao: l.descricao, valor: Math.abs(l.valor),
      tipo: l.valor < 0 ? 'despesa' : 'receita', documento: 'extrato'
    }, { tipo_documento: 'extrato' });
    if (!r.ok) { conferir.push({ ...l, motivo: r.motivo }); continue; }
    const item = r.item;
    if (jaIds.has(idDe(item))) { ja_lancados.push(item); continue; }
    prontos.push(item);
    if (item.tipo === 'receita') receitas += item.valor; else despesas += item.valor;
  }
  return [200, {
    documento: 'extrato', imagens_lidas: 1, imagens_total: 1,
    prontos, conferir, ja_lancados: ja_lancados.length,
    receitas: Math.round(receitas * 100) / 100, despesas: Math.round(despesas * 100) / 100
  }];
}

module.exports = { lerOFX, lerCSV, agirExtrato };
