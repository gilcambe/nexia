import fs from 'fs';
import path from 'path';

export interface DBRecord {
  uid: string;
  id: string;
  [key: string]: any;
}

export class SimpleORM {
  private dataDir: string;

  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getTablePath(table: string): string {
    return path.join(this.dataDir, `${table}.json`);
  }

  public runMigration(migrationName: string): void {
    const migrationPath = path.join('db', 'migrations', `${migrationName}.sql`);
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      console.log(`[DB] Aplicando migração: ${migrationName}`);
      
      // Para migrações SQL, verificamos se é uma criação de tabela
      if (sql.includes('CREATE TABLE IF NOT EXISTS cortex_memoria')) {
        const tablePath = this.getTablePath('cortex_memoria');
        
        // Verificar se o arquivo já existe
        if (!fs.existsSync(tablePath)) {
          // Criar arquivo vazio para a nova tabela
          fs.writeFileSync(tablePath, '[]', 'utf8');
          console.log(`[DB] Tabela cortex_memoria criada: ${tablePath}`);
        }
      }
    }
  }

  public insert(table: string, record: DBRecord): void {
    // Validação estrita do DBRecord
    if (!record.uid || !record.id) {
      throw new Error('DBRecord deve conter uid e id');
    }
    
    const filePath = this.getTablePath(table);
    let records: DBRecord[] = [];
    if (fs.existsSync(filePath)) {
      try {
        records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        records = [];
      }
    }
    const index = records.findIndex(r => r.id === record.id);
    if (index >= 0) {
      records[index] = record;
    } else {
      records.push(record);
    }
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
  }

  public findById(table: string, id: string): DBRecord | null {
    const filePath = this.getTablePath(table);
    if (!fs.existsSync(filePath)) return null;
    try {
      const records: DBRecord[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const found = records.find(r => r.id === id);
      return found || null;
    } catch {
      return null;
    }
  }
}

export const db = new SimpleORM();
db.runMigration('20241026_add_cortex_memoria');
