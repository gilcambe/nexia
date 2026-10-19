// Abertura instantânea: lembra a última tela aberta. Se o app for reaberto na tela inicial pouco depois
// (o Android fecha o app em segundo plano), volta direto para onde a pessoa estava.
export const CHAVE_ULTIMA_TELA = 'bc_ultima_tela';
export const VALIDADE_ULTIMA_TELA_MS = 30 * 60 * 1000;
// Telas que não voltam sozinhas (login, convites, links públicos, telas de dono).
const NAO_GUARDA = /^\/(auth|convite|c|conheca|termos|privacidade|onboarding|compartilhado|loja|instalar|admin)(\/|$)/;

export function podeGuardar(caminho: string): boolean {
  return caminho.startsWith('/') && caminho !== '/' && !NAO_GUARDA.test(caminho);
}

export function guardarUltimaTela(caminho: string, agora = Date.now()): void {
  if (!podeGuardar(caminho)) return;
  try { localStorage.setItem(CHAVE_ULTIMA_TELA, JSON.stringify({ caminho, em: agora })); } catch { /* sem armazenamento */ }
}

// Para onde voltar ao abrir na tela inicial; null = fica na tela inicial.
export function telaParaVoltar(agora = Date.now()): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_ULTIMA_TELA) || 'null') as { caminho?: unknown; em?: unknown } | null;
    if (!v || typeof v.caminho !== 'string' || typeof v.em !== 'number') return null;
    if (agora - v.em > VALIDADE_ULTIMA_TELA_MS || agora < v.em) return null;
    return podeGuardar(v.caminho) ? v.caminho : null;
  } catch { return null; }
}
