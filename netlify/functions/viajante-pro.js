'use strict';

// NEXIA Viajante Pro — API Backend do Painel CMS, Cotações e Aplicativo do Passageiro
// Firestore: viajante_contas/viajantepro { senha_hash, senha_salt, config }
//            viajante_contas/viajantepro/sessoes/<hash>
//            viajante_contas/viajantepro/site/conteudo
//            viajante_contas/viajantepro/fotos/<id>
//            viajante_contas/viajantepro/viagens/<id>
//            viajante_contas/viajantepro/cotacoes/<id>

const { VIAJANTE_PRO } = require('../../clientes/viajantepro');

const COLLECTION = 'viajante_contas';
const SESSAO_DIAS = 30;
const PBKDF2_ITER = 100000;
const CONTEUDO_MAX = 500 * 1024; // 500 KB máx para o JSON de conteúdo
const DESTINATARIO_COTACAO = 'cotacao.site@viajante.pro';

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const subtle = () => globalThis.crypto.subtle;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const aleatorio = n => hex(globalThis.crypto.getRandomValues(new Uint8Array(n)));

async function hashSenha(senha, salt) {
  const key = await subtle().importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}

async function sha256(s) {
  return hex(await subtle().digest('SHA-256', new TextEncoder().encode(s)));
}

function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

function abrirBanco(env) {
  if (globalThis.__NEXIA_FIRESTORE_MOCK__) return globalThis.__NEXIA_FIRESTORE_MOCK__;
  // mesmo banco das outras funções (Firestore pelo firebase-init); initFirestore não existe no firebase-lite
  return require('./firebase-init').db;
}

function res(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

async function enviarEmailBrevo(env, cotacao) {
  const key = env.BREVO_API_KEY;
  const to = DESTINATARIO_COTACAO;
  if (!key) return { ok: false, motivo: 'BREVO_API_KEY ausente nas variáveis de ambiente.' };

  const htmlContent = `
    <h2>Nova Cotação de Viagem Recebida — Viajante Pro</h2>
    <p><strong>Protocolo:</strong> ${cotacao.codigo}</p>
    <p><strong>Cliente:</strong> ${cotacao.nome}</p>
    <p><strong>E-mail:</strong> ${cotacao.email}</p>
    <p><strong>WhatsApp:</strong> ${cotacao.whatsapp}</p>
    <p><strong>Origem:</strong> ${cotacao.origem || 'Não informada'}</p>
    <p><strong>Destino:</strong> ${cotacao.destino || 'A definir'}</p>
    <p><strong>Modalidades:</strong> ${(cotacao.modalidades || []).join(', ')}</p>
    <p><strong>Orçamento Estimado:</strong> ${cotacao.orcamento}</p>
    <p><strong>Datas:</strong> ${cotacao.dataIda || 'A definir'} até ${cotacao.dataVolta || 'A definir'} (${cotacao.flexibilidade})</p>
    <p><strong>Observações:</strong> ${cotacao.observacoes || 'Sem observações'}</p>
    <hr>
    <p><em>Este e-mail foi gerado automaticamente pelo sistema de cotações da Viajante Pro.</em></p>
  `;

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': key,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Viajante Pro Cotações', email: 'no-reply@viajante.pro' },
        to: [{ email: to, name: 'Atendimento Viajante Pro' }],
        subject: `NOVA COTAÇÃO | ${cotacao.nome} | ${cotacao.destino || 'Geral'} | ${cotacao.codigo}`,
        htmlContent,
      }),
    });
    return { ok: resp.ok, status: resp.status };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

