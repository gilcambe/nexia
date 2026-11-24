// Ouve uma frase do aluno (microfone do celular, grátis, sem servidor) e devolve o texto.
// Chrome e Safari têm; onde não tiver, o botão nem aparece.

type Reconhecedor = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};

function criar(): Reconhecedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

export function temMicrofone(): boolean {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// Resolve com o texto falado; vazio se não entendeu, cancelou ou não tem microfone.
export function ouvirUmaFrase(limiteMs = 8000): { promessa: Promise<string>; parar: () => void } {
  const r = criar();
  if (!r) return { promessa: Promise.resolve(''), parar: () => undefined };
  let pronto = false;
  const promessa = new Promise<string>((ok) => {
    const fim = (t: string) => { if (!pronto) { pronto = true; ok(t); } };
    r.lang = 'pt-BR'; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
    r.onresult = (e) => fim(String(e.results?.[0]?.[0]?.transcript || '').trim());
    r.onerror = () => fim('');
    r.onend = () => fim('');
    try { r.start(); } catch { fim(''); }
    setTimeout(() => { try { r.stop(); } catch { /* ok */ } fim(''); }, limiteMs);
  });
  return { promessa, parar: () => { try { r.stop(); } catch { /* ok */ } } };
}

// Comandos de voz no treino, além das séries ("fiz 12 com 30").
export type ComandoVoz = 'proximo' | 'pular' | 'repetir' | null;
export function comandoDaFrase(t: string): ComandoVoz {
  const n = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\b(proximo|seguinte|proximo exercicio|terminei o exercicio)\b/.test(n)) return 'proximo';
  if (/\b(pular|pula|acabou o descanso|bora|vamos)\b/.test(n) && n.length < 30) return 'pular';
  if (/\b(repetir|repete|igual a anterior|mesma coisa|mesma carga)\b/.test(n)) return 'repetir';
  return null;
}
