// Equipe de profissionais (coach principal + parceiro), convites em lote e a marca do coach no app dos alunos.
import { chatApi, type Contato } from '../chat';

export type Parte = 'treino' | 'dieta';
export const NOME_PARTE: Record<Parte, string> = { treino: 'Treino', dieta: 'Alimentação' };

// ── Equipe do aluno ──
export interface MinhaEquipe { coach: Contato | null; parceiro: (Contato & { parte: Parte }) | null }
export const minhaEquipe = () => chatApi<MinhaEquipe>({ acao: 'equipe_minha' });
export const entrarParceiro = (codigo: string, parte: Parte) => chatApi<{ parceiro: Contato & { parte: Parte } }>({ acao: 'parceiro_entrar', codigo, parte });
export const sairParceiro = () => chatApi<{ ok: true }>({ acao: 'parceiro_sair' });
export const removerParceiro = (aluno: string) => chatApi<{ ok: true }>({ acao: 'parceiro_remover', aluno });

// ── Convites em lote ──
export interface Convite { id: string; nome: string; email: string; telefone: string; enviado: number | null; entrou: number | null }
export interface LinhaPlanilha { nome: string; email: string; telefone: string }
export const verConvites = () => chatApi<{ convites: Convite[]; codigo: string; coach: string }>({ acao: 'convites_ver' });
export const importarConvites = (lista: LinhaPlanilha[]) => chatApi<{ importados: number; repetidos: number; invalidos: number }>({ acao: 'convites_importar', lista });
export const marcarEnviado = (ids: string[], via: 'whatsapp' | 'email') => chatApi<{ ok: true }>({ acao: 'convite_enviado', ids, via });
export const apagarConvite = (id: string) => chatApi<{ ok: true }>({ acao: 'convite_apagar', id });

// Lê o que o coach colou do Excel/Google Planilhas (tabs) ou abriu de um .csv (vírgula ou ponto e vírgula).
// Descobre sozinho qual coluna é nome, e-mail e telefone, com ou sem linha de título.
export function lerPlanilha(texto: string): LinhaPlanilha[] {
  const linhas = texto.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return [];
  const sep = linhas[0].includes('\t') ? '\t' : (linhas[0].split(';').length > linhas[0].split(',').length ? ';' : ',');
  const celulas = linhas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
  const ehEmail = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
  const ehFone = (c: string) => { const d = c.replace(/\D/g, ''); return d.length >= 10 && d.length <= 13 && !/[a-z]/i.test(c); };
  const titulo = celulas[0].some((c) => /nome|e-?mail|telefone|celular|whats/i.test(c)) && !celulas[0].some(ehEmail);
  const corpo = titulo ? celulas.slice(1) : celulas;
  const col = (teste: (c: string) => boolean, palavra: RegExp) => {
    if (titulo) { const i = celulas[0].findIndex((c) => palavra.test(c)); if (i >= 0) return i; }
    const largura = Math.max(...corpo.map((l) => l.length));
    let melhor = -1; let max = 0;
    for (let i = 0; i < largura; i++) { const n = corpo.filter((l) => teste(l[i] ?? '')).length; if (n > max) { max = n; melhor = i; } }
    return melhor;
  };
  const iEmail = col(ehEmail, /e-?mail/i);
  const iFone = col(ehFone, /telefone|celular|whats|fone/i);
  const iNome = titulo && celulas[0].findIndex((c) => /nome/i.test(c)) >= 0
    ? celulas[0].findIndex((c) => /nome/i.test(c))
    : [0, 1, 2, 3].find((i) => i !== iEmail && i !== iFone) ?? 0;
  return corpo.map((l) => ({ nome: (l[iNome] ?? '').slice(0, 60), email: iEmail >= 0 ? (l[iEmail] ?? '') : '', telefone: iFone >= 0 ? (l[iFone] ?? '') : '' }))
    .filter((x) => x.nome && (x.email || x.telefone));
}

// ── Marca do coach ──
export type Cor = 'laranja' | 'azul' | 'verde' | 'roxo' | 'rosa' | 'vermelho' | 'turquesa' | 'grafite';
export interface Marca { nome: string; cor: Cor; logo: string }
export const CORES: { id: Cor; nome: string; h: number; c?: number }[] = [
  { id: 'laranja', nome: 'Laranja', h: 42 },
  { id: 'vermelho', nome: 'Vermelho', h: 22 },
  { id: 'rosa', nome: 'Rosa', h: 355 },
  { id: 'roxo', nome: 'Roxo', h: 300 },
  { id: 'azul', nome: 'Azul', h: 255 },
  { id: 'turquesa', nome: 'Turquesa', h: 195 },
  { id: 'verde', nome: 'Verde', h: 150 },
  { id: 'grafite', nome: 'Grafite', h: 260, c: 0.12 },
];
// Mesma claridade e intensidade do tema padrão, só muda o tom (a leitura e o contraste continuam iguais).
const ESCALA: [number, number, number][] = [[50, 0.97, 0.04], [100, 0.94, 0.07], [200, 0.89, 0.10], [300, 0.82, 0.13], [400, 0.74, 0.15], [500, 0.64, 0.17], [600, 0.55, 0.17], [700, 0.46, 0.15], [800, 0.37, 0.13], [900, 0.29, 0.11], [950, 0.22, 0.09]];
export const corCss = (cor: Cor, passo = 500) => {
  const c = CORES.find((x) => x.id === cor) ?? CORES[0];
  const e = ESCALA.find((x) => x[0] === passo) ?? ESCALA[5];
  return `oklch(${e[1]} ${(e[2] * (c.c ?? 1)).toFixed(3)} ${c.h})`;
};

const CHAVE = 'bc_marca';
export const salvarMarca = (m: Marca) => chatApi<{ marca: Marca | null }>({ acao: 'marca_salvar', ...m });
export function marcaGuardada(): Marca | null {
  try { const v = localStorage.getItem(CHAVE); return v ? (JSON.parse(v) as Marca) : null; } catch { return null; }
}
// Aplica a cor no app inteiro (variáveis do tema) e guarda para abrir já com a marca na próxima vez.
export function aplicarMarca(m: Marca | null) {
  const raiz = document.documentElement.style;
  const c = m ? CORES.find((x) => x.id === m.cor) : undefined;
  for (const [passo, l, ch] of ESCALA) {
    if (c && c.id !== 'laranja') raiz.setProperty(`--primary-${passo}`, `${l} ${(ch * (c.c ?? 1)).toFixed(3)} ${c.h}`);
    else raiz.removeProperty(`--primary-${passo}`);
  }
  try { if (m) localStorage.setItem(CHAVE, JSON.stringify(m)); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new CustomEvent('bc-marca', { detail: m }));
}

// Logo: reduz no próprio celular para no máximo 256 px (cabe no banco grátis).
export function reduzirLogo(arquivo: File): Promise<string> {
  return new Promise((ok, falha) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const lado = 256;
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      let d = cv.toDataURL('image/webp', 0.85);
      if (!d.startsWith('data:image/webp')) d = cv.toDataURL('image/png');
      if (d.length > 78000) d = cv.toDataURL('image/jpeg', 0.7);
      ok(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Não consegui abrir essa imagem.')); };
    img.src = url;
  });
}
