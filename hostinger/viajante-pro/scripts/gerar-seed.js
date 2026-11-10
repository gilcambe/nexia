'use strict';
// Gera sql/seed.sql passando pela API de verdade (banco SQLite temporário), para os dados de
// exemplo terem exatamente o formato que as telas esperam.
// Uso: node scripts/gerar-seed.js   (precisa do Node 22+, por causa do node:sqlite)
const fs = require('node:fs');
const path = require('node:path');
const { criarApp } = require('../server');
const { sqliteDriver } = require('../lib/drivers');
const { VIAJANTE_PRO } = require(path.join(process.env.VP_RAIZ || path.resolve(__dirname, '..', '..', '..'), 'clientes', 'viajantepro.js'));

async function main() {
  const driver = sqliteDriver(':memory:');
  const env = { FORCE_HTTPS: '0' };
  const { servidor, db } = criarApp({ env, driver, semSmtp: true });
  await new Promise(r => servidor.listen(0, r));
  const base = 'http://127.0.0.1:' + servidor.address().port;
  const api = async corpo => (await fetch(base + '/api/viajante-pro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })).json();

  // 1 admin: a conta do painel com a MESMA senha inicial de hoje (só o hash, que já está no repositório).
  const cad = VIAJANTE_PRO.viajantepro;
  const ini = cad.senhas_iniciais[0];
  await db.collection('viajante_contas').doc('viajantepro').set({
    nome: cad.nome, versao: cad.versao || 1, senha_hash: ini.hash, senha_salt: ini.salt, config: cad.config,
    criado_em: new Date().toISOString(),
  });
  // Sessão só para criar os exemplos (não vai para o seed).
  const tokenTmp = 'seed-' + Date.now();
  const crypto = require('node:crypto');
  const th = crypto.createHash('sha256').update(tokenTmp).digest('hex');
  await db.collection('viajante_contas').doc('viajantepro').collection('sessoes').doc(th).set({ criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 3600e3).toISOString() });

  await api({ acao: 'solicitar_cotacao', nome: 'Cliente Exemplo', email: 'cliente.exemplo@exemplo.com', whatsapp: '11999990000', origem: 'São Paulo', destino: 'Gramado', modalidades: ['aereo', 'hotel'], adultos: 2, criancas: 1, orcamento: 'R$ 8.000', consentimento: true, observacoes: 'Cotação de EXEMPLO criada pelo seed.sql. Pode apagar.' });
  const v = await api({ token: tokenTmp, acao: 'viagem-criar', nome: 'Viagem de Exemplo', destino: 'Gramado - RS', datas: { inicio: '2026-12-20', fim: '2026-12-27' }, passageiros: [{ nome: 'Passageiro Exemplo', email: 'passageiro@exemplo.com' }], roteiro: [{ dia: 1, descricao: 'Chegada e check-in' }, { dia: 2, descricao: 'Tour pela Serra Gaúcha' }] });
  await api({ token: tokenTmp, acao: 'chat-enviar', v: v.id, texto: 'Bem-vindo! Esta é uma mensagem de exemplo.' });
  await driver.apagar(`viajante_contas/viajantepro/sessoes/${th}`);

  const linhas = driver._todos();
  const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
  let sql = `-- Viajante Pro (Hostinger): dados de EXEMPLO para validar. Gerado por scripts/gerar-seed.js em ${new Date().toISOString().slice(0, 10)}.
-- Importar DEPOIS do schema.sql (phpMyAdmin > Importar).
-- Admin do painel: a MESMA senha do painel de hoje. Troque em Cotações > "Trocar senha" logo no 1º acesso.
-- App do passageiro de exemplo: /viajante-pro/app?v=${linhas.find(l => l.colecao.endsWith('/viagens')) ? JSON.parse(linhas.find(l => l.colecao.endsWith('/viagens')).dados).codigoSecreto : ''}
SET NAMES utf8mb4;
`;
  for (const l of linhas) {
    sql += `INSERT INTO vp_documentos (caminho, colecao, doc_id, dados) VALUES (${q(l.caminho)}, ${q(l.colecao)}, ${q(l.doc_id)}, ${q(l.dados)}) ON DUPLICATE KEY UPDATE dados = VALUES(dados);\n`;
  }
  const destino = path.join(__dirname, '..', 'sql', 'seed.sql');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, sql);
  servidor.close();
  console.log(`seed.sql gerado com ${linhas.length} registros.`);
}
main().catch(e => { console.error(e); process.exit(1); });
