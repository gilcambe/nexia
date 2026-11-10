'use strict';
// Drivers SQL para o DocStore.
//  - mysql:  produção na Hostinger (pacote mysql2, instalado pela Hostinger no deploy).
//  - sqlite: testes locais/CI (node:sqlite, já vem no Node 22+). Nunca usado em produção.

const SQL_TABELA_MYSQL = `CREATE TABLE IF NOT EXISTS vp_documentos (
  caminho       VARCHAR(512) NOT NULL,
  colecao       VARCHAR(512) NOT NULL,
  doc_id        VARCHAR(190) NOT NULL,
  dados         LONGTEXT     NOT NULL,
  criado_em     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (caminho),
  KEY idx_colecao (colecao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

function mysqlDriver(cfg) {
  let mysql;
  try { mysql = require('mysql2/promise'); } catch (e) {
    throw new Error('Pacote mysql2 não instalado. Rode "npm install" na pasta do app.');
  }
  const pool = mysql.createPool({
    host: cfg.host || 'localhost',
    port: Number(cfg.port) || 3306,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    charset: 'utf8mb4',
    connectionLimit: 5,
    waitForConnections: true,
  });
  return {
    tipo: 'mysql',
    async preparar() { await pool.query(SQL_TABELA_MYSQL); },
    async ler(caminho) {
      const [rows] = await pool.execute('SELECT dados FROM vp_documentos WHERE caminho = ?', [caminho]);
      return rows.length ? rows[0].dados : null;
    },
    async listar(colecao) {
      const [rows] = await pool.execute('SELECT doc_id, dados FROM vp_documentos WHERE colecao = ? ORDER BY criado_em, doc_id', [colecao]);
      return rows;
    },
    async gravar(caminho, colecao, docId, json) {
      await pool.execute(
        'INSERT INTO vp_documentos (caminho, colecao, doc_id, dados) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE dados = VALUES(dados)',
        [caminho, colecao, docId, json],
      );
    },
    async apagar(caminho) { await pool.execute('DELETE FROM vp_documentos WHERE caminho = ?', [caminho]); },
    async saude() { await pool.query('SELECT 1'); return true; },
    async fechar() { await pool.end(); },
  };
}

function sqliteDriver(arquivo = ':memory:') {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(arquivo);
  db.exec(`CREATE TABLE IF NOT EXISTS vp_documentos (
    caminho TEXT PRIMARY KEY, colecao TEXT NOT NULL, doc_id TEXT NOT NULL, dados TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')), atualizado_em TEXT)`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_colecao ON vp_documentos(colecao)');
  const sLer = db.prepare('SELECT dados FROM vp_documentos WHERE caminho = ?');
  const sListar = db.prepare('SELECT doc_id, dados FROM vp_documentos WHERE colecao = ? ORDER BY criado_em, doc_id');
  const sGravar = db.prepare(`INSERT INTO vp_documentos (caminho, colecao, doc_id, dados) VALUES (?, ?, ?, ?)
    ON CONFLICT(caminho) DO UPDATE SET dados = excluded.dados, atualizado_em = strftime('%Y-%m-%d %H:%M:%f','now')`);
  const sApagar = db.prepare('DELETE FROM vp_documentos WHERE caminho = ?');
  return {
    tipo: 'sqlite',
    async preparar() {},
    async ler(c) { const r = sLer.get(c); return r ? r.dados : null; },
    async listar(c) { return sListar.all(c); },
    async gravar(c, col, id, json) { sGravar.run(c, col, id, json); },
    async apagar(c) { sApagar.run(c); },
    async saude() { return true; },
    async fechar() { db.close(); },
    _todos() { return db.prepare('SELECT caminho, colecao, doc_id, dados FROM vp_documentos ORDER BY criado_em, caminho').all(); },
  };
}

module.exports = { mysqlDriver, sqliteDriver, SQL_TABELA_MYSQL };
