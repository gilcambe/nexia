// Cliente Firebase do NEXIA Body Coach (ADR-CLONE-02).
// Substitui o Supabase do app original do READDY: Auth (e-mail/senha) + Firestore.
// A configuração pública do app da Web vem do próprio Worker (/api/firebase-config),
// igual ao site principal (src/services/firebase.ts). Nada de chave fixa no código.
// No MODO LOCAL (admin / admin01) nada aqui é chamado: tudo fica no navegador.
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

// Mesmo nome de variável do site principal (src/config/env.ts): vazio = API no mesmo endereço.
const API_BASE: string = (import.meta.env.VITE_NEXIA_API_URL as string | undefined) || '';

let pending: Promise<FirebaseHandles | null> | null = null;

async function loadConfig(): Promise<FirebaseOptions | null> {
  try {
    const res = await fetch(`${API_BASE}/api/firebase-config`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return null;
    const cfg = (await res.json()) as FirebaseOptions;
    return cfg && cfg.apiKey ? cfg : null;
  } catch {
    return null;
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
      const auth = getAuth(app);
      const db = getFirestore(app);
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
