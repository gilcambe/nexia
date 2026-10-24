// Nunca abrir em branco (ver também o script no index.html).
// Recuperar = apagar a cópia guardada do app (service worker e caches) e abrir de novo, com a versão nova.
// Com `dadosLocais`, apaga também a cópia local do banco (Firestore no IndexedDB), que às vezes trava a abertura.
// O login (firebaseLocalStorageDb) e as preferências (localStorage) ficam: ninguém precisa entrar de novo.
export const CHAVE_RECUPEROU = 'bc_recuperou_em';

export function recuperouAgora(ms = 120000): boolean {
  try { return Date.now() - (Number(localStorage.getItem(CHAVE_RECUPEROU)) || 0) < ms; } catch { return false; }
}

export async function recuperarApp(opcoes: { dadosLocais?: boolean } = {}): Promise<void> {
  try { localStorage.setItem(CHAVE_RECUPEROU, String(Date.now())); } catch { /* sem armazenamento */ }
  const tarefas: Promise<unknown>[] = [];
  try {
    if (navigator.serviceWorker) tarefas.push(navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((g) => g.unregister()))));
  } catch { /* sem SW */ }
  try {
    if (typeof caches !== 'undefined') tarefas.push(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
  } catch { /* sem cache */ }
  if (opcoes.dadosLocais) {
    try {
      const idb = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> };
      if (idb.databases) {
        tarefas.push(idb.databases().then((dbs) => Promise.all(dbs
          .filter((d) => d.name && d.name.startsWith('firestore/'))
          .map((d) => new Promise((ok) => { const r = indexedDB.deleteDatabase(d.name!); r.onsuccess = r.onerror = r.onblocked = () => ok(null); })))));
      }
    } catch { /* sem IndexedDB */ }
  }
  await Promise.race([Promise.allSettled(tarefas), new Promise((ok) => setTimeout(ok, 3000))]);
  const u = new URL(location.href);
  u.searchParams.set('v', String(Date.now()));
  location.replace(u.href);
}
