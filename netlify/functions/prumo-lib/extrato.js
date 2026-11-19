'use strict';
// Fase 4 do épico #4013 / #3953 (manual CFO Pessoal, seções 13 e 14): importar extrato do banco em arquivo OFX ou CSV,
// sem senha de banco. Reusa o fluxo da aba Documentos: lê -> mostra -> "Confirmar e gravar" (doc_confirmar).
// Reimportar o mesmo arquivo não duplica (mesmo id do documentos.idDe).
const MAX = 2000000;
const r2 = (n) => Math.round(n * 100) / 100;
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Valor "1.234,56", "-1234.56", "R$ 10,00" -> número com sinal. */
function numero(v) {
  let t = String(v == null ? '' : v).replace(/[R$\s]/g, '');
  if (!t) return NaN;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  return Number(t);
}

/** "AAAA-MM-DD", "DD/MM/AAAA" ou "AAAAMMDD..." -> "AAAA-MM-DD"; data impossível -> ''. */
function data(v) {
  const t = String(v == null ? '' : v).trim();
  let a, m, d;
  let x = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (x) [, a, m, d] = x;
  else if ((x = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t))) { [, d, m, a] = x; if (a.length === 2) a = '20' + a; }
  else if ((x = /^(\d{4})(\d{2})(\d{2})/.exec(t))) [, a, m, d] = x;
  else return '';
  const mm = Number(m), dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
  return `${a}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** OFX 1.x (SGML, tags sem fechamento) e 2.x (XML). */
function lerOFX(texto) {
  const out = [];
  const blocos = String(texto || '').split(/<STMTTRN>/i).slice(1);
  for (const b0 of blocos) {
    const b = b0.split(/<\/STMTTRN>/i)[0];
    const tag = (n) => { const m = new RegExp(`<${n}>([^<\\r\\n]*)`, 'i').exec(b); return m ? m[1].trim() : ''; };
    const valor = numero(tag('TRNAMT'));
    const item = { data: data(tag('DTPOSTED')), valor: Number.isFinite(valor) ? r2(valor) : NaN, descricao: tag('MEMO') || tag('NAME'), id_banco: tag('FITID') };
    out.push(item);
  }
  return out;
}

/** Divide uma linha CSV respeitando aspas ("" = aspas dentro). */
function celulas(linha, sep) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (q) { if (ch === '"') { if (linha[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function lerCSV(texto) {
  const linhas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return [];
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length && linhas[0].includes(';') ? ';' : ',';
  const cab = celulas(linhas[0], sep).map(sem);
  const acha = (nomes) => cab.findIndex((c) => nomes.some((n) => c === n || c.startsWith(n)));
  const iD = acha(['data', 'date']);
  const iT = acha(['descricao', 'historico', 'lancamento', 'title', 'description']);
  const iV = acha(['valor', 'amount', 'value']);
  if (iD < 0 || iT < 0 || iV < 0) return [];
  return linhas.slice(1).map((l) => {
    const c = celulas(l, sep);
    const v = numero(c[iV]);
    return { data: data(c[iD]), valor: Number.isFinite(v) ? r2(v) : NaN, descricao: c[iT] || '' };
  });
}

async function agirExtrato(acao, body, c) {
  if (acao !== 'extrato_ler') return null;
  const conteudo = typeof body.conteudo === 'string' ? body.conteudo : '';
  if (conteudo.length > MAX) return [400, { error: 'Arquivo grande demais. Exporte um período menor (até 2 MB).' }];
  const nome = sem(body.nome);
  const ehOFX = /\.ofx$/.test(nome) || /<OFX|OFXHEADER/i.test(conteudo.slice(0, 2000));
  const ehCSV = !ehOFX && /\.csv$/.test(nome);
  if (!ehOFX && !ehCSV) return [400, { error: 'Mande o extrato em arquivo .ofx ou .csv (o banco gera no app ou no site).' }];
  const linhas = ehOFX ? lerOFX(conteudo) : lerCSV(conteudo);
  if (!linhas.length) return [400, { error: 'Não achei lançamentos neste arquivo. Confira se é o extrato em OFX ou CSV.' }];
  const doc = require('./documentos');
  const existentes = new Set((await c.listar(c.base.collection('lancamentos'))).map((x) => x.id));
  const prontos = []; const conferir = []; let jaLancados = 0; const vistos = new Set();
  const regras = await doc.lerRegras(c.base); // categorias que a pessoa já corrigiu
  for (const l of linhas) {
    const v = doc.normalizarLancamento({ data: l.data, descricao: l.descricao, valor: Number.isFinite(l.valor) ? Math.abs(l.valor) : l.valor,
      tipo: l.valor < 0 ? 'despesa' : 'receita', documento: 'extrato' }, { tipo_documento: 'extrato' });
    if (!v.ok) { conferir.push({ ...l, motivo: v.motivo }); continue; }
    const id = doc.idDe(v.item);
    if (existentes.has(id)) { jaLancados++; continue; }
    if (vistos.has(id)) continue; // mesma linha repetida no arquivo
    vistos.add(id);
    doc.aplicarRegras([v.item], regras);
    prontos.push(v.item);
  }
  const soma = (t) => r2(prontos.filter((x) => x.tipo === t).reduce((s, x) => s + x.valor, 0));
  return [200, { documento: 'extrato', imagens_lidas: 1, imagens_total: 1, prontos, conferir, ja_lancados: jaLancados, receitas: soma('receita'), despesas: soma('despesa') }];
}

module.exports = { lerOFX, lerCSV, agirExtrato };
