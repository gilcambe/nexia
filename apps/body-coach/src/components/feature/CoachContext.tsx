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

export function CoachProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(1);
  const [messages, setMessages] = useState<CoachMessage[]>([]);

  const firstName =
    profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'atleta';

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Reinicia a saudação quando o nome real do atleta é resolvido
  useEffect(() => {
    setMessages([
      { id: 'c-greet', speaker: 'coach', text: buildGreeting(firstName), time: 'agora' },
    ]);
    setUnread(1);
  }, [firstName]);

  const setOpenSafe = useCallback((v: boolean) => {
    setOpen(v);
    if (v) setUnread(0);
  }, []);

  const send = useCallback((text: string, snapshot?: CoachContextSnapshot) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, speaker: 'user', text: trimmed, time: 'agora' },
    ]);

    const lower = trimmed.toLowerCase();
    const name = snapshot?.name ?? 'atleta';

    let reply: string;

    if (/resumo|readiness|prontidão|como estou|como vai|meu dia/i.test(lower)) {
      reply = buildReadinessReply(snapshot);
    } else if (/quanto ainda posso comer|ainda posso comer|posso comer|kcal|caloria|proteína/i.test(lower)) {
      reply = buildNutritionReply(snapshot);
    } else if (/quanto eu peso|meu peso|peso atual/i.test(lower)) {
      reply = buildWeightReply(snapshot);
    } else if (/cansad|fadig|sem energia|pesado/i.test(lower)) {
      reply =
        'Entendido. Seu cansaço está alto hoje — não vamos cancelar, apenas rodar com menos volume e intensidade. Se a dor ou o cansaço subirem durante a série, me avise que encurtamos.';
    } else if (/dor|desconforto|ombro|joelho/i.test(lower)) {
      reply =
        'Registrado o desconforto. Vou reduzir a sobrecarga nessa região nesta sessão e monitorar. Se a dor piorar ou houver perda de função, paramos e encaminhamos para avaliação — isso é precaução, não diagnóstico.';
    } else if (/^\d+\s*(kg|k)?/i.test(trimmed) || /x\s*\d+/i.test(trimmed)) {
      reply =
        'Registrado. Carga e repetições dentro do alvo. Mantenha a carga e busque a faixa de repetições prevista na próxima série. Execução acima do ego.';
    } else {
      reply = `Entendido, ${name}. Registrei o contexto e sigo acompanhando sua sessão. Me diga o que fez (ex.: "fiz 12 com 70") ou como está se sentindo.`;
    }

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `c-${Date.now()}`, speaker: 'coach', text: reply, time: 'agora' },
      ]);
      if (!openRef.current) setUnread((u) => u + 1);
    }, 550);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen: setOpenSafe, messages, send, unread }),
    [open, setOpenSafe, messages, send, unread],
  );

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}