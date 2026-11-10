'use strict';
// Documentos do Viajante Pro (contratos, vouchers, comprovantes, planilhas, PDFs, fotos).
// Rota: /api/vp-arquivos
//   POST ?acao=enviar&nome=&categoria=&vinculo_tipo=&vinculo_id=&visivel=0|1   corpo = o arquivo (binário)
//   GET  ?id=…                         baixa o arquivo (admin: Authorization: Bearer <token>)
//   GET  ?id=…&codigo=…                baixa (passageiro: só documento da própria viagem e liberado pela agência)
//   POST JSON {acao:'listar'|'atualizar'|'excluir'|'app-listar', …}
// Metadados: viajante_contas/<site>/documentos/<id>. Conteúdo: tabela vp_arquivo_partes (em partes de 512 KB).

const crypto = require('node:crypto');

const LIMITE = 20 * 1024 * 1024; // 20 MB
const PARTE = 512 * 1024;
// Só tipos de documento; nunca HTML/SVG/JS (evita página maliciosa servida pelo nosso domínio).
const TIPOS = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text', txt: 'text/plain',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const CATEGORIAS = ['contrato', 'voucher', 'comprovante', 'passaporte', 'visto', 'seguro', 'bilhete', 'roteiro', 'planilha', 'proposta', 'foto', 'outro'];
const VINCULOS = ['cliente', 'cotacao', 'viagem', 'geral'];

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

function extensao(nome) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(nome || ''));
  return m ? m[1].toLowerCase() : '';
}

function nomeSeguro(nome) {
  const limpo = String(nome || 'arquivo').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim();
  return limpo.slice(-120) || 'arquivo';
}

