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
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebase } from '@/lib/firebaseClient';
import { getUserDoc, setUserDoc } from '@/lib/userData';
import { definirPerfilIA } from '@/lib/coachAI';
import type { PlanoAlimentar } from '@/lib/planoAlimentar';
import { aplicarMarca } from '@/lib/coach/profissionais';
import { esquecerPapel } from '@/lib/papelCoach';


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
  periodizacao?: { objetivo: 'hipertrofia' | 'forca' | 'emagrecimento' | 'resistencia'; semanas: number; inicio: string } | null;
  sinais?: { data: string; sistolica?: number | null; diastolica?: number | null; glicemia?: number | null; fc_repouso?: number | null; jejum?: boolean }[];
  marcadores_hist?: { data: string; valores: Record<string, number> }[];
  avatar?: { sexo?: string; pele?: string; biotipo?: string }; // corpo realista escolhido (Evolução)
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
  signInGoogle: () => Promise<{ error: string | null; novo?: boolean }>;
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
  if (code === 'auth/account-exists-with-different-credential') {
    return 'Este e-mail já tem conta com senha. Entre com e-mail e senha.';
  }
  if (code === 'auth/unauthorized-domain') return 'Este endereço ainda não está liberado para entrar com Google.';
  if (code === 'auth/operation-not-allowed') {
    return 'Login por e-mail e senha ainda não está ativado no Firebase deste projeto.';
  }
  return msg;
}

// Primeiro login com Google: cria o perfil igual ao cadastro por e-mail. Devolve true se criou.
async function garantirPerfil(u: FirebaseUser): Promise<boolean> {
  const existe = await getUserDoc(u.uid, 'profile', 'main');
  if (existe) return false;
  await setUserDoc(u.uid, 'profile', 'main', {
    full_name: u.displayName,
    email: u.email,
    height_cm: null,
    gender: null,
    birth_date: null,
    goal_weight_kg: null,
    goal_body_fat_pct: null,
    coach_notes: null,
    created_at: new Date().toISOString(),
  });
  return true;
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
          objetivos: Array.isArray((ob as Record<string, unknown>).goals) ? (ob as Record<string, unknown>).goals : null,
          sexo: (ob as Record<string, unknown>).sex ?? data?.gender ?? null,
          idade: (ob as Record<string, unknown>).age ?? null,
          onde_treina: (ob as Record<string, unknown>).place ?? null,
          rotina: (ob as Record<string, unknown>).lifestyle ?? null,
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
        // Volta do login com Google por redirecionamento: cria o perfil se for a primeira vez.
        getRedirectResult(fb.auth)
          .then(async (res) => {
            if (!res?.user) return;
            const criou = await garantirPerfil(res.user).catch(() => false);
            if (criou && mounted) fetchProfile(res.user.uid);
          })
          .catch(() => {});
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

  const signInGoogle = useCallback(async (): Promise<{ error: string | null; novo?: boolean }> => {
    const fb = await getFirebase().catch(() => null);
    if (!fb) return { error: OFFLINE_MESSAGE };
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const cred = await signInWithPopup(fb.auth, provider);
      let novo = false;
      try {
        novo = await garantirPerfil(cred.user);
      } catch (profileError) {
        return { error: friendlyAuthError(profileError) };
      }
      setUser(toAppUser(cred.user));
      fetchProfile(cred.user.uid);
      return { error: null, novo };
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return { error: null };
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(fb.auth, provider);
          return { error: null };
        } catch (e) {
          return { error: friendlyAuthError(e) };
        }
      }
      return { error: friendlyAuthError(err) };
    }
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    const fb = await getFirebase();
    if (fb) await firebaseSignOut(fb.auth).catch(() => {});
    aplicarMarca(null); esquecerPapel(); // a próxima conta não herda a cor do coach desta
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signInGoogle, signOut, refreshProfile: () => { if (user) fetchProfile(user.id); } }}
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
