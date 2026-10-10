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
import { definirPerfilIA } from '@/lib/coachAI';
import type { PlanoAlimentar } from '@/lib/planoAlimentar';



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
  nickname?: string | null;
  photo_data?: string | null;
  mobility?: string[];
  ajuste_kcal?: number;
  onboarding?: Record<string, string | string[] | undefined>;
  plano_nutri?: PlanoAlimentar | null;
  alimentos_evitar?: string[]; // ids da tabela que o aluno tirou do cardápio automático
  trocas_plano?: TrocaFixa[]; // trocas do plano do nutricionista que valem todo dia
  horarios_refeicoes?: Record<string, string>; // nome da refeição -> "HH:MM"
  musica?: { app?: string; link?: string; estilo?: string };
  entretenimento?: { app?: string; serie?: string };
  jejum?: { inicio: number; horas: number } | null; // jejum intermitente em andamento (opcional)
  suplementos?: { nome: string; dose: string; hora: string }[];
  ciclo?: { inicio: string; duracao: number } | null; // ciclo menstrual (opcional)
  indicado_por?: string | null; // código de quem indicou o app
}

export interface TrocaFixa { chave: string; nome: string; porcao: string }

// Usuário do app (mesmo formato que as telas do original usam: id, email, user_metadata).
export interface User {
  id: string;
  email: string | null;
  user_metadata: { full_name?: string | null };
}

function toAppUser(u: FirebaseUser): User {
  return { id: u.uid, email: u.email, user_metadata: { full_name: u.displayName } };
}

interface AuthContextValue {
  user: User | null;
  profile: AthleteProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const OFFLINE_MESSAGE =
  'Não consegui falar com o servidor agora. Verifique sua conexão e tente novamente.';

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

  const fetchProfile = useCallback((uid: string) => {
    getUserDoc<Omit<AthleteProfile, 'id'>>(uid, 'profile', 'main')
      .then((data) => {
        setProfile(data ? { id: uid, ...data } : null);
        const ob = data?.onboarding ?? {};
        definirPerfilIA({
          apelido: data?.nickname || data?.full_name?.split(' ')[0] || null,
          objetivo: ob.goal ?? null,
          modalidades: ob.modality ?? null,
          nivel: ob.level ?? null,
          limitacoes: [...(data?.mobility ?? []), ...(typeof ob.injuries === 'string' && ob.injuries ? [ob.injuries] : [])],
        });
      })
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    let mounted = true;
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
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
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
    const fb = await getFirebase();
    if (fb) await firebaseSignOut(fb.auth).catch(() => {});
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile: () => { if (user) fetchProfile(user.id); } }}
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
