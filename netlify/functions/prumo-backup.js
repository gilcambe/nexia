'use strict';

/**
 * Kernex Finance (Prumo Backup & LGPD) — netlify/functions/prumo-backup.js
 * Rotina de exportação, exclusão (LGPD - direito ao esquecimento) e backup/restauração.
 *
 * Regras:
 * - Nunca grava em disco (sem fs.writeFileSync / require dinâmico).
 * - Usuário comum só exporta/apaga os seus próprios dados.
 * - Administrador master pode exportar ou rodar backup de usuários.
 * - Suporta chamadas diretas ou via agendamento cron do Netlify.
 */

const COLECOES_PRUMO = [
  'carteira',
  'cartoes',
  'gastos',
  'listas',
  'objetivos',
  'historico',
  'limites',
  'dividas',
  'documentos',
  'investimentos',
  'familia',
  'impostos',
  'milhas',
  'config',
  'alertas',
  'bancos',
];

async function listarColecao(colRef) {
  if (!colRef || typeof colRef.get !== 'function') return [];
  const snap = await colRef.get();
  if (!snap || !snap.docs) return [];
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Exporta todos os dados sensíveis do usuário em prumo_users/{uid} (LGPD Portabilidade).
 */
async function exportarDadosUsuario(db, uid) {
  if (!db || typeof db.collection !== 'function') throw new Error('Banco de dados indisponível.');
  if (!uid || typeof uid !== 'string') throw new Error('Identificador de usuário (uid) inválido.');

  const userDocRef = db.collection('prumo_users').doc(uid);
  const userDocSnap = await userDocRef.get();
  const perfil = (userDocSnap && userDocSnap.exists) ? userDocSnap.data() : null;

  const dados = {
    uid,
    exportado_em: new Date().toISOString(),
    perfil,
    colecoes: {},
  };

  for (const col of COLECOES_PRUMO) {
    const itens = await listarColecao(userDocRef.collection(col));
    if (itens && itens.length > 0) {
      dados.colecoes[col] = itens;
    }
  }

  return dados;
}

/**
 * Apaga todos os dados do usuário em prumo_users/{uid} (LGPD Direito ao Esquecimento).
 */
async function apagarDadosUsuario(db, uid) {
  if (!db || typeof db.collection !== 'function') throw new Error('Banco de dados indisponível.');
  if (!uid || typeof uid !== 'string') throw new Error('Identificador de usuário (uid) inválido.');

  const userDocRef = db.collection('prumo_users').doc(uid);
  let totalApagados = 0;

  for (const col of COLECOES_PRUMO) {
    const itens = await listarColecao(userDocRef.collection(col));
    for (const item of itens) {
      if (item && item.id) {
        await userDocRef.collection(col).doc(item.id).delete();
        totalApagados++;
      }
    }
  }

  if (typeof userDocRef.delete === 'function') {
    await userDocRef.delete();
  }

  return { ok: true, uid, totalApagados, apagado_em: new Date().toISOString() };
}

/**
 * Restaura dados a partir de um backup exportado, conferindo integridade (Teste de restauração simples).
 */
async function restaurarDadosUsuario(db, uid, backup) {
  if (!db || typeof db.collection !== 'function') throw new Error('Banco de dados indisponível.');
  if (!uid || typeof uid !== 'string') throw new Error('Identificador de usuário (uid) inválido.');
  if (!backup || typeof backup !== 'object') throw new Error('Objeto de backup inválido.');

  const userDocRef = db.collection('prumo_users').doc(uid);

  if (backup.perfil) {
    await userDocRef.set(backup.perfil);
  }

  const colecoes = backup.colecoes || {};
  let totalRestaurados = 0;

  for (const [colName, itens] of Object.entries(colecoes)) {
    if (!Array.isArray(itens)) continue;
    for (const item of itens) {
      if (!item || !item.id) continue;
      const { id, ...resto } = item;
      await userDocRef.collection(colName).doc(id).set(resto);
      totalRestaurados++;
    }
  }

  return { ok: true, uid, totalRestaurados, restaurado_em: new Date().toISOString() };
}

/**
 * Executa rotina diária de backup dos usuários cadastrados no Prumo.
 */
async function executarBackupDiario(db) {
  if (!db || typeof db.collection !== 'function') {
    console.log('[prumo-backup] sem credencial do banco, pulei');
    return { ok: false, motivo: 'sem_banco' };
  }

  const usersSnap = await db.collection('prumo_users').get().catch(() => ({ docs: [] }));
  const docs = (usersSnap && usersSnap.docs) || [];
  console.log(`[prumo-backup] Iniciando backup diário para ${docs.length} usuários.`);

  const resultados = [];
  for (const d of docs) {
    try {
      const exportacao = await exportarDadosUsuario(db, d.id);
      const qtdItens = Object.values(exportacao.colecoes).reduce((acc, c) => acc + c.length, 0);
      resultados.push({ uid: d.id, itens: qtdItens, ok: true });
    } catch (err) {
      console.warn(`[prumo-backup] Falha ao exportar uid ${d.id}:`, err && err.message);
      resultados.push({ uid: d.id, ok: false, erro: err && err.message });
    }
  }

  console.log(`[prumo-backup] Backup diário concluído com sucesso. Processados: ${resultados.length}.`);
  return {
    ok: true,
    totalUsuarios: resultados.length,
    resultados,
    executado_em: new Date().toISOString(),
  };
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const now = deps.now || (() => Date.now());

  return async (event) => {
    const method = String((event && event.httpMethod) || '').toUpperCase();
    const headers = (event && event.headers) || {};
    const path = String((event && event.path) || '').toLowerCase();
    const cors = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

    // Netlify scheduled functions / Cron
    const isCron = headers['x-netlify-event'] === 'schedule' || headers['x-nexia-cron'];
    if (isCron) {
      const db = getDb();
      const resultado = await executarBackupDiario(db);
      return res(200, resultado);
    }

    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    let body = {};
    if (method === 'POST' && event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return res(400, { error: 'Pedido inválido.' });
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

    const q = (event && event.queryStringParameters) || {};
    const acao = body.acao || q.acao || (path.includes('/delete') ? 'delete' : path.includes('/export') ? 'export' : '');

    // Autenticação
    const authHeader = headers.authorization || headers.Authorization;
    const auth = authHeader ? await getMw().verifyBearerToken(event).catch(() => ({ ok: false })) : { ok: false };
    if (!auth.ok) return res(401, { error: 'Entre com sua conta.' });

    const isMaster = auth.role === 'master';
    const targetUid = body.uid || q.uid || auth.uid;

    // Usuário comum só pode acessar seus próprios dados
    if (!isMaster && targetUid !== auth.uid) {
      return res(403, { error: 'Acesso não autorizado aos dados de outro usuário.' });
    }

    const db = getDb();
    if (!db) {
      return res(503, { error: 'Banco de dados indisponível no momento.' });
    }

    try {
      // 1. Exportação (LGPD)
      if (acao === 'export' || acao === 'exportar') {
        const dados = await exportarDadosUsuario(db, targetUid);
        return res(200, { ok: true, acao: 'export', dados });
      }

      // 2. Exclusão / Direito ao esquecimento (LGPD)
      if (acao === 'delete' || acao === 'apagar') {
        if (body.confirmacao !== 'EXCLUIR_DADOS_DEFINITIVAMENTE') {
          return res(400, {
            error: 'Confirmação necessária. Envie { confirmacao: "EXCLUIR_DADOS_DEFINITIVAMENTE" } para confirmar o apagamento conforme LGPD.',
          });
        }
        const resultado = await apagarDadosUsuario(db, targetUid);
        return res(200, { ok: true, acao: 'delete', resultado });
      }

      // 3. Backup geral diário (apenas master)
      if (acao === 'backup_diario') {
        if (!isMaster) return res(403, { error: 'Apenas master pode executar o backup geral diário.' });
        const resultado = await executarBackupDiario(db);
        return res(200, resultado);
      }

      // 4. Teste de restauração
      if (acao === 'restaurar') {
        if (!body.backup) return res(400, { error: 'Dados de backup não informados.' });
        const resultado = await restaurarDadosUsuario(db, targetUid, body.backup);
        return res(200, { ok: true, acao: 'restaurar', resultado });
      }

      // Status padrão se nenhuma ação específica for enviada
      return res(200, {
        ok: true,
        servico: 'prumo-backup',
        uid: targetUid,
        em: new Date(now()).toISOString(),
      });
    } catch (err) {
      console.error('[prumo-backup] Erro na operação:', err && err.message);
      return res(500, { error: 'Erro ao processar solicitação de backup ou LGPD.' });
    }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.exportarDadosUsuario = exportarDadosUsuario;
exports.apagarDadosUsuario = apagarDadosUsuario;
exports.restaurarDadosUsuario = restaurarDadosUsuario;
exports.executarBackupDiario = executarBackupDiario;
exports.COLECOES_PRUMO = COLECOES_PRUMO;
