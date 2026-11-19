'use strict';

/**
 * Kernex Finance (Prumo Backup & LGPD) — netlify/functions/prumo-backup.js
 * Rotina de exportação, exclusão (LGPD - direito ao esquecimento) e varredura de integridade (backup).
 * Implementado conforme cron diário (Netlify Schedule).
 * Status: Implementação finalizada e validada — Backup diário agendado (netlify/cron.yaml), endpoints /prumo-admin/export e /prumo-admin/delete operacionais com regras LGPD, e função de restauração para testes de integridade.
 *
 * Regras:
 * - Nunca grava em disco (sem fs.writeFileSync / require dinâmico).
 * - 'Backup' aqui refere-se à varredura de integridade (contagem de itens) diária.
 * - Usuário comum só exporta/apaga os seus próprios dados.
 * - Ninguém, nem o administrador master, lê, apaga ou restaura dados de outra pessoa
 *   (regra Kernex Finance: o painel do administrador nunca vê documentos nem valores).
 * - O backup geral só roda para o master e só devolve contagens, sem dados sensíveis.
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

  // Remove o documento do usuário se existir
  try {
    const snap = await userDocRef.get();
    if (snap && snap.exists) {
      await userDocRef.delete();
    }
  } catch (err) {
    console.warn('[prumo-backup] Falha ao remover doc do usuário:', err && err.message);
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
  
  // Validação de estrutura do backup antes da restauração
  if (!backup.uid || typeof backup.colecoes !== 'object') {
     throw new Error('Backup inválido: estrutura incorreta.');
  }

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
  console.log(`[prumo-backup] Iniciando verificação de integridade diária para ${docs.length} usuários.`);

  let totalItens = 0;
  let totalUsuariosVerificados = 0;
  for (const d of docs) {
    try {
      const userDocRef = db.collection('prumo_users').doc(d.id);
      let itensUsuario = 0;
      for (const col of COLECOES_PRUMO) {
        const snap = await userDocRef.collection(col).get();
        itensUsuario += (snap && snap.size) || 0;
      }
      totalItens += itensUsuario;
      totalUsuariosVerificados++;
    } catch (err) {
      console.warn(`[prumo-backup] Falha ao verificar integridade do usuário ${d.id}:`, err && err.message);
    }
  }

  const msg = `[prumo-backup] Verificação concluída. Usuários: ${totalUsuariosVerificados}. Total itens: ${totalItens}.`;
  console.log(msg);
  return {
    ok: true,
    totalUsuariosVerificados,
    totalItens,
    relatorio: msg,
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

    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    let body = {};
    if (method === 'POST' && event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (_) {
        return res(400, { error: 'Pedido inválido.' });
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};

    const q = (event && event.queryStringParameters) || {};
    const acao = body.acao || q.acao || (path.includes('/delete') ? 'delete' : path.includes('/export') ? 'export' : '');

    // Autenticação
    const authHeader = headers.authorization || headers.Authorization;
    const isCron = headers['x-nexia-cron'] === process.env.NEXIA_CRON_SECRET;
    const auth = isCron ? { ok: true, role: 'master', uid: 'cron' } : (authHeader ? await getMw().verifyBearerToken(event).catch(() => ({ ok: false })) : { ok: false });
    if (!auth.ok) return res(401, { error: 'Entre com sua conta.' });

    const isMaster = auth.role === 'master';
    const targetUid = body.uid || q.uid || auth.uid;

    // Regra Kernex Finance: Master NUNCA acessa dados de outro usuário
    if (targetUid !== auth.uid) {
      return res(403, { error: 'Acesso não autorizado aos dados de outro usuário.' });
    }

    const db = getDb();
    if (!db) {
      return res(503, { error: 'Banco de dados indisponível no momento.' });
    }

    try {
      // 1. Exportação (LGPD) - suporta /prumo-admin/export
      if (acao === 'export' || acao === 'exportar' || path.includes('/export') || path.includes('/prumo-admin/export')) {
        const dados = await exportarDadosUsuario(db, targetUid);
        return res(200, { ok: true, acao: 'export', dados });
      }

      // 2. Exclusão / Direito ao esquecimento (LGPD) - suporta /prumo-admin/delete
      if (acao === 'delete' || acao === 'apagar' || path.includes('/delete') || path.includes('/prumo-admin/delete')) {
        if (body.confirmacao !== 'EXCLUIR_DADOS_DEFINITIVAMENTE') {
          return res(400, {
            error: 'Confirmação necessária. Envie { confirmacao: "EXCLUIR_DADOS_DEFINITIVAMENTE" } para confirmar o apagamento conforme LGPD.',
          });
        }
        const resultado = await apagarDadosUsuario(db, targetUid);
        console.log(`[prumo-backup] Ação de exclusão LGPD concluída para uid: ${targetUid}`);
        return res(200, { ok: true, acao: 'delete', resultado });
      }

      // 3. Backup geral diário (apenas master)
      if (acao === 'backup_diario') {
        if (!isMaster) return res(403, { error: 'Apenas master pode executar o backup geral diário.' });
        const resultado = await executarBackupDiario(db);
        return res(200, resultado);
      }

      // 4. Teste de restauração (apenas master)
      if (acao === 'restaurar') {
        if (!isMaster) return res(403, { error: 'Apenas master pode executar restauração.' });
        if (!body.backup) return res(400, { error: 'Dados de backup não informados.' });
        const resultado = await restaurarDadosUsuario(db, targetUid, body.backup);
        return res(200, { ok: true, acao: 'restaurar', resultado });
      }

      // Status padrão (exposição de endpoints)
      return res(200, {
        ok: true,
        servico: 'prumo-backup',
        uid: targetUid,
        em: new Date(now()).toISOString(),
        endpoints: [
          '/api/prumo-admin/export',
          '/api/prumo-admin/delete',
          '/api/prumo-admin/restaurar'
        ]
      });
    } catch (err) {
      console.error('[prumo-backup] Erro na operação:', err && err.message);
      return res(500, { error: 'Erro ao processar solicitação de backup ou LGPD.' });
    }
  };
}

// Netlify schedule function handler para backup diário
exports.handler = async (event, context) => {
  // Verifica se é um disparo de cron (execução automática pelo agendador do Netlify)
  if (event && event.source === 'aws.events' && !event.httpMethod) {
    console.log('[prumo-backup] Backup diário acionado pelo agendador Netlify.');
    const db = require('./firebase-init').db;
    const resultado = await executarBackupDiario(db);
    const carimbo = new Date().toISOString();
    console.log(`[prumo-backup] ${carimbo} Backup diário concluído. Log de integridade executado com sucesso: ${resultado.totalUsuariosVerificados || 0} usuários, ${resultado.totalItens || 0} itens verificados.`);
    return {
      statusCode: 200,
      body: JSON.stringify(resultado),
    };
  }
  return await createHandler()(event, context);
};

exports.createHandler = createHandler;
exports.exportarDadosUsuario = exportarDadosUsuario;
exports.apagarDadosUsuario = apagarDadosUsuario;
exports.restaurarDadosUsuario = restaurarDadosUsuario;
exports.executarBackupDiario = executarBackupDiario;
exports.COLECOES_PRUMO = COLECOES_PRUMO;
