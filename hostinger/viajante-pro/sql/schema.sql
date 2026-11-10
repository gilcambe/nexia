-- Viajante Pro (Hostinger) — estrutura do banco MySQL/MariaDB.
-- Importar no phpMyAdmin do banco NOVO do Viajante Pro (Importar > escolher este arquivo > Executar).
-- O app também cria a tabela sozinho ao ligar, então importar isto é opcional (mas recomendado).
--
-- Uma tabela guarda tudo, no mesmo formato que o Firestore guardava (documento = JSON).
-- É isso que deixa a API rodar sem mudar uma linha da lógica. As VIEWS abaixo mostram
-- cada "coleção" como uma tabela separada, para consultar fácil no phpMyAdmin.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS vp_documentos (
  caminho       VARCHAR(512) NOT NULL,
  colecao       VARCHAR(512) NOT NULL,
  doc_id        VARCHAR(190) NOT NULL,
  dados         LONGTEXT     NOT NULL,
  criado_em     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (caminho),
  KEY idx_colecao (colecao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Visões por coleção (só leitura, para conferir dados).
CREATE OR REPLACE VIEW vp_cotacoes AS
  SELECT doc_id AS id,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.codigo'))    AS codigo,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.nome'))      AS nome,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.email'))     AS email,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.whatsapp'))  AS whatsapp,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.destino'))   AS destino,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.status'))    AS status,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.criado_em')) AS criado_em,
         dados
  FROM vp_documentos WHERE colecao = 'viajante_contas/viajantepro/cotacoes';

CREATE OR REPLACE VIEW vp_viagens AS
  SELECT doc_id AS id,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.nome'))      AS nome,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.destino'))   AS destino,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.email'))     AS email,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.criado_em')) AS criado_em,
         dados
  FROM vp_documentos WHERE colecao = 'viajante_contas/viajantepro/viagens';

CREATE OR REPLACE VIEW vp_mensagens AS
  SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(colecao, '/', -2), '/', 1) AS viagem_id,
         doc_id AS id,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.autor'))     AS autor,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.texto'))     AS texto,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.criado_em')) AS criado_em
  FROM vp_documentos WHERE colecao LIKE 'viajante_contas/viajantepro/viagens/%/mensagens';

CREATE OR REPLACE VIEW vp_fotos AS
  SELECT doc_id AS id,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.tipo'))      AS tipo,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.criado_em')) AS criado_em
  FROM vp_documentos WHERE colecao = 'viajante_contas/viajantepro/fotos';

CREATE OR REPLACE VIEW vp_passageiro_solicitacoes AS
  SELECT doc_id AS id,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.email'))     AS email,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.tipo'))      AS tipo,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.mensagem'))  AS mensagem,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.status'))    AS status,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.criado_em')) AS criado_em
  FROM vp_documentos WHERE colecao = 'viajante_contas/viajantepro/pax_solicitacoes';

CREATE OR REPLACE VIEW vp_leads AS
  SELECT doc_id AS id,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.nome'))      AS nome,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.email'))     AS email,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.whatsapp'))  AS whatsapp,
         JSON_UNQUOTE(JSON_EXTRACT(dados, '$.criado_em')) AS criado_em
  FROM vp_documentos WHERE colecao = 'nexia_leads';
