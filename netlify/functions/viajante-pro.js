'use strict';

// NEXIA Viajante Pro — API Backend do Painel CMS, Cotações e Aplicativo do Passageiro
// Firestore: viajante_contas/viajantepro { senha_hash, senha_salt, config }
//            viajante_contas/viajantepro/sessoes/<hash>
//            viajante_contas/viajantepro/pax_sessoes/<hash>
//            viajante_contas/viajantepro/pax_codigos/<emailHash>
//            viajante_contas/viajantepro/pax_perfil/<emailHash>
//            viajante_contas/viajantepro/pax_solicitacoes/<id>
//            viajante_contas/viajantepro/pax_documentos/<id>
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
      'Access-Control-Allow-Origin': '*',
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

async function enviarCodigoBrevo(env, email, codigo) {
  const key = env.BREVO_API_KEY;
  if (!key) return { ok: false, motivo: 'BREVO_API_KEY ausente.' };

  const htmlContent = `
    <h2>Código de Acesso — Viajante Pro</h2>
    <p>Seu código de validação para entrar no aplicativo é:</p>
    <h1 style="font-size: 32px; letter-spacing: 4px; color: #2563eb;">${codigo}</h1>
    <p>Este código expira em 15 minutos.</p>
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
        sender: { name: 'Viajante Pro', email: 'no-reply@viajante.pro' },
        to: [{ email }],
        subject: `Seu código de acesso: ${codigo}`,
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

// Mensagens da conversa em ordem; com "desde" (id da última que o app já tem) devolve só as novas.
async function listarMensagens(vRef, desde) {
  const snaps = await vRef.collection('mensagens').get();
  const lista = snaps.docs.map(d => d.data());
  lista.sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)) || String(a.id).localeCompare(String(b.id)));
  if (!desde) return lista;
  const i = lista.findIndex(m => m.id === desde);
  return i >= 0 ? lista.slice(i + 1) : lista;
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

  // ── AÇÕES DO PASSAGEIRO (PAX) ──
  if (acao === 'pax-codigo') {
    const email = str(body.email, 120).toLowerCase();
    if (!email || !email.includes('@')) return res(400, { error: 'E-mail inválido.' });

    const emailHash = await sha256(email);
    const docRef = contaRef.collection('pax_codigos').doc(emailHash);
    const docSnap = await docRef.get();
    const dadosAtuais = docSnap.exists ? docSnap.data() : {};

    if (dadosAtuais.bloqueado_ate && new Date(dadosAtuais.bloqueado_ate).getTime() > now) {
      const minutosRestantes = Math.ceil((new Date(dadosAtuais.bloqueado_ate).getTime() - now) / 60000);
      return res(429, { error: `Conta bloqueada temporariamente. Tente novamente em ${minutosRestantes} minuto(s).` });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiraEm = new Date(now + 15 * 60000).toISOString();

    await docRef.set({
      email,
      codigo,
      expira_em: expiraEm,
      tentativas_erradas: 0,
      bloqueado_ate: null,
      criado_em: new Date(now).toISOString(),
    }, { merge: true });

    await enviarCodigoBrevo(env, email, codigo);

    return res(200, { ok: true, mensagem: 'Código enviado por e-mail.' });
  }

  if (acao === 'pax-entrar') {
    const email = str(body.email, 120).toLowerCase();
    const codigo = str(body.codigo, 10);
    const senha = String(body.senha || '');
    const senhaNova = String(body.senha_nova || '');

    if (!email || !email.includes('@')) return res(400, { error: 'E-mail é obrigatório.' });

    const emailHash = await sha256(email);
    const codDocRef = contaRef.collection('pax_codigos').doc(emailHash);
    const codSnap = await codDocRef.get();
    const codData = codSnap.exists ? codSnap.data() : {};

    if (codData.bloqueado_ate && new Date(codData.bloqueado_ate).getTime() > now) {
      return res(403, { error: 'Conta bloqueada por 15 minutos devido a múltiplas tentativas incorretas.' });
    }

    let autenticado = false;

    if (codigo) {
      if (!codData.codigo || new Date(codData.expira_em).getTime() < now) {
        return res(400, { error: 'Código expirado ou inválido.' });
      }

      if (codData.codigo === codigo) {
        autenticado = true;
        await codDocRef.update({ tentativas_erradas: 0, codigo: null });
      } else {
        const erros = (codData.tentativas_erradas || 0) + 1;
        if (erros >= 3) {
          const bloqueadoAte = new Date(now + 15 * 60000).toISOString();
          await codDocRef.update({ tentativas_erradas: erros, bloqueado_ate: bloqueadoAte });
          return res(403, { error: 'Código incorreto. Múltiplas tentativas falharam. Conta bloqueada por 15 minutos.' });
        } else {
          await codDocRef.update({ tentativas_erradas: erros });
          return res(400, { error: `Código incorreto. Restam ${3 - erros} tentativa(s).` });
        }
      }
    } else if (senha) {
      const perfRef = contaRef.collection('pax_perfil').doc(emailHash);
      const perfSnap = await perfRef.get();
      if (!perfSnap.exists || !perfSnap.data().senha_hash) {
        return res(401, { error: 'Senha incorreta ou não cadastrada.' });
      }
      const perfData = perfSnap.data();
      const hc = await hashSenha(senha, perfData.senha_salt);
      if (iguais(hc, perfData.senha_hash)) {
        autenticado = true;
      } else {
        return res(401, { error: 'Senha incorreta.' });
      }
    } else {
      return res(400, { error: 'Informe o código de 6 dígitos ou sua senha.' });
    }

    if (autenticado) {
      if (senhaNova && senhaNova.length >= 6) {
        const salt = aleatorio(16);
        const hash = await hashSenha(senhaNova, salt);
        await contaRef.collection('pax_perfil').doc(emailHash).set({
          email,
          senha_hash: hash,
          senha_salt: salt,
          atualizado_em: new Date(now).toISOString(),
        }, { merge: true });
      }

      const token = aleatorio(24);
      const tokenHash = await sha256(token);
      const expiraEm = new Date(now + SESSAO_DIAS * 86400000).toISOString();

      await contaRef.collection('pax_sessoes').doc(tokenHash).set({
        email,
        perfil: 'passageiro',
        criado_em: new Date(now).toISOString(),
        expira_em: expiraEm,
      });

      return res(200, { ok: true, token, email, perfil: 'passageiro', expira_em: expiraEm });
    }
  }

  // Verificar autenticação do passageiro para rotas pax-* privadas
  if (acao.startsWith('pax-')) {
    const token = body.token || event.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    if (!token) return res(401, { error: 'Token de autenticação ausente.' });

    const tokenHash = await sha256(token);
    const sSnap = await contaRef.collection('pax_sessoes').doc(tokenHash).get();
    if (!sSnap.exists) return res(401, { error: 'Sessão do passageiro inválida ou expirada.' });

    const sessaoPax = sSnap.data();
    if (new Date(sessaoPax.expira_em).getTime() < now) {
      await contaRef.collection('pax_sessoes').doc(tokenHash).delete();
      return res(401, { error: 'Sessão expirada.' });
    }

    const emailPax = sessaoPax.email;
    const emailPaxHash = await sha256(emailPax);

    if (acao === 'pax-perfil-obter') {
      const perfSnap = await contaRef.collection('pax_perfil').doc(emailPaxHash).get();
      const perfil = perfSnap.exists ? perfSnap.data() : { email: emailPax };
      delete perfil.senha_hash;
      delete perfil.senha_salt;
      return res(200, { ok: true, perfil });
    }

    if (acao === 'pax-perfil-salvar') {
      const p = body.perfil || {};
      const payload = {
        email: emailPax,
        nome: str(p.nome, 100),
        cpf: str(p.cpf, 20),
        passaporte: str(p.passaporte, 30),
        telefone: str(p.telefone, 30),
        contato_emergencia: {
          nome: str(p.contato_emergencia?.nome, 100),
          telefone: str(p.contato_emergencia?.telefone, 30),
          parentesco: str(p.contato_emergencia?.parentesco, 50),
        },
        consentimento_lgpd: p.consentimento_lgpd === true,
        atualizado_em: new Date(now).toISOString(),
      };
      await contaRef.collection('pax_perfil').doc(emailPaxHash).set(payload, { merge: true });
      return res(200, { ok: true, perfil: payload });
    }

    if (acao === 'pax-minhas') {
      // Se solicitou id específico, verificar autorização (Isolamento de Passageiro)
      if (body.viagem_id) {
        const vSnap = await contaRef.collection('viagens').doc(str(body.viagem_id, 64)).get();
        if (!vSnap.exists) return res(404, { error: 'Viagem não encontrada.' });
        const vData = vSnap.data();
        const pertence = vData.email === emailPax || (Array.isArray(vData.passageiros) && vData.passageiros.some(p => p.email === emailPax || p.nome === emailPax));
        if (!pertence) return res(403, { error: 'Acesso negado: a viagem solicitada pertence a outro passageiro.' });
        return res(200, { ok: true, viagem: vData });
      }

      const vSnaps = await contaRef.collection('viagens').get();
      const viagens = [];
      vSnaps.docs.forEach(doc => {
        const d = doc.data();
        if (d.email === emailPax || (Array.isArray(d.passageiros) && d.passageiros.some(p => p.email === emailPax || p.nome === emailPax))) {
          viagens.push(d);
        }
      });

      const cSnaps = await contaRef.collection('cotacoes').get();
      const cotacoes = [];
      cSnaps.docs.forEach(doc => {
        const d = doc.data();
        if (d.email === emailPax) cotacoes.push(d);
      });

      return res(200, { ok: true, viagens, cotacoes });
    }

    if (acao === 'pax-solicitar') {
      const id = aleatorio(12);
      const payload = {
        id,
        email: emailPax,
        tipo: str(body.tipo, 50) || 'duvida', // p.ex: alterar_data, segunda_via, duvida
        mensagem: str(body.mensagem, 1000),
        viagem_id: str(body.viagem_id, 64) || null,
        status: 'pendente',
        criado_em: new Date(now).toISOString(),
      };
      await contaRef.collection('pax_solicitacoes').doc(id).set(payload);
      return res(200, { ok: true, solicitacao: payload });
    }

    if (acao === 'pax-documentos') {
      if (body.subacao === 'adicionar') {
        const id = aleatorio(12);
        const docData = {
          id,
          email: emailPax,
          tipo: str(body.tipo, 50),
          numero: str(body.numero, 50),
          validade: str(body.validade, 20),
          url: str(body.url, 500),
          criado_em: new Date(now).toISOString(),
        };
        await contaRef.collection('pax_documentos').doc(id).set(docData);
        return res(200, { ok: true, documento: docData });
      }

      const dSnaps = await contaRef.collection('pax_documentos').get();
      const documentos = [];
      dSnaps.docs.forEach(doc => {
        const d = doc.data();
        if (d.email === emailPax) documentos.push(d);
      });
      return res(200, { ok: true, documentos });
    }
  }

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

  // ── Ações do viajante (públicas, só com o código secreto do link do app) ──
  if (acao === 'app-viagem' || acao === 'app-chat-listar' || acao === 'app-chat-enviar') {
    const codigo = str(body.codigo || body.v, 64);
    if (!codigo) return res(400, { error: 'Abra o app pelo link que a agência enviou.' });
    const achados = await contaRef.collection('viagens').where('codigoSecreto', '==', codigo).get();
    if (!achados.docs.length) return res(404, { error: 'Viagem não encontrada. Peça um link novo à agência.' });
    const viagemDoc = achados.docs[0];
    const vRef = contaRef.collection('viagens').doc(viagemDoc.id);
    if (acao === 'app-viagem') return res(200, { ok: true, viagem: viagemDoc.data() });
    if (acao === 'app-chat-listar') {
      return res(200, { ok: true, mensagens: await listarMensagens(vRef, str(body.desde, 64)) });
    }
    const texto = str(body.texto, 1000);
    if (!texto) return res(400, { error: 'Escreva a mensagem.' });
    const msgData = { id: aleatorio(16), autor: 'viajante', texto, lida: false, criado_em: new Date(now).toISOString() };
    await vRef.collection('mensagens').doc(msgData.id).set(msgData);
    return res(200, { ok: true, mensagem: msgData });
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
      email: str(p.email, 120),
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
      email: str(body.email, 120) || (passageiros[0] && passageiros[0].email) || '',
      whatsapp: str(body.whatsapp, 20).replace(/\D/g, ''),
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
      email: str(p.email, 120),
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
      email: str(body.email, 120) || atual.email,
      whatsapp: body.whatsapp !== undefined ? str(body.whatsapp, 20).replace(/\D/g, '') : (atual.whatsapp || ''),
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

  // ── Ação: chat-enviar ──
  if (acao === 'chat-enviar') {
    const vId = str(body.v, 64);
    const texto = str(body.texto, 1000);
    const autor = 'agencia';

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

    const mensagens = await listarMensagens(vDocRef, desde);
    for (const m of mensagens) {
      if (m.autor === 'viajante' && !m.lida) await vDocRef.collection('mensagens').doc(m.id).update({ lida: true });
    }
    return res(200, { ok: true, mensagens });
  }

  // ── Ação: chat-conversas (Painel) ──
  if (acao === 'chat-conversas') {
    const snaps = await contaRef.collection('viagens').get();
    const conversas = [];

    for (const doc of snaps.docs) {
      const viagem = doc.data();
      const msgs = await listarMensagens(contaRef.collection('viagens').doc(doc.id));
      const ultimaMsg = msgs.length ? msgs[msgs.length - 1] : null;
      const naoLidas = msgs.filter(m => m.autor === 'viajante' && !m.lida).length;

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
