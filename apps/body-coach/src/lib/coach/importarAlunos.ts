// Importar alunos de outro app: a IA grátis devolve um JSON; aqui ele é validado e vira linhas para a prévia.
export interface AlunoLido { nome: string; email: string; telefone: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Aceita a resposta da IA com ou sem markdown em volta; descarta item sem nome ou sem e-mail/telefone e repetidos.
export function alunosDoJson(resposta: string): AlunoLido[] {
  const ini = resposta.indexOf('[');
  const fim = resposta.lastIndexOf(']');
  if (ini < 0 || fim <= ini) return [];
  let bruto: unknown;
  try { bruto = JSON.parse(resposta.slice(ini, fim + 1)); } catch { return []; }
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set<string>();
  const fora: AlunoLido[] = [];
  for (const x of bruto.slice(0, 200)) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const nome = texto(o.nome, 60);
    const email = texto(o.email, 120).toLowerCase();
    const telefone = texto(o.telefone, 30);
    const digitos = telefone.replace(/\D/g, '');
    const e = EMAIL.test(email) ? email : '';
    const t = digitos.length >= 10 && digitos.length <= 13 ? telefone : '';
    const chave = e || digitos;
    if (!nome || !chave || vistos.has(chave)) continue;
    vistos.add(chave);
    fora.push({ nome, email: e, telefone: t });
  }
  return fora;
}

// Uma linha por aluno, separada por tab: o mesmo formato do "colar do Excel", que o coach ainda pode corrigir.
export const alunosParaTexto = (l: AlunoLido[]) => l.map((a) => `${a.nome}\t${a.email}\t${a.telefone}`).join('\n');
