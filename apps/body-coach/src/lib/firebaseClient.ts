// Cliente Firebase do NEXIA Body Coach (ADR-CLONE-02).
// Substitui o Supabase do app original do READDY: Auth (e-mail/senha) + Firestore.
// A configuração pública do app da Web vem do próprio Worker (/api/firebase-config),
// igual ao site principal (src/services/firebase.ts). Nada de chave fixa no código.
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

// Mesmo nome de variável do site principal (src/config/env.ts): vazio = API no mesmo endereço.
const API_BASE: string = (import.meta.env.VITE_NEXIA_API_URL as string | undefined) || '';

let pending: Promise<FirebaseHandles | null> | null = null;

// A configuração pública do Firebase (não é segredo) fica guardada no aparelho para o app abrir sem internet.
export const CHAVE_CFG_FIREBASE = 'bc_firebase_cfg';
function cfgGuardada(): FirebaseOptions | null {
  try {
    const cfg = JSON.parse(localStorage.getItem(CHAVE_CFG_FIREBASE) || 'null') as FirebaseOptions | null;
    return cfg && typeof cfg.apiKey === 'string' && cfg.apiKey ? cfg : null;
  } catch { return null; }
}

async function buscarConfigNaRede(): Promise<FirebaseOptions | null> {
  try {
    const res = await fetch(`${API_BASE}/api/firebase-config`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return cfgGuardada();
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return cfgGuardada();
    const cfg = (await res.json()) as FirebaseOptions;
    if (cfg && cfg.apiKey) {
      try { localStorage.setItem(CHAVE_CFG_FIREBASE, JSON.stringify(cfg)); } catch { /* sem armazenamento */ }
      return cfg;
    }
    return null;
  } catch {
    return cfgGuardada(); // sem internet: usa a da última vez
  }
}

// #811: login instantâneo. Com a config guardada no aparelho, o app abre na hora (o login salvo no
// IndexedDB do Firebase volta sem esperar o Worker) e a rede só atualiza a config para a próxima vez.
// Sem config guardada (1ª vez), espera a rede como antes.
async function loadConfig(): Promise<FirebaseOptions | null> {
  const guardada = cfgGuardada();
  const rede = buscarConfigNaRede();
  if (guardada) { rede.catch(() => null); return guardada; }
  return rede;
}

// Dados do Firestore guardados no aparelho (abre com os dados de hoje sem rede e atualiza depois).
// Se o navegador não deixar (modo anônimo, IndexedDB bloqueado), segue como antes, só na memória.
function abrirFirestore(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    return getFirestore(app);
  }
}

// Inicializa uma única vez (singleton). Retorna null se o backend não estiver disponível
// (ex.: `vite preview` local sem o Worker) — o app mostra uma mensagem amigável.
export function getFirebase(): Promise<FirebaseHandles | null> {
  if (!pending) {
    pending = (async () => {
      const cfg = await loadConfig();
      if (!cfg) {
        pending = null; // tenta de novo na próxima chamada
        return null;
      }
      const app = getApps().find((a) => a.name === 'body-coach') ?? initializeApp(cfg, 'body-coach');
      const auth = getAuth(app); // no navegador o getAuth já guarda o login no IndexedDB (cai para localStorage)
      const db = abrirFirestore(app);
      // Só em testes locais (build com VITE_BODYCOACH_EMULATORS=1): usa o Firebase Emulator.
      // Builds de produção nunca definem essa variável.
      if (import.meta.env.VITE_BODYCOACH_EMULATORS === '1') {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
      }
      return { app, auth, db };
    })();
  }
  return pending;
}
