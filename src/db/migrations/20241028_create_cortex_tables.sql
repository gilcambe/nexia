CREATE TABLE IF NOT EXISTS conversas (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  titulo TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mensagens (
  id TEXT PRIMARY KEY,
  conversas_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  papel TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversas_id) REFERENCES conversas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uso (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  modelo TEXT NOT NULL,
  tokens_prompt INTEGER DEFAULT 0,
  tokens_resposta INTEGER DEFAULT 0,
  custo REAL DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversas_uid ON conversas(uid);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversas_id ON mensagens(conversas_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_uid ON mensagens(uid);
CREATE INDEX IF NOT EXISTS idx_uso_uid ON uso(uid);
