import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebase } from '@/lib/firebaseClient';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import {
  LOCAL_DEMO_EMAIL,
  LOCAL_DEMO_PASSWORD,
  LOCAL_DEMO_USER_ID,
  isLocalDemoActive,
  enableLocalDemo,
  disableLocalDemo,
} from '@/lib/localDemo';
import { localDemoProfile } from '@/mocks/localDemo';

export interface AthleteProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  height_cm: number | null;
  gender: string | null;
  birth_date: string | null;
  goal_weight_kg: number | null;
  goal_body_fat_pct: number | null;
  coach_notes: string | null;
}

// Usuário do app (mesmo formato que as telas do original usam: id, email, user_metadata).
export interface User {
  id: string;
  email: string | null;
  user_metadata: { full_name?: string | null };
}

// Usuário sintético usado no MODO LOCAL (sem backend).
const localDemoUser: User = {
  id: LOCAL_DEMO_USER_ID,
  email: LOCAL_DEMO_EMAIL,
  user_metadata: { full_name: localDemoProfile.full_name },
};

const localDemoAthleteProfile: AthleteProfile = {
  id: LOCAL_DEMO_USER_ID,
  ...localDemoProfile,
};

function toAppUser(u: FirebaseUser): User {
  return { id: u.uid, email: u.email, user_metadata: { full_name: u.displayName } };
}

interface AuthContextValue {
  user: User | null;
  profile: AthleteProfile | null;
  loading: boolean;
  isLocalDemo: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const OFFLINE_MESSAGE =
  'Não consegui falar com o servidor agora. Verifique sua conexão e tente novamente — ou use o acesso de teste (admin / admin01).';

// Normaliza erros do Firebase Auth para mensagens claras em português.
function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/network-request-failed|fetch|network|timeout/i.test(code + ' ' + msg) || !msg) {
    return OFFLINE_MESSAGE;
  }
  if (/invalid-credential|wrong-password|user-not-found|invalid-login-credentials/.test(code)) {
    return 'E-mail ou senha incorretos.';
  }
  if (code === 'auth/email-already-in-use') return 'Este e-mail já tem conta. Use "Entrar".';
  if (code === 'auth/weak-password') return 'Senha fraca: use pelo menos 6 caracteres.';
  if (code === 'auth/invalid-email') return 'E-mail inválido.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (code === 'auth/operation-not-allowed') {
    return 'Login por e-mail e senha ainda não está ativado no Firebase deste projeto.';
  }
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [localDemo, setLocalDemo] = useState<boolean>(() => isLocalDemoActive());

  const fetchProfile = useCallback((uid: string) => {
    getUserDoc<Omit<AthleteProfile, 'id'>>(uid, 'profile', 'main')
      .then((data) => setProfile(data ? { id: uid, ...data } : null))
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    let mounted = true;

    // MODO LOCAL: nenhum acesso ao backend. Usamos um usuário/perfil de exemplo
    // para liberar todas as telas e permitir testar a interface completa.
    if (localDemo) {
      setUser(localDemoUser);
      setProfile(localDemoAthleteProfile);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    let unsubscribe: (() => void) | null = null;
    getFirebase()
      .then((fb) => {
        if (!mounted) return;
        if (!fb) {
          // Sem backend (ex.: prévia local): segue deslogado, sem travar a tela.
          setUser(null);
          setLoading(false);
          return;
        }
        unsubscribe = onAuthStateChanged(fb.auth, (fbUser) => {
          if (!mounted) return;
          const appUser = fbUser ? toAppUser(fbUser) : null;
          setUser(appUser);
          setLoading(false);
          if (appUser) fetchProfile(appUser.id);
          else setProfile(null);
        });
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [fetchProfile, localDemo]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Acesso de teste local: admin / admin01 (não depende do backend).
    const normalized = email.trim().toLowerCase();
    if (normalized === LOCAL_DEMO_EMAIL && password === LOCAL_DEMO_PASSWORD) {
      enableLocalDemo();
      setLocalDemo(true);
      setUser(localDemoUser);
      setProfile(localDemoAthleteProfile);
      setLoading(false);
      return { error: null };
    }

    try {
      const fb = await getFirebase();
      if (!fb) return { error: OFFLINE_MESSAGE };
      const cred = await signInWithEmailAndPassword(fb.auth, email, password);
      setUser(toAppUser(cred.user));
      fetchProfile(cred.user.uid);
      return { error: null };
    } catch (err) {
      return { error: friendlyAuthError(err) };
    }
  }, [fetchProfile]);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      try {
        const fb = await getFirebase();
        if (!fb) return { error: OFFLINE_MESSAGE, needsEmailConfirm: false };
        const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
        await updateProfile(cred.user, { displayName: fullName }).catch(() => {});

        // Cria o perfil do aluno (bodycoach_users/{uid}/profile/main).
        try {
          await setUserDoc(cred.user.uid, 'profile', 'main', {
            full_name: fullName,
            email,
            height_cm: null,
            gender: null,
            birth_date: null,
            goal_weight_kg: null,
            goal_body_fat_pct: null,
            coach_notes: null,
            created_at: new Date().toISOString(),
          });
        } catch (profileError) {
          return { error: friendlyAuthError(profileError), needsEmailConfirm: false };
        }
        setUser({ ...toAppUser(cred.user), user_metadata: { full_name: fullName } });
        fetchProfile(cred.user.uid);

        // No Firebase a conta já nasce autenticada: não há etapa de confirmação.
        return { error: null, needsEmailConfirm: false };
      } catch (err) {
        return { error: friendlyAuthError(err), needsEmailConfirm: false };
      }
    },
    [fetchProfile],
  );

  const signOut = useCallback(async () => {
    if (isLocalDemoActive()) {
      disableLocalDemo();
      setLocalDemo(false);
      setUser(null);
      setProfile(null);
      return;
    }
    const fb = await getFirebase();
    if (fb) await firebaseSignOut(fb.auth).catch(() => {});
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, isLocalDemo: localDemo, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
