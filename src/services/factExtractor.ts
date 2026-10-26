import { groqChat } from '../config/aiProviders';

const SENSITIVE_PATTERNS = [
  /senha[\s:]*[\S]+/gi,
  /cpf[\s:]*[\d\.\-]+/gi,
  /chave[\s:]*[\S]+/gi,
  /saúde[\s:]*[\S]+/gi,
  /health[\s:]*[\S]+/gi,
  /\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
];

function removeSensitive(text: string): string {
  let out = text;
  for (const pat of SENSITIVE_PATTERNS) {
    out = out.replace(pat, '[DADO SENSÍTIVO OCULTO]');
  }
  return out;
}

export interface DurableFact {
  tipo: 'nome' | 'localização' | 'preferência' | 'outro';
  valor: string;
}

export async function extractFacts(text: string, maxFacts = 3): Promise<DurableFact[]> {
  const clean = removeSensitive(text);
  const prompt = `Extraia até ${maxFacts} fatos duráveis deste texto (nome, localização, preferência ou outro). Retorne só JSON com chave "fatos", cada item com "tipo" e "valor". Não inclua dados sensíveis.

TEXTO: ${clean}`;
  const raw = await groqChat([{ role: 'user', content: prompt }], { temperature: 0, maxTokens: 300 });
  let parsed: { fatos?: Array<{ tipo?: string; valor?: string }> } = {};
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  const fatos: DurableFact[] = [];
  for (const f of (parsed.fatos ?? []).slice(0, maxFacts)) {
    if (!f.valor) continue;
    const tipo = (f.tipo || 'outro') as DurableFact['tipo'];
    fatos.push({ tipo, valor: removeSensitive(String(f.valor)).trim() });
  }
  return fatos;
}
