// Fotos e vídeos curtos tirados durante o treino ("momentos"), guardados só no celular (IndexedDB)
// para virar post do Instagram no fim. Nada sobe para o servidor. Somem sozinhos depois de 2 dias.
export interface Momento { id: string; tipo: 'foto' | 'video'; blob: Blob; em: number }

const BANCO = 'bc_momentos';
const LOJA = 'momentos';
const VALIDADE_MS = 2 * 86400000;
export const MAX_MOMENTOS = 8;

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    if (typeof indexedDB === 'undefined') return erro(new Error('sem IndexedDB'));
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(LOJA, { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

async function comLoja<T>(modo: 'readonly' | 'readwrite', fazer: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const t = db.transaction(LOJA, modo);
    const req = fazer(t.objectStore(LOJA));
    t.oncomplete = () => { db.close(); ok(req.result); };
    t.onerror = () => { db.close(); erro(t.error); };
  });
}

export const tipoDoArquivo = (f: Blob): 'foto' | 'video' | null => (f.type.startsWith('image/') ? 'foto' : f.type.startsWith('video/') ? 'video' : null);

export async function listarMomentos(): Promise<Momento[]> {
  try {
    const todos = await comLoja<Momento[]>('readonly', (s) => s.getAll() as IDBRequest<Momento[]>);
    const velhos = todos.filter((m) => Date.now() - m.em > VALIDADE_MS);
    for (const m of velhos) await apagarMomento(m.id);
    return todos.filter((m) => Date.now() - m.em <= VALIDADE_MS).sort((a, b) => a.em - b.em);
  } catch { return []; }
}

export async function guardarMomento(arquivo: Blob): Promise<Momento | null> {
  const tipo = tipoDoArquivo(arquivo);
  if (!tipo) return null;
  const m: Momento = { id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, tipo, blob: arquivo, em: Date.now() };
  try {
    const atuais = await listarMomentos();
    // Guarda só os últimos: tira o mais antigo quando passa do limite.
    for (const velho of atuais.slice(0, Math.max(0, atuais.length - MAX_MOMENTOS + 1))) await apagarMomento(velho.id);
    await comLoja('readwrite', (s) => s.put(m));
    return m;
  } catch { return null; }
}

export async function apagarMomento(id: string): Promise<void> {
  try { await comLoja('readwrite', (s) => s.delete(id)); } catch { /* sem armazenamento */ }
}
