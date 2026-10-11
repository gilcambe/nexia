// Fila de envios para quando a internet da academia cai: o que não chegou ao banco fica guardado
// no celular e vai sozinho quando a conexão volta (ao abrir o app ou no evento "online").
import { chatApi } from './chat';
import { setUserDoc, type BodyCoachCollection } from './userData';

type Pendente = { chave: string; em: number } & (
  | { tipo: 'doc'; coll: BodyCoachCollection; id: string; dados: Record<string, unknown>; merge: boolean }
  | { tipo: 'api'; corpo: Record<string, unknown> });

const novaChave = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const chave = (uid: string) => `bc_pendentes_${uid}`;
const LIMITE_MS = 8000;

function ler(uid: string): Pendente[] {
  try {
    const v = JSON.parse(localStorage.getItem(chave(uid)) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function gravar(uid: string, lista: Pendente[]) {
  try {
    if (lista.length) localStorage.setItem(chave(uid), JSON.stringify(lista.slice(-50)));
    else localStorage.removeItem(chave(uid));
  } catch { /* sem armazenamento */ }
}

// Sem internet, o Firestore não responde nem dá erro: a gravação fica esperando. Por isso há um limite de tempo.
function comLimite<T>(p: Promise<T>): Promise<T> {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error('sem resposta')), LIMITE_MS);
    p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); falha(e); });
  });
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// Falha de conexão (tenta de novo depois) ou recusa do servidor (não adianta repetir: sai da fila)?
function ehRede(e: unknown): boolean {
  const err = e as { name?: string; message?: string; code?: string } | null;
  if (e instanceof TypeError) return true;
  return /sem resposta|demorou|network|offline|unavailable|deadline|failed to fetch|load failed/i.test(`${err?.message ?? ''} ${err?.code ?? ''}`);
}

async function tentar(uid: string, p: Pendente): Promise<void> {
  if (p.tipo === 'doc') await comLimite(setUserDoc(uid, p.coll, p.id, p.dados, p.merge));
  else await chatApi(p.corpo); // a API já desiste sozinha; sem limite extra para não contar o mesmo treino duas vezes
}

// Grava já ou, se não der, guarda para enviar depois. Devolve false quando ficou na fila.
export async function gravarOuGuardar(uid: string, coll: BodyCoachCollection, id: string, dados: Record<string, unknown>, merge = false): Promise<boolean> {
  const p: Pendente = { chave: novaChave(), tipo: 'doc', coll, id, dados, merge, em: Date.now() };
  if (!offline()) {
    try { await tentar(uid, p); return true; } catch (e) { if (!ehRede(e)) throw e; }
  }
  gravar(uid, [...ler(uid).filter((x) => !(x.tipo === 'doc' && x.coll === coll && x.id === id && !merge)), p]);
  return false;
}

export async function apiOuGuardar(uid: string, corpo: Record<string, unknown>): Promise<boolean> {
  const p: Pendente = { chave: novaChave(), tipo: 'api', corpo, em: Date.now() };
  if (!offline()) {
    try { await tentar(uid, p); return true; } catch (e) { if (!ehRede(e)) return true; } // recusado: não adianta guardar
  }
  gravar(uid, [...ler(uid), p]);
  return false;
}

export const quantosPendentes = (uid: string) => ler(uid).length;

let enviando = false;
// Manda tudo o que ficou guardado, na ordem. Parou num, os seguintes esperam a próxima vez.
export async function enviarPendentes(uid: string): Promise<number> {
  if (enviando || offline()) return 0;
  enviando = true;
  const enviados = new Set<string>();
  try {
    for (const p of ler(uid)) {
      try { await tentar(uid, p); enviados.add(p.chave); } catch (e) { if (ehRede(e)) break; enviados.add(p.chave); }
    }
    // relê: algo pode ter entrado na fila enquanto enviava
    if (enviados.size) gravar(uid, ler(uid).filter((p) => !enviados.has(p.chave)));
  } finally {
    enviando = false;
  }
  return enviados.size;
}