function criarArquivos({ db, driver, lerBuffer, json }) {
  const conta = (site = 'viajantepro') => db.collection('viajante_contas').doc(site);

  async function sessaoAdmin(req, site) {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return false;
    const snap = await conta(site).collection('sessoes').doc(sha256(token)).get();
    return snap.exists && new Date(snap.data().expira_em).getTime() > Date.now();
  }

  async function viagemPorCodigo(site, codigo) {
    if (!codigo) return null;
    const achados = await conta(site).collection('viagens').where('codigoSecreto', '==', String(codigo)).get();
    return achados.docs[0] ? achados.docs[0].data() : null;
  }

  async function atividade(site, texto, ref) {
    const agora = Date.now();
    const id = `${agora}-${crypto.randomBytes(2).toString('hex')}`;
    try { await conta(site).collection('atividades').doc(id).set({ id, tipo: 'documento', texto: str(texto, 200), ref, criado_em: new Date(agora).toISOString() }); } catch { /* opcional */ }
  }

  async function enviar(req, res, url, site) {
    if (!(await sessaoAdmin(req, site))) return json(res, 401, { error: 'Entre no painel de novo.' });
    const nome = nomeSeguro(url.searchParams.get('nome'));
    const ext = extensao(nome);
    if (!TIPOS[ext]) return json(res, 415, { error: `Tipo de arquivo não aceito (.${ext || '?'}). Envie PDF, imagem, Excel, CSV, Word ou PowerPoint.` });
    const tamanhoDeclarado = Number(req.headers['content-length'] || 0);
    if (tamanhoDeclarado > LIMITE) return json(res, 413, { error: 'Arquivo maior que 20 MB.' });
    let buf;
    try { buf = await lerBuffer(req, LIMITE); } catch (e) { return json(res, e.status || 400, { error: e.status === 413 ? 'Arquivo maior que 20 MB.' : 'Falha ao receber o arquivo.' }); }
    if (!buf.length) return json(res, 400, { error: 'Arquivo vazio.' });
    const vTipo = VINCULOS.includes(url.searchParams.get('vinculo_tipo')) ? url.searchParams.get('vinculo_tipo') : 'geral';
    const vId = str(url.searchParams.get('vinculo_id') || '', 190);
    if (vTipo !== 'geral' && !vId) return json(res, 400, { error: 'Falta dizer a qual cliente, cotação ou viagem o arquivo pertence.' });
    const categoria = CATEGORIAS.includes(url.searchParams.get('categoria')) ? url.searchParams.get('categoria') : 'outro';
    const id = crypto.randomBytes(12).toString('hex');
    for (let i = 0, n = 0; i < buf.length; i += PARTE, n++) await driver.parteGravar(id, n, buf.subarray(i, i + PARTE));
    const meta = {
      id, nome, extensao: ext, tipo: TIPOS[ext], tamanho: buf.length, categoria,
      vinculo: { tipo: vTipo, id: vTipo === 'cliente' ? vId.toLowerCase() : vId },
      visivel_passageiro: url.searchParams.get('visivel') === '1' && vTipo === 'viagem',
      validade: /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('validade') || '') ? url.searchParams.get('validade') : '',
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
      criado_em: new Date().toISOString(),
    };
    await conta(site).collection('documentos').doc(id).set(meta);
    await atividade(site, `Documento enviado: ${nome}`, { tipo: vTipo, id: meta.vinculo.id });
    return json(res, 200, { ok: true, documento: meta });
  }

  async function baixar(req, res, url, site) {
    const id = str(url.searchParams.get('id') || '', 64);
    const snap = await conta(site).collection('documentos').doc(id).get();
    if (!snap.exists) return json(res, 404, { error: 'Documento não encontrado.' });
    const meta = snap.data();
    let pode = await sessaoAdmin(req, site);
    if (!pode) {
      const codigo = req.headers['x-vp-codigo'] || url.searchParams.get('codigo');
      const viagem = await viagemPorCodigo(site, codigo);
      pode = !!(viagem && meta.visivel_passageiro && meta.vinculo && meta.vinculo.tipo === 'viagem' && meta.vinculo.id === viagem.id);
    }
    if (!pode) return json(res, 403, { error: 'Sem permissão para este documento.' });
    const partes = await driver.partesLer(id);
    const buf = Buffer.concat(partes);
    const inline = url.searchParams.get('ver') === '1' && /^(application\/pdf|image\/(jpeg|png|webp|gif))$/.test(meta.tipo);
    res.writeHead(200, {
      'Content-Type': meta.tipo,
      'Content-Length': buf.length,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(meta.nome)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    });
    return res.end(buf);
  }

  async function acaoJson(req, res, corpo, site) {
    const acao = str(corpo.acao, 30);
    if (acao === 'app-listar') {
      const viagem = await viagemPorCodigo(site, corpo.codigo);
      if (!viagem) return json(res, 404, { error: 'Viagem não encontrada.' });
      const docs = (await conta(site).collection('documentos').where('vinculo.id', '==', viagem.id).get()).docs.map(d => d.data())
        .filter(d => d.vinculo.tipo === 'viagem' && d.visivel_passageiro)
        .map(({ sha256: _s, ...d }) => d)
        .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
      return json(res, 200, { ok: true, documentos: docs });
    }
    if (!(await sessaoAdmin(req, site))) return json(res, 401, { error: 'Entre no painel de novo.' });
    if (acao === 'listar') {
      let docs = (await conta(site).collection('documentos').get()).docs.map(d => d.data());
      if (corpo.vinculo_tipo) docs = docs.filter(d => d.vinculo && d.vinculo.tipo === corpo.vinculo_tipo && (!corpo.vinculo_id || d.vinculo.id === String(corpo.vinculo_id).toLowerCase() || d.vinculo.id === corpo.vinculo_id));
      docs.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
      return json(res, 200, { ok: true, documentos: docs });
    }
    const id = str(corpo.id, 64);
    const ref = conta(site).collection('documentos').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return json(res, 404, { error: 'Documento não encontrado.' });
    if (acao === 'atualizar') {
      const meta = snap.data();
      const novo = {
        nome: corpo.nome ? nomeSeguro(corpo.nome).replace(/\.[a-z0-9]{1,5}$/i, '') + '.' + meta.extensao : meta.nome,
        categoria: CATEGORIAS.includes(corpo.categoria) ? corpo.categoria : meta.categoria,
        visivel_passageiro: corpo.visivel_passageiro !== undefined ? (!!corpo.visivel_passageiro && meta.vinculo.tipo === 'viagem') : meta.visivel_passageiro,
        validade: corpo.validade !== undefined ? (/^\d{4}-\d{2}-\d{2}$/.test(corpo.validade) ? corpo.validade : '') : (meta.validade || ''),
        atualizado_em: new Date().toISOString(),
      };
      await ref.update(novo);
      return json(res, 200, { ok: true, documento: { ...meta, ...novo } });
    }
    if (acao === 'excluir') {
      if (corpo.confirmar !== true) return json(res, 400, { error: 'Confirme a exclusão.' });
      await driver.partesApagar(id);
      await ref.delete();
      await atividade(site, `Documento excluído: ${snap.data().nome}`, null);
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: 'Ação inválida.' });
  }

  return async function rotaArquivos(req, res, url) {
    const site = (url.searchParams.get('site') || 'viajantepro').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'viajantepro';
    if (req.method === 'GET') return baixar(req, res, url, site);
    if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
    if (url.searchParams.get('acao') === 'enviar') return enviar(req, res, url, site);
    let corpo;
    try { corpo = JSON.parse((await lerBuffer(req, 64 * 1024)).toString('utf8') || '{}'); } catch { return json(res, 400, { error: 'Pedido inválido.' }); }
    return acaoJson(req, res, corpo || {}, site);
  };
}

module.exports = { criarArquivos, TIPOS, CATEGORIAS, LIMITE };