function limparConteudoViajante(c) {
  if (!c || typeof c !== 'object') return {};
  const out = {};
  if (c.hero && typeof c.hero === 'object') {
    out.hero = {
      titulo: str(c.hero.titulo, 200),
      subtitulo: str(c.hero.subtitulo, 400),
      badge: str(c.hero.badge, 100),
      cta_texto: str(c.hero.cta_texto, 80),
      bg_url: str(c.hero.bg_url, 500),
    };
  }
  if (c.sobre && typeof c.sobre === 'object') {
    out.sobre = {
      titulo: str(c.sobre.titulo, 200),
      subtitulo: str(c.sobre.subtitulo, 400),
      texto: str(c.sobre.texto, 2000),
      imagem_url: str(c.sobre.imagem_url, 500),
    };
  }
  if (Array.isArray(c.destinos)) {
    out.destinos = c.destinos.slice(0, 50).map(d => ({
      id: str(d.id, 50) || aleatorio(6),
      nome: str(d.nome, 100),
      pais: str(d.pais, 80),
      categoria: str(d.categoria, 80) || 'Nacionais',
      imagem: str(d.imagem, 500),
      descricao: str(d.descricao, 500),
      preco: str(d.preco, 50),
      destaque: d.destaque === true,
    }));
  }
  if (Array.isArray(c.pacotes)) {
    out.pacotes = c.pacotes.slice(0, 20).map(p => ({
      id: str(p.id, 50) || aleatorio(6),
      titulo: str(p.titulo, 100),
      subtitulo: str(p.subtitulo, 200),
      preco: str(p.preco, 50),
      detalhes: str(p.detalhes, 500),
      imagem: str(p.imagem, 500),
      inclui: Array.isArray(p.inclui) ? p.inclui.map(i => str(i, 100)).slice(0, 10) : [],
    }));
  }
  if (Array.isArray(c.faqs)) {
    out.faqs = c.faqs.slice(0, 30).map(f => ({
      pergunta: str(f.pergunta, 200),
      resposta: str(f.resposta, 1000),
    }));
  }
  if (c.contato && typeof c.contato === 'object') {
    out.contato = {
      whatsapp: str(c.contato.whatsapp, 30),
      email: str(c.contato.email, 100),
      telefone: str(c.contato.telefone, 30),
      endereco: str(c.contato.endereco, 200),
      horario: str(c.contato.horario, 100),
      instagram: str(c.contato.instagram, 50),
    };
  }
  return out;
}

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') return res(204, null);

  const q = event.queryStringParameters || {};
  const method = event.httpMethod;
  const env = (context && context.env) || process.env;
  const db = abrirBanco(env);
  const slug = (q.site || 'viajantepro').toLowerCase();
  const cadastro = VIAJANTE_PRO[slug] || VIAJANTE_PRO.viajantepro;

  const contaRef = db.collection(COLLECTION).doc(slug);

  // ── GET PÚBLICO: Conteúdo do Site ou Foto ──
  if (method === 'GET') {
    if (q.foto) {
      const fSnap = await contaRef.collection('fotos').doc(str(q.foto, 64)).get();
      if (!fSnap.exists) return res(404, { error: 'Foto não encontrada.' });
      return res(200, { ok: true, foto: fSnap.data() });
    }

    const cSnap = await contaRef.collection('site').doc('conteudo').get();
    const cData = cSnap.exists ? cSnap.data() : {};

    const publico = { ...cData };
    if (!q.admin && publico.pagamento) {
      publico.pagamento = {
        instrucoes: publico.pagamento.instrucoes || 'Instruções fornecidas na confirmação da reserva.',
        chave_pix: publico.pagamento.chave_pix ? 'Fornecida no momento da reserva' : '',
      };
    }

    return res(200, {
      site: slug,
      config: cadastro.config,
      conteudo: publico,
    });
  }

  // ── POST / AÇÕES ──
  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return res(400, { error: 'JSON inválido.' });
  }

  const acao = body.acao || body.action || '';
  const now = Date.now();

  // Garante a existência do documento da conta
  let cDoc = await contaRef.get();
  if (!cDoc.exists) {
    const salt = aleatorio(16);
    const senhaInicial = cadastro.senhas_iniciais && cadastro.senhas_iniciais[0];
    const sHash = senhaInicial ? senhaInicial.hash : await hashSenha('ADMIN01', salt);
    const sSalt = senhaInicial ? senhaInicial.salt : salt;
    await contaRef.set({
      nome: cadastro.nome,
      versao: cadastro.versao || 1,
      senha_hash: sHash,
      senha_salt: sSalt,
      config: cadastro.config,
      criado_em: new Date(now).toISOString(),
    });
    cDoc = await contaRef.get();
  }
  const conta = cDoc.data();

  // ── AÇÃO PÚBLICA: Solicitar Cotação ──
  if (acao === 'solicitar_cotacao') {
    const nome = str(body.nome, 100);
    const email = str(body.email, 100);
    const whatsapp = str(body.whatsapp, 30);
    const consentimento = body.consentimento === true;

    if (!nome || !email || !whatsapp) {
      return res(400, { error: 'Nome, E-mail e WhatsApp são obrigatórios.' });
    }
    if (!consentimento) {
      return res(400, { error: 'Consentimento LGPD é obrigatório.' });
    }

    const id = aleatorio(8).toUpperCase();
    const codigo = `VP-${id}`;
    const cotacaoData = {
      id,
      codigo,
      nome,
      email,
      whatsapp,
      cidadeResidencia: str(body.cidadeResidencia, 100),
      modalidades: Array.isArray(body.modalidades) ? body.modalidades.map(m => str(m, 80)) : [],
      origem: str(body.origem, 100),
      destino: str(body.destino, 100),
      dataIda: str(body.dataIda, 20),
      dataVolta: str(body.dataVolta, 20),
      flexibilidade: str(body.flexibilidade, 50),
      adultos: parseInt(body.adultos, 10) || 1,
      criancas: parseInt(body.criancas, 10) || 0,
      classeVoo: str(body.classeVoo, 50),
      categoriaHospedagem: str(body.categoriaHospedagem, 50),
      regime: str(body.regime, 50),
      orcamento: str(body.orcamento, 80),
      observacoes: str(body.observacoes, 1000),
      status: 'Nova',
      emailNotificado: false,
      criado_em: new Date(now).toISOString(),
    };

    // Tenta enviar o e-mail via Brevo
    const emailRes = await enviarEmailBrevo(env, cotacaoData);
    if (emailRes.ok) {
      cotacaoData.emailNotificado = true;
    } else {
      cotacaoData.emailErro = emailRes.motivo || emailRes.error || 'Falha de envio';
    }

    // Salva no banco de dados Firestore
    await contaRef.collection('cotacoes').doc(id).set(cotacaoData);

    return res(200, {
      ok: true,
      codigo,
      notificado: cotacaoData.emailNotificado,
      mensagem: 'Solicitação registrada com sucesso.',
    });
  }

  // ── Ação: entrar (Login do Admin) ──
  if (acao === 'entrar') {
    const senha = String(body.senha || '');
    if (!senha) return res(400, { error: 'Senha é obrigatória.' });

    const hashCalculado = await hashSenha(senha, conta.senha_salt);
    let valido = iguais(hashCalculado, conta.senha_hash);

    if (!valido && Array.isArray(cadastro.senhas_iniciais)) {
      for (const si of cadastro.senhas_iniciais) {
        const hc = await hashSenha(senha, si.salt);
        if (iguais(hc, si.hash)) { valido = true; break; }
      }
    }

    if (!valido) return res(401, { error: 'Senha incorreta.' });

    const token = aleatorio(24);
    const tokenHash = await sha256(token);
    const expiraEm = new Date(now + SESSAO_DIAS * 86400000).toISOString();

    await contaRef.collection('sessoes').doc(tokenHash).set({
      criado_em: new Date(now).toISOString(),
      expira_em: expiraEm,
    });

    return res(200, { ok: true, token, expira_em: expiraEm });
  }

  // ── Verificação de Token de Sessão para Ações Administrativas ──
  const token = body.token || event.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  if (!token) return res(401, { error: 'Token de autenticação ausente.' });

  const tokenHash = await sha256(token);
  const sSnap = await contaRef.collection('sessoes').doc(tokenHash).get();
  if (!sSnap.exists) return res(401, { error: 'Sessão inválida ou expirada.' });

  const sessao = sSnap.data();
  if (new Date(sessao.expira_em).getTime() < now) {
    await contaRef.collection('sessoes').doc(tokenHash).delete();
    return res(401, { error: 'Sessão expirada.' });
  }

  // ── Ações Administrativas de Cotações ──
  if (acao === 'cotacao-listar') {
    const snaps = await contaRef.collection('cotacoes').get();
    const cotacoes = [];
    snaps.docs.forEach(doc => cotacoes.push(doc.data()));
    cotacoes.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    return res(200, { ok: true, cotacoes });
  }

  if (acao === 'cotacao-atualizar-status') {
    const cId = str(body.id, 64);
    const novoStatus = str(body.status, 50);
    const obs = str(body.observacoes_internas, 500);

    if (!cId || !novoStatus) return res(400, { error: 'ID e Novo Status são obrigatórios.' });

    const cDocRef = contaRef.collection('cotacoes').doc(cId);
    const snap = await cDocRef.get();
    if (!snap.exists) return res(404, { error: 'Cotação não encontrada.' });

    const atual = snap.data();
    const historico = Array.isArray(atual.historico) ? atual.historico : [];
    historico.push({
      status_anterior: atual.status,
      novo_status: novoStatus,
      observacoes: obs,
      data: new Date(now).toISOString(),
    });

    await cDocRef.update({
      status: novoStatus,
      historico,
      atualizado_em: new Date(now).toISOString(),
    });

    return res(200, { ok: true, id: cId, status: novoStatus });
  }

  // ── Ação: trocar-senha ──
  if (acao === 'trocar-senha') {
    const senhaNova = String(body.senha_nova || '');
    if (senhaNova.length < 6) return res(400, { error: 'Senha deve ter pelo menos 6 caracteres.' });

    const novoSalt = aleatorio(16);
    const novoHash = await hashSenha(senhaNova, novoSalt);

    await contaRef.update({
      senha_hash: novoHash,
      senha_salt: novoSalt,
      senha_personalizada: true,
      atualizado_em: new Date(now).toISOString(),
    });

    return res(200, { ok: true, message: 'Senha alterada com sucesso.' });
  }

  // ── Ação: site-salvar (Persistência CMS) ──
  if (acao === 'site-salvar') {
    const conteudo = limparConteudoViajante(body.conteudo);
    if (JSON.stringify(conteudo).length > CONTEUDO_MAX) {
      return res(413, { error: 'Conteúdo excede o limite permitido (500 KB).' });
    }

    const agoraIso = new Date(now).toISOString();
    const payload = {
      ...conteudo,
      atualizado_em: agoraIso,
    };

    await contaRef.collection('site').doc('conteudo').set(payload, { merge: true });
    return res(200, { ok: true, conteudo: payload });
  }

  // ── Ação: foto-enviar (Upload Mídia Base64) ──
  if (acao === 'foto-enviar') {
    const dados = String(body.dados || '');
    const tipo = str(body.tipo, 50) || 'imagem/jpeg';
    if (!dados) return res(400, { error: 'Dados da imagem ausentes.' });

    const id = aleatorio(12);
    await contaRef.collection('fotos').doc(id).set({
      id,
      dados,
      tipo,
      criado_em: new Date(now).toISOString(),
    });

    return res(200, { ok: true, id, url: `/api/viajante-pro?site=${slug}&foto=${id}` });
  }

  // ── Ação: viagem-criar ──
  if (acao === 'viagem-criar') {
    const nome = str(body.nome, 100);
    const destino = str(body.destino, 100);
    const datas = {
      inicio: str(body.datas?.inicio, 20),
      fim: str(body.datas?.fim, 20),
    };
    const passageiros = Array.isArray(body.passageiros) ? body.passageiros.map(p => ({
      nome: str(p.nome, 100),
      tipo: str(p.tipo, 20) || 'adulto',
    })) : [];
    const roteiro = Array.isArray(body.roteiro) ? body.roteiro.map(r => ({
      dia: parseInt(r.dia, 10) || 1,
      descricao: str(r.descricao, 500),
    })) : [];

    if (!nome || !destino || !datas.inicio || !datas.fim) {
      return res(400, { error: 'Nome, destino e datas são obrigatórios.' });
    }

    const id = aleatorio(12);
    const codigoSecreto = aleatorio(24);
    const viagemData = {
      id,
      nome,
      destino,
      datas,
      passageiros,
      roteiro,
      codigoSecreto,
      criado_em: new Date(now).toISOString(),
      atualizado_em: new Date(now).toISOString(),
    };

    await contaRef.collection('viagens').doc(id).set(viagemData);

    return res(200, {
      ok: true,
      id,
      link: `/viajante-pro/app?v=${codigoSecreto}`,
    });
  }

  // ── Ação: viagem-listar ──
  if (acao === 'viagem-listar') {
    const snaps = await contaRef.collection('viagens').get();
    const viagens = [];
    snaps.docs.forEach(doc => viagens.push(doc.data()));
    viagens.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    return res(200, { ok: true, viagens });
  }

  // ── Ação: viagem-editar ──
  if (acao === 'viagem-editar') {
    const vId = str(body.id, 64);
    const nome = str(body.nome, 100);
    const destino = str(body.destino, 100);
    const datas = {
      inicio: str(body.datas?.inicio, 20),
      fim: str(body.datas?.fim, 20),
    };
    const passageiros = Array.isArray(body.passageiros) ? body.passageiros.map(p => ({
      nome: str(p.nome, 100),
      tipo: str(p.tipo, 20) || 'adulto',
    })) : [];
    const roteiro = Array.isArray(body.roteiro) ? body.roteiro.map(r => ({
      dia: parseInt(r.dia, 10) || 1,
      descricao: str(r.descricao, 500),
    })) : [];

    if (!vId) return res(400, { error: 'ID da viagem é obrigatório.' });

    const vDocRef = contaRef.collection('viagens').doc(vId);
    const snap = await vDocRef.get();
    if (!snap.exists) return res(404, { error: 'Viagem não encontrada.' });

    const atual = snap.data();
    const viagemData = {
      ...atual,
      nome: nome || atual.nome,
      destino: destino || atual.destino,
      datas: datas.inicio || datas.fim ? { ...atual.datas, ...datas } : atual.datas,
      passageiros: passageiros.length ? passageiros : atual.passageiros,
      roteiro: roteiro.length ? roteiro : atual.roteiro,
      atualizado_em: new Date(now).toISOString(),
    };

    await vDocRef.update(viagemData);

    return res(200, { ok: true, viagem: viagemData });
  }

  // ── Ação: viagem-excluir ──
  if (acao === 'viagem-excluir') {
    const vId = str(body.id, 64);
    if (!vId) return res(400, { error: 'ID da viagem é obrigatório.' });

    const vDocRef = contaRef.collection('viagens').doc(vId);
    const snap = await vDocRef.get();
    if (!snap.exists) return res(404, { error: 'Viagem não encontrada.' });

    await vDocRef.delete();
    return res(200, { ok: true, id: vId });
  }

  // ── Ação: app-viagem (Pública) ──
  if (acao === 'app-viagem') {
    const codigo = str(body.v, 24);
    if (!codigo) return res(400, { error: 'Código da viagem é obrigatório.' });

    const snaps = await contaRef.collection('viagens').where('codigoSecreto', '==', codigo).get();
    if (snaps.empty) return res(404, { error: 'Viagem não encontrada.' });

    const viagem = snaps.docs[0].data();
    return res(200, { ok: true, viagem });
  }

  // ── Ação: chat-enviar ──
  if (acao === 'chat-enviar') {
    const vId = str(body.v, 64);
    const texto = str(body.texto, 1000);
    const autor = str(body.autor, 20) || 'viajante';

    if (!vId || !texto) return res(400, { error: 'ID da viagem e texto são obrigatórios.' });

    const vDocRef = contaRef.collection('viagens').doc(vId);
    const snap = await vDocRef.get();
    if (!snap.exists) return res(404, { error: 'Viagem não encontrada.' });

    const msgId = aleatorio(16);
    const msgData = {
      id: msgId,
      autor,
      texto,
      lida: false,
      criado_em: new Date(now).toISOString(),
    };

    await vDocRef.collection('mensagens').doc(msgId).set(msgData);

    return res(200, { ok: true, mensagem: msgData });
  }

  // ── Ação: chat-listar ──
  if (acao === 'chat-listar') {
    const vId = str(body.v, 64);
    const desde = str(body.desde, 24);

    if (!vId) return res(400, { error: 'ID da viagem é obrigatório.' });

    const vDocRef = contaRef.collection('viagens').doc(vId);
    const snap = await vDocRef.get();
    if (!snap.exists) return res(404, { error: 'Viagem não encontrada.' });

    let query = vDocRef.collection('mensagens').orderBy('criado_em', 'desc');
    if (desde) {
      query = query.startAfter(desde);
    }

    const snaps = await query.get();
    const mensagens = [];
    snaps.docs.forEach(doc => mensagens.push(doc.data()));
    mensagens.sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));

    return res(200, { ok: true, mensagens });
  }

  // ── Ação: chat-conversas (Painel) ──
  if (acao === 'chat-conversas') {
    const snaps = await contaRef.collection('viagens').get();
    const conversas = [];

    for (const doc of snaps.docs) {
      const viagem = doc.data();
      const msgSnaps = await doc.ref.collection('mensagens').orderBy('criado_em', 'desc').limit(1).get();

      let ultimaMsg = null;
      let naoLidas = 0;

      if (!msgSnaps.empty) {
        ultimaMsg = msgSnaps.docs[0].data();
        const todasMsg = await doc.ref.collection('mensagens').where('lida', '==', false).get();
        naoLidas = todasMsg.size;
      }

      conversas.push({
        viagemId: viagem.id,
        viagemNome: viagem.nome,
        ultimaMensagem: ultimaMsg,
        naoLidas,
      });
    }

    conversas.sort((a, b) => {
      if (!a.ultimaMensagem) return 1;
      if (!b.ultimaMensagem) return -1;
      return new Date(b.ultimaMensagem.criado_em) - new Date(a.ultimaMensagem.criado_em);
    });

    return res(200, { ok: true, conversas });
  }

  return res(400, { error: `Ação não reconhecida: ${acao}` });
};

exports.limparConteudoViajante = limparConteudoViajante;
