import { useState, useRef, useEffect, useMemo, type FormEvent } from 'react';
import { useCoach, type CoachContextSnapshot } from './CoachContext';
import { useAuth } from './AuthContext';
import { useReadiness } from './ReadinessContext';
import { useNutrition } from './NutritionContext';
import { useProgressData } from '@/hooks/useProgressData';

function getRecognition(): any | null {
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

export default function CoachPanel() {
  const { open, setOpen, messages, send } = useCoach();
  const { profile, user } = useAuth();
  const { result } = useReadiness();
  const { totals, targets } = useNutrition();
  const { latest } = useProgressData(user?.id);

  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastSpokenId = useRef<string | null>(null);

  const snapshot: CoachContextSnapshot = useMemo(
    () => ({
      name: profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'atleta',
      readinessScore: result?.score ?? null,
      readinessStatus: result?.status ?? null,
      latestWeight: latest?.weight_kg ?? null,
      calories: totals.calories,
      caloriesTarget: targets.calories,
      protein: totals.protein,
      proteinTarget: targets.protein,
    }),
    [profile, user, result, latest, totals, targets],
  );

  const speechSupported =
    typeof window !== 'undefined' &&
    getRecognition() !== null &&
    'speechSynthesis' in window;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    const lastCoach = [...messages].reverse().find((m) => m.speaker === 'coach');
    if (lastCoach && lastCoach.id !== lastSpokenId.current) {
      lastSpokenId.current = lastCoach.id;
      const utterance = new SpeechSynthesisUtterance(lastCoach.text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.02;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [messages, voiceOn]);

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event: any) => {
      const transcript = (event.results[0][0].transcript as string).trim();
      if (transcript) send(transcript, snapshot);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  if (!open) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    send(draft, snapshot);
    setDraft('');
  };

  const suggestions = ['Como estou hoje?', 'Quanto ainda posso comer?', 'Estou muito cansado', 'Fiz 12 com 70'];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div
        className="absolute inset-0 bg-foreground-950/30 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-background-200 bg-background-50">
        {/* header */}
        <div className="flex items-center justify-between border-b border-background-200 bg-background-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-background-50">
              <i className="ri-robot-2-line text-lg"></i>
              {listening && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-accent-500"></span>
              )}
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold text-foreground-950">Coach NEXIA</h3>
              <p className="flex items-center gap-1.5 text-xs text-accent-700">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-500"></span>
                {listening ? 'Ouvindo você...' : 'Ciente do seu contexto'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceOn((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-500 transition hover:bg-background-100"
              aria-label={voiceOn ? 'Desligar voz' : 'Ligar voz'}
              title={voiceOn ? 'Resposta em áudio: ligada' : 'Resposta em áudio: desligada'}
            >
              <i className={`${voiceOn ? 'ri-volume-up-line' : 'ri-volume-mute-line'} text-lg`}></i>
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-500 transition hover:bg-background-100"
              aria-label="Fechar coach"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        {/* context pills */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-background-200 bg-background-100/60 px-5 py-2.5">
          <span className="shrink-0 whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-2.5 py-1 text-xs text-foreground-600">
            <i className="ri-heart-pulse-line mr-1 align-middle text-accent-600"></i>
            Readiness {result ? result.score : '—'}
          </span>
          {latest?.weight_kg != null && (
            <span className="shrink-0 whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-2.5 py-1 text-xs text-foreground-600">
              <i className="ri-scales-3-line mr-1 align-middle text-primary-500"></i>
              {latest.weight_kg.toFixed(1).replace('.', ',')} kg
            </span>
          )}
          <span className="shrink-0 whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-2.5 py-1 text-xs text-foreground-600">
            <i className="ri-restaurant-line mr-1 align-middle text-secondary-500"></i>
            {totals.calories.toLocaleString('pt-BR')} kcal
          </span>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((m) => (
            <div key={m.id} className={m.speaker === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.speaker === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-md bg-primary-500 px-4 py-2.5 text-sm text-background-50'
                    : 'max-w-[88%] rounded-2xl rounded-bl-md border border-background-200 bg-background-100 px-4 py-2.5 text-sm text-foreground-800'
                }
              >
                <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                <p className={m.speaker === 'user' ? 'mt-1 text-right text-[11px] text-background-50/70' : 'mt-1 text-[11px] text-foreground-400'}>
                  {m.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* suggestion chips */}
        <div className="flex flex-wrap gap-2 px-5 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s, snapshot)}
              className="whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-3 py-1.5 text-xs text-foreground-600 transition hover:bg-background-100"
            >
              {s}
            </button>
          ))}
        </div>

        {/* input */}
        <form onSubmit={submit} className="border-t border-background-200 bg-background-50 p-4">
          <div className="flex items-center gap-2 rounded-full border border-background-200 bg-background-50 px-2 py-1.5 focus-within:border-primary-300">
            <button
              type="button"
              onClick={toggleMic}
              disabled={!speechSupported}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-30 ${
                listening
                  ? 'animate-pulse bg-accent-500 text-background-50'
                  : 'text-foreground-500 hover:bg-background-100'
              }`}
              aria-label="Falar por voz"
              title={speechSupported ? 'Falar por voz' : 'Voz não suportada neste navegador'}
            >
              <i className={`${listening ? 'ri-mic-fill' : 'ri-mic-line'} text-lg`}></i>
            </button>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={listening ? 'Ouvindo...' : 'Fale com o coach...'}
              className="flex-1 bg-transparent px-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-background-50 transition disabled:opacity-40"
              aria-label="Enviar"
            >
              <i className="ri-send-plane-fill"></i>
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-foreground-400">
            {speechSupported
              ? 'Toque no microfone e fale — o coach também responde em áudio.'
              : 'Voz não suportada neste navegador. Digite sua mensagem normalmente.'}
          </p>
        </form>
      </aside>
    </div>
  );
}