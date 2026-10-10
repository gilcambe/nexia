// Ligações do treino com a equipe: ranking da semana, desafio do coach e treino em dupla ao vivo.
import { chatApi } from '@/lib/chat';

// Conta o treino no ranking e marca o desafio do dia. Quem não tem equipe simplesmente não conta.
export function avisarTreinoFeito(minutos: number, kcal: number): void {
  void chatApi({ acao: 'treino_feito', minutos, kcal }).catch(() => {});
}

export interface StatusDupla { exercicio: string; series: number; bpm: number; kcal: number; recado: string; em: number }
export interface SalaDupla { a: string; b: string; nomes: Record<string, string>; status: Record<string, StatusDupla>; expira: number; souA: boolean }

const CHAVE = 'bc_dupla';
export function duplaAtual(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || 'null') as { codigo: string; expira: number } | null;
    return v && v.expira > Date.now() ? v.codigo : null;
  } catch { return null; }
}
export function guardarDupla(codigo: string | null, expira = 0) {
  try {
    if (codigo) localStorage.setItem(CHAVE, JSON.stringify({ codigo, expira }));
    else localStorage.removeItem(CHAVE);
  } catch { /* sem armazenamento */ }
}

// Manda a série atual para o parceiro (no máximo uma vez a cada 5 s).
let ultimoEnvio = 0;
export function enviarStatusDupla(st: Partial<Omit<StatusDupla, 'em'>>, forcar = false): Promise<SalaDupla | null> {
  const codigo = duplaAtual();
  if (!codigo) return Promise.resolve(null);
  if (!forcar && Date.now() - ultimoEnvio < 5000) return Promise.resolve(null);
  ultimoEnvio = Date.now();
  return chatApi<{ sala: SalaDupla }>({ acao: 'dupla_status', codigo, ...st }).then((r) => r.sala).catch(() => null);
}
