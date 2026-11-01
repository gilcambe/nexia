// Melhoria C5 (#823): pergunta não espera fila. Só pedido de código vira tarefa (issue).
// Funções puras (sem rede), testadas em tests/unit/cortex-respostas-diretas.test.js.

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Verbos de mudança: se aparecem, é pedido de trabalho, mesmo com "?" no fim ("pode criar a tela X?").
const FAZER = /\b(cri[ae]r?|crie|fa[cz]a|fazer|mud[ae]r?|mude|corrij[ae]|corrigir|adicion[ae]r?|implement[ae]r?|remov[ae]r?|apag[ae]r?|troqu[ae]|trocar|coloqu[ae]|colocar|ajust[ae]r?|publiqu[ae]|publicar|refa[cz]a|refazer|escrev[ae]r?|gere|gerar|mont[ae]r?|ligu[ae]|ligar|conserte|consertar|atualiz[ae]r?|melhor[ae]r?|inclu[ai]r?|tir[ae]r?|bot[ae]r?)\b/;
// Começo típico de pergunta em português.
const INICIO = /^(como|o que|oque|que |qual|quais|quanto|quantos|quantas|quando|onde|por que|porque|pq|quem|sera|existe|tem |ha |status|resumo|situacao)/;

/** Palavras relacionadas a alterações de projeto/sistema. */
const PALAVRAS_CODIGO = /\b(projeto|site|app|tela|bot[ãa]o|p[áa]gina|painel|c[óo]digo|reposit[óo]rio|bug|erro|deploy|publicar|issue|pr|tenant|body coach|splash|central)\b/;

/** Texto curto que pergunta algo e não pede mudança de código. */
export function ehPergunta(texto: string): boolean {
  const t = sem(texto || "");
  if (!t || t.length > 400 || t.includes("```") || /\n\s*\n/.test(t)) return false;
  if (FAZER.test(t)) return false;
  return t.endsWith("?") || INICIO.test(t);
}

/** Função pura que retorna true apenas quando o texto contém palavras relacionadas a alterações de projeto/sistema. */
export function ehPedidoDeCodigo(texto: string): boolean {
  const t = sem(texto || "");
  return PALAVRAS_CODIGO.test(t);
}

// Função pura exportada - retorna true quando texto contém palavras relacionadas a alterações de projeto/sistema
  const t = sem(texto || "");
  if (!t || t.length > 400 || t.includes("```") || /\n\s*\n/.test(t)) return false;
  if (FAZER.test(t)) return false;
  return t.endsWith("?") || INICIO.test(t);
}

/** Função pura que retorna true apenas quando o texto contém palavras relacionadas a alterações de projeto/sistema. */
export function ehPedidoDeCodigo(texto: string): boolean {
  const t = sem(texto || "");
  return PALAVRAS_CODIGO.test(t);
}

// Função pura exportada - retorna true quando texto contém palavras relacionadas a alterações de projeto/sistema

/** Pergunta sobre como andam as tarefas: a resposta lê a Central (fila do Cortex) antes. */
export function ehSobreSituacao(texto: string): boolean {
  const t = sem(texto || "");
  return /(como (estamos|esta|anda|vai)|o que falta|oque falta|falta o que|status|situacao|resumo|andamento|na fila|travad|pendente|feito hoje|o que (foi )?feito)/.test(t);
}

export interface TarefaCentral { numero: number; titulo: string }
export interface SituacaoCortex { naFila: number; fazendo: TarefaCentral[]; travadas: TarefaCentral[]; feitas7: number; ultimas?: TarefaCentral[]; proximas?: TarefaCentral[] }

/** Contexto curto da Central para o modelo rápido responder com números reais. */
export function contextoCentral(s: SituacaoCortex | null | undefined): string {
  if (!s) return "";
  const nomes = (l: TarefaCentral[] | undefined) => (l || []).slice(0, 5).map((x) => `#${x.numero} ${x.titulo}`).join("; ") || "nenhuma";
  return [
    "Situação agora (Central NEXIA, fila do Cortex):",
    `- na fila: ${s.naFila}`,
    `- fazendo agora: ${(s.fazendo || []).length} (${nomes(s.fazendo)})`,
    `- travadas (precisam do dono): ${(s.travadas || []).length} (${nomes(s.travadas)})`,
    `- feitas nos últimos 7 dias: ${s.feitas7} (últimas: ${nomes(s.ultimas)})`,
    `- próximas: ${nomes(s.proximas)}`,
    "Responda em português simples, curto, usando só esses números.",
  ].join("\n");
}
