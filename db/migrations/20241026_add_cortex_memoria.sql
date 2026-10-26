CREATE TABLE IF NOT EXISTS cortex_memoria (
  uid TEXT NOT NULL,
  id TEXT NOT NULL PRIMARY KEY,
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  usado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cortex_memoria_uid ON cortex_memoria(uid);
CREATE INDEX IF NOT EXISTS idx_cortex_memoria_tipo ON cortex_memoria(tipo);
