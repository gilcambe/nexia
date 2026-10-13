// Papel do usuário na conversa com o coach e os contatos (para o aluno: os coaches dele).
// Uma chamada só por abertura do app; quem não tem coach fica como "nenhum" e as telas não insistem.
import { chatApi, type Contato } from './chat';
import { aplicarMarca, type Marca } from './coach/profissionais';

type Papel = 'coach' | 'aluno' | 'nenhum';
// Guardado no aparelho: o menu certo aparece na hora, mesmo antes da resposta ou sem internet.
// ATENÇÃO: Este valor é apenas para conveniência visual no cliente e NÃO DEVE ser usado para controle de acesso ou autorização de funcionalidades sensíveis.
// O controle de acesso e a autorização devem ser sempre verificados no backend.
export function papelGuardado(): Papel | null {
  try {
    const p = localStorage.getItem('bc_papel');
    return p === 'coach' || p === 'aluno' || p === 'nenhum' ? (p as Papel) : null;
  } catch {
    return null;
  }
}

function guardarPapel(p: Papel | null) {
  try {
    if (p) localStorage.setItem('bc_papel', p);
    else localStorage.removeItem('bc_papel');
  } catch {
    /* sem armazenamento */
  }
  if (p) window.dispatchEvent(new CustomEvent('bc-papel-salvo', { detail: p }));
}

let papelConhecido: Papel | undefined;
// Valor lido do localStorage ao inicializar o app
// Garante que o menu correto apareça na hora, mesmo antes da resposta ou sem internet
let contatosConhecidos: Contato[] = [];
let papelPromessa: Promise<void> | undefined;

function descobrirPapel() {
  papelPromessa ??= chatApi<{ papel: 'coach' | 'aluno'; contatos: Contato[]; marca?: Marca | null }>({ acao: 'contatos' })
    .then((r) => {
      papelConhecido =
        r.papel === 'aluno' && !r.contatos.length ? 'nenhum' : r.papel;
      contatosConhecidos = r.contatos ?? [];
      aplicarMarca(r.marca ?? null); // a cor e o logo do coach (ou o tema padrão)
      guardarPapel(papelConhecido);
    })
    .catch(() => {
      papelConhecido = papelGuardado() ?? 'nenhum';
    });
  return papelPromessa;
}

export async function papelEContatos(): Promise<{
  papel: 'coach' | 'aluno' | 'nenhum';
  contatos: Contato[];
}> {
  await descobrirPapel();
  return { papel: papelConhecido ?? 'nenhum', contatos: contatosConhecidos };
}

export const papelSalvo = () => papelConhecido;

// Depois de entrar numa equipe, mudar a marca ou sair da conta: descobre de novo na próxima vez.
// Avisa o menu (evento bc-papel) para trocar entre as telas do coach e as do aluno.
export function esquecerPapel() {
  papelPromessa = undefined;
  papelConhecido = undefined;
  contatosConhecidos = [];
  guardarPapel(null);
  window.dispatchEvent(new Event('bc-papel'));
}
