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
import { perguntar } from '@/lib/coachAI';
import { cargasDoTexto } from '@/lib/cargasDoTexto';
import { registrarSeries } from '@/lib/treinoAtivo';

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
  return `Olá, ${name}! Sou o Coach NEXIA e estou do seu lado na academia. Estou acompanhando seu contexto em tempo real — pode me dizer o que fez (ex.: "fiz 12 com 70"), como se sente, ou pedir um resumo do seu dia.`;
}

function buildReadinessReply(s?: CoachContextSnapshot): string {
  if (s?.readinessScore == null) {
    return 'Ainda não tenho seu check-in de hoje. Faça o check-in diário para eu calcular seu Readiness e ajustar o treino na hora.';
  }
  const label =
    s.readinessStatus === 'pronto'
      ? 'pronto para treinar pesado'
      : s.readinessStatus === 'reduzir'
        ? 'em dia de recuperação'
        : 'com atenção — treinar com ajustes';
  return `Seu Readiness hoje é ${s.readinessScore}/100. Você está ${label}. Se quiser saber o porquê, é só perguntar "por quê?".`;
}

function buildNutritionReply(s?: CoachContextSnapshot): string {
  const cal = s?.calories ?? 0;
  const calT = s?.caloriesTarget ?? 0;
  const prot = s?.protein ?? 0;
  const protT = s?.proteinTarget ?? 0;
  if (calT <= 0) {
    return 'Ainda não tenho suas metas de nutrição. Registre suas refeições para eu acompanhar quanto ainda pode comer.';
  }
  const remainingCal = Math.max(0, calT - cal);
  const remainingProt = Math.max(0, protT - prot);
  return `Você já consumiu ${cal.toLocaleString('pt-BR')} kcal / ${prot}g de proteína. Pode ingerir ~${remainingCal.toLocaleString('pt-BR')} kcal até bater a meta de ${calT.toLocaleString('pt-BR')}. Priorize ~${remainingProt}g de proteína nas próximas refeições.`;
}

function buildWeightReply(s?: CoachContextSnapshot): string {
  if (s?.latestWeight == null) {
    return 'Ainda não registrei seu peso. Vá em Evolução e registre seu primeiro progresso para eu acompanhar a tendência.';
  }
  return `Seu último registro de peso é ${s.latestWeight.toFixed(1).replace('.', ',')} kg. Posso acompanhar a tendência conforme você registra novos dados em Evolução.`;
}

function respostaLocal(texto: string, s?: CoachContextSnapshot): string {
  const t = texto.toLowerCase();
  if (/comer|caloria|kcal|prote[ií]na|dieta|fome/.test(t)) return buildNutritionReply(s);
  if (/peso|balan[cç]a|gordura/.test(t)) return buildWeightReply(s);
  if (/hoje|pront|readiness|cansad|recupera|treino|perna|peito|costas|bra[cç]o|ombro/.test(t)) return buildReadinessReply(s);
  return 'Estou com dificuldade de conectar à IA agora, mas continuo aqui. Pergunte "Como estou hoje?" ou "Quanto ainda posso comer?" que respondo com os seus dados.';
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(1);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  const firstName =
    profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'atleta';

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
      } catch (err) {
        console.error('Erro ao registrar séries:', err);
      }
    }

    setLoadingAI(true);
    try {
      const contextData = {
        name: snapshot?.name ?? profile?.full_name ?? 'atleta',
        readinessScore: snapshot?.readinessScore ?? null,
        readinessStatus: snapshot?.readinessStatus ?? null,
        latestWeight: snapshot?.latestWeight ?? null,
        calories: snapshot?.calories ?? null,
        caloriesTarget: snapshot?.caloriesTarget ?? null,
        protein: snapshot?.protein ?? null,
        proteinTarget: snapshot?.proteinTarget ?? null,
      };

      const reply = await perguntar('coach', trimmed, contextData);

      setMessages((prev) => [
        ...prev,
        { id: `c-${Date.now()}`, speaker: 'coach', text: reply || 'Entendido. Como posso ajudar mais?', time: 'agora' },
      ]);
      if (!openRef.current) setUnread((u) => u + 1);
    } catch (err: any) {
      // Plano B: a IA falhou, mas o coach nunca fica mudo — responde com os dados que já tem do aluno.
      const aviso = err?.message ? `${err.message}\n\n` : '';
      setMessages((prev) => [
        ...prev,
        { id: `c-${Date.now()}`, speaker: 'coach', text: aviso + respostaLocal(trimmed, snapshot), time: 'agora' },
      ]);
      if (!openRef.current) setUnread((u) => u + 1);
    } finally {
      setLoadingAI(false);
    }
  }, [loadingAI, profile]);

  const value = useMemo(
    () => ({ open, setOpen: setOpenSafe, messages, send, unread, typing: loadingAI }),
    [open, setOpenSafe, messages, send, unread, loadingAI],
  );

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}