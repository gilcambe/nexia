import { AI_PROVIDERS } from '../config/aiProviders';

async function groqChat(messages: Array<{ role: string; content: string }>, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const resp = await fetch(AI_PROVIDERS.groq.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.groq.model,
      messages,
      temperature: options?.temperature ?? 0,
      max_tokens: options?.maxTokens ?? 300,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Erro na API Groq: ${resp.statusText}`);
  }
  const data = await resp.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

const SENSITIVE_PATTERNS = [
  // Senhas e credenciais
  /senha[\s:]*[\S]+/gi,
  /password[\s:]*[\S]+/gi,
  /pass[\s:]*[\S]+/gi,
  /key[\s:]*[\S]+/gi,
  /token[\s:]*[\S]+/gi,
  
  // CPF e documentos
  /cpf[\s:]*[\d\.\-]+/gi,
  /cadastro[\s:]*[\d\.\-]+/gi,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
  /\b\d{11}\b/g,
  
  // Chaves e segredos
  /chave[\s:]*[\S]+/gi,
  /secret[\s:]*[\S]+/gi,
  /api[\s:]*[\S]+/gi,
  
  // Dados de saúde
  /saúde[\s:]*[\S]+/gi,
  /health[\s:]*[\S]+/gi,
  /doença[\s:]*[\S]+/gi,
  /medicação[\s:]*[\S]+/gi,
  /diagnóstico[\s:]*[\S]+/gi,
  
  // Cartões e pagamentos
  /cartão[\s:]*[\d]+/gi,
  /cartao[\s:]*[\d]+/gi,
  /número[\s:]*[\d]+/gi,
  /numero[\s:]*[\d]+/gi,
  /cvv[\s:]*[\d]+/gi,
  /validade[\s:]*[\d]+/gi,
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
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const clean = removeSensitive(text);
  
  // Validação adicional do texto sanitizado
  if (clean.length < 10 || clean.trim() === '[DADO SENSÍTIVO OCULTO]'.repeat(clean.length / 20)) {
    return [];
  }
  
  const prompt = `Extraia até ${maxFacts} fatos duráveis deste texto (nome, localização, preferência ou outro). Retorne só JSON com chave "fatos", cada item com "tipo" e "valor". Não inclua dados sensíveis.

TEXTO: ${clean}`;
  
  try {
    const raw = await groqChat([{ role: 'user', content: prompt }], { temperature: 0, maxTokens: 300 });
    let parsed: { fatos?: Array<{ tipo?: string; valor?: string }> } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    
    const fatos: DurableFact[] = [];
    for (const f of (parsed.fatos ?? []).slice(0, maxFacts)) {
      if (!f.valor || typeof f.valor !== 'string') continue;
      const tipo = (f.tipo || 'outro') as DurableFact['tipo'];
      const valorSanitizado = removeSensitive(String(f.valor)).trim();
      
      // Validação final do valor extraído
      if (valorSanitizado.length > 2 && valorSanitizado.length < 200) {
        fatos.push({ tipo, valor: valorSanitizado });
      }
    }
    return fatos;
  } catch (error) {
    console.error('Erro na extração de fatos:', error);
    return [];
  }
}
