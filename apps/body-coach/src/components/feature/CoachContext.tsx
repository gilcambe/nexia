import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import type { CoachMessage } from '@/mocks/coach';
import { useAuth } from './AuthContext';
import { perguntar, type TurnoConversa } from '@/lib/coachAI';
import { cargasDoTexto } from '@/lib/cargasDoTexto';
import { registrarSeries } from '@/lib/treinoAtivo';
import { respostaLocal } from '@/lib/respostaLocal';
import { DIVISOES, objetivosDe, sexoDe } from '@/lib/dayPlan';
import { fichaDoPerfil } from '@/lib/ficha';

export interface CoachContextSnapshot {
  name: string;
  readinessScore: number | null;
  readinessStatus: 'pronto' | 'atencao' | 'reduzir' | null;
  latestWeight: number | null;
  calories: number | null;
  caloriesTarget: number | null;
  protein: number | null;
  proteinTarget: number | null;
}

interface CoachContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  messages: CoachMessage[];
  send: (text: string, snapshot?: CoachContextSnapshot) => void;
  typing: boolean;
  unread: number;
}

const CoachContext = createContext<CoachContextValue | null>(null);

export function useCoach() {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error('useCoach deve ser usado dentro do CoachProvider');
  return ctx;
}

function buildGreeting(name: string): string {
  return `Olá, ${name}! Sou seu coach no Body Coach. Me conta o que fez (ex.: "fiz 12 com 70"), como está se sentindo, ou pergunte do seu treino e da sua dieta.`;
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(1);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  // O coach chama o aluno pelo apelido que ele escolheu no Perfil.
  const firstName =
    profile?.nickname?.trim() || profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'atleta';

  // A conversa fica guardada neste aparelho: ao sair da página (ou fechar o app) e voltar, o histórico continua.
  const chave = user?.id ? `bc_coach_${user.id}` : null;
  const carregado = useRef<string | null>(null);
  useEffect(() => {
    if (!chave || carregado.current === chave) return;
    carregado.current = chave;
    try {
      const salvo = JSON.parse(localStorage.getItem(chave) || '[]');
      if (Array.isArray(salvo) && salvo.length) setMessages(salvo.slice(-60));
    } catch { /* sem histórico guardado */ }
  }, [chave]);
  useEffect(() => {
    if (!chave || carregado.current !== chave || messages.length === 0) return;
    try { localStorage.setItem(chave, JSON.stringify(messages.slice(-60))); } catch { /* sem armazenamento */ }
  }, [messages, chave]);
  const mensagensRef = useRef<CoachMessage[]>([]);
  const avisouErro = useRef(false);
  // Título do treino de hoje (o mesmo que a tela Treino mostra), para o coach falar dele.
  const treinoHoje = useCallback((): string | null => {
    try {
      const f = fichaDoPerfil({ onboarding: profile?.onboarding as Record<string, unknown> | undefined, ficha: (profile as { ficha?: { divisao?: never; proximoDia?: number } } | null)?.ficha });
      return DIVISOES[f.divisao].dias[f.proximoDia].titulo;
    } catch { return null; }
  }, [profile]);
  const dadosLocais = useCallback((s?: CoachContextSnapshot) => {
    const ob = (profile?.onboarding ?? {}) as Record<string, unknown>;
    return {
      nome: firstName, objetivos: objetivosDe(ob), sexo: sexoDe({ ...ob, gender: profile?.gender }), local: String(ob.place ?? ''),
      treinoHoje: treinoHoje(), prontidao: s?.readinessScore ?? null, status: s?.readinessStatus ?? null, peso: s?.latestWeight ?? null,
      kcal: s?.calories ?? null, kcalMeta: s?.caloriesTarget ?? null, proteina: s?.protein ?? null, proteinaMeta: s?.proteinTarget ?? null,
      hora: new Date().getHours(),
    };
  }, [profile, firstName, treinoHoje]);
  useEffect(() => { mensagensRef.current = messages; }, [messages]);

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Reinicia a saudação quando o nome real do atleta é resolvido
  // Só troca o texto da saudação; a conversa em andamento nunca é apagada.
  useEffect(() => {
    const greet: CoachMessage = { id: 'c-greet', speaker: 'coach', text: buildGreeting(firstName), time: 'agora' };
    setMessages((prev) => (prev.length === 0 || prev[0].id === 'c-greet' ? [greet, ...prev.slice(1)] : prev));
  }, [firstName]);

  const setOpenSafe = useCallback((v: boolean) => {
    setOpen(v);
    if (v) setUnread(0);
  }, []);

  const send = useCallback(async (text: string, snapshot?: CoachContextSnapshot) => {
    const trimmed = text.trim();
    if (!trimmed || loadingAI) return;

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, speaker: 'user', text: trimmed, time: 'agora' },
    ]);

    const series = cargasDoTexto(trimmed) ?? [];
    if (series.length > 0) {
      try {
        const aviso = registrarSeries(series);
        if (aviso) {
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}`, speaker: 'coach', text: aviso, time: 'agora' },
          ]);
        }
      } catch (e: any) {
        const errorMsg = e?.message || 'Erro ao registrar séries.';
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, speaker: 'coach', text: errorMsg, time: 'agora' },
        ]);
      }
    }

    setLoadingAI(true);
    try {
      const ob = (profile?.onboarding ?? {}) as Record<string, unknown>;
      const contextData = {
        apelido: firstName,
        objetivo: ob.goal ?? null,
        objetivos: objetivosDe(ob),
        sexo: sexoDe({ ...ob, gender: profile?.gender }),
        idade: ob.age ?? null,
        peso_cadastro: ob.weight ?? null,
        onde_treina: ob.place ?? null,
        foco: ob.focus ?? null,
        rotina: ob.lifestyle ?? null,
        dias_por_semana: ob.days ?? null,
        treino_de_hoje: treinoHoje(),
        hora_local: new Date().getHours(),
        modalidades: ob.modality ?? null,
        nivel: ob.level ?? null,
        limitacoes: [...(profile?.mobility ?? []), ...(typeof ob.injuries === 'string' && ob.injuries ? [ob.injuries] : [])],
        name: firstName,
        readinessScore: snapshot?.readinessScore ?? null,
        readinessStatus: snapshot?.readinessStatus ?? null,
        latestWeight: snapshot?.latestWeight ?? null,
        calories: snapshot?.calories ?? null,
        caloriesTarget: snapshot?.caloriesTarget ?? null,
        protein: snapshot?.protein ?? null,
        proteinTarget: snapshot?.proteinTarget ?? null,
      };

      // As últimas mensagens vão junto: o coach lembra o que já foi dito e responde ao que o aluno acabou de falar.
      const historico: TurnoConversa[] = mensagensRef.current
        .filter((m) => m.id !== 'c-greet' && m.text)
        .slice(-10)
        .map((m) => ({ role: m.speaker === 'user' ? 'user' as const : 'assistant' as const, content: m.text }));
      const reply = await perguntar('coach', trimmed, contextData, undefined, historico);
      avisouErro.current = false;

      setMessages((prev) => [
        ...prev,
        { id: `c-${Date.now()}`, speaker: 'coach', text: reply || 'Entendido. Como posso ajudar mais?', time: 'agora' },
      ]);
      if (!openRef.current) setUnread((u) => u + 1);
    } catch (err: any) {
      // Plano B: a IA falhou, mas o coach nunca fica mudo — responde com os dados que já tem do aluno.
      // O aviso de falha aparece uma vez só (repetir a mesma frase a cada mensagem parece robô).
      const texto = (avisouErro.current || !err?.message ? '' : `${err.message}\n\n`) + respostaLocal(trimmed, dadosLocais(snapshot));
      avisouErro.current = true;
      setMessages((prev) => [
        ...prev,
        { id: `c-${Date.now()}`, speaker: 'coach', text: texto, time: 'agora' },
      ]);
      if (!openRef.current) setUnread((u) => u + 1);
    } finally {
      setLoadingAI(false);
    }
  }, [loadingAI, profile, firstName, treinoHoje, dadosLocais]);

  const value = useMemo(
    () => ({ open, setOpen: setOpenSafe, messages, send, unread, typing: loadingAI }),
    [open, setOpenSafe, messages, send, unread, loadingAI],
  );

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}