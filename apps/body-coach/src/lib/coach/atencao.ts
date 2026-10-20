// "Quem precisa de atenção hoje" (painel do coach): alunos 3+ dias sem treinar, com uma mensagem pronta para mandar em 1 toque.
// Sem imports de propósito: lógica pura, testada direto em tests/unit/body-coach-coach-atencao.test.js.

export interface AlunoAtencao {
  uid: string; nome: string;
  treinouHoje: boolean; diasSemTreinar: number | null;
  vinculo?: 'principal' | 'parceiro';
}

export const DIAS_ATENCAO = 3;

// 3 dias ou mais sem treinar (ou nunca treinou pelo app). Mesmo critério de `sumiu` em alunos.ts.
export const precisaAtencao = (a: AlunoAtencao) => !a.treinouHoje && (a.diasSemTreinar == null || a.diasSemTreinar >= DIAS_ATENCAO);

// Lista do dia: quem sumiu há mais tempo primeiro; quem nunca treinou vai por último (pode ser aluno recém-chegado).
export function quemPrecisaDeAtencao<T extends AlunoAtencao>(alunos: T[]): T[] {
  return alunos.filter(precisaAtencao).sort((x, y) =>
    (y.diasSemTreinar ?? -1) - (x.diasSemTreinar ?? -1) || x.nome.localeCompare(y.nome));
}

const primeiroNome = (nome: string) => (nome || '').trim().split(/\s+/)[0] || '';

// Mensagem curta e gentil, que o coach pode editar antes de enviar.
export function mensagemPronta(a: AlunoAtencao): string {
  const oi = primeiroNome(a.nome) ? `Oi, ${primeiroNome(a.nome)}!` : 'Oi!';
  if (a.diasSemTreinar == null) return `${oi} Vi que você ainda não registrou nenhum treino no app. Quer ajuda para começar? Me conta como está a sua rotina que eu ajusto a ficha para você.`;
  if (a.diasSemTreinar >= 7) return `${oi} Faz ${a.diasSemTreinar} dias que você não registra treino. Está tudo bem? Se a rotina apertou, me fala que eu monto um treino mais curto para você voltar.`;
  return `${oi} Senti sua falta nos treinos (${a.diasSemTreinar} dias sem registrar). Bora voltar hoje? Nem que seja um treino rápido de 20 minutos. 💪`;
}

// Link para a conversa com o aluno já com a mensagem escrita (o coach só confere e toca em enviar).
export const linkMensagem = (a: AlunoAtencao) => `/chat?com=${encodeURIComponent(a.uid)}&texto=${encodeURIComponent(mensagemPronta(a))}`;
