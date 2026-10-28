import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.D1_DATABASE_URL,
  authToken: process.env.D1_AUTH_TOKEN,
});

async function createKey(hash, clientId) {
  const createdAt = new Date().toISOString();
  await client.execute({
    sql: 'INSERT INTO api_keys (hash, client_id, created_at) VALUES (?, ?, ?)',
    args: [hash, clientId, createdAt],
  });
}

async function getKey(hash) {
  const result = await client.execute({
    sql: 'SELECT * FROM api_keys WHERE hash = ?',
    args: [hash],
  });
  return result.rows[0];
}

async function deleteKey(hash) {
  await client.execute({
    sql: 'DELETE FROM api_keys WHERE hash = ?',
    args: [hash],
  });
}

async function incUsage(hash) {
  const usedAt = new Date().toISOString();
  await client.execute({
    sql: 'UPDATE api_keys SET used_at = ?, usage_count = COALESCE(usage_count, 0) + 1 WHERE hash = ?',
    args: [usedAt, hash],
  });
}

export { createKey, getKey, deleteKey, incUsage };
