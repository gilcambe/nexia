import fs from 'fs';
import path from 'path';

export async function runMigrations(db: any) {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs.readdirSync(migrationsDir).sort();
  for (const file of files) {
    if (file.endsWith('.sql')) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const statement of statements) {
        try {
          await db.prepare(statement).run();
        } catch (e) {
          console.error(`Erro ao executar migração ${file}:`, e);
        }
      }
    }
  }
}

export async function initDb(db: any) {
  await runMigrations(db);
}
