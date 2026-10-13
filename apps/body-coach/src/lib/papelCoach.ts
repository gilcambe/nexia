// Papel do usuário na conversa com o coach e os contatos (para o aluno: os coaches dele).
// Uma chamada só por abertura do app; quem não tem coach fica como "nenhum" e as telas não insistem.
import { chatApi, type Contato } from './chat';
import { aplicarMarca, type Marca } from './coach/profissionais';
import { useState, useEffect } from 'react';

type Papel = 'coach' | 'aluno' | 'nenhum';
// Guardado no aparelho: o menu certo aparece na hora, mesmo antes da resposta ou sem internet.
export function papelGuardado(): Papel | null {
  try {
    const p = localStorage.getItem('bc_papel');
    return p === 'coach' || p === 'aluno' || p === 'nenhum' ? (p as Papel) : null;
  } catch {
    return null;
  }
}
let papelConhecido: Papel | undefined;
let contatosConhecidos: Contato[] = [];
let papelPromessa: Promise<void> | undefined;
function descobrirPapel() {
  papelPromessa ??= chatApi<{ papel: 'coach' | 'aluno'; contatos: Contato[]; marca?: Marca | null }>({ acao: 'contatos' })
    .then((r) => {
      papelConhecido = r.papel === 'aluno' && !r.contatos.length ? 'nenhum' : r.papel;
      if (papelConhecido) {
        localStorage.setItem('bc_papel', papelConhecido);
      }
      contatosConhecidos = r.contatos ?? [];
      aplicarMarca(r.marca ?? null); // a cor e o logo do coach (ou o tema padrão)
    })
    .catch(() => { papelConhecido = 'nenhum'; localStorage.removeItem('bc_papel'); });
  return papelPromessa;
}

export async function papelEContatos(): Promise<{ papel: 'coach' | 'aluno' | 'nenhum'; contatos: Contato[] }> {
  await descobrirPapel();
  return { papel: papelConhecido ?? 'nenhum', contatos: contatosConhecidos };
}


export const papelSalvo = () => papelConhecido;

export function usePapel() {
  const [papel, setPapel] = useState<Papel | null>(papelGuardado());
  const [contatos, setContatos] = useState<Contato[]>([]);

  useEffect(() => {
    papelEContatos().then(({ papel: novoPapel, contatos: novosContatos }) => {
      setPapel(novoPapel);
      setContatos(novosContatos);
    });
  }, []);

  return { papel, contatos };
}

// Depois de entrar numa equipe, mudar a marca ou sair da conta: descobre de novo na próxima vez.
export function esquecerPapel() {
  papelPromessa = undefined;
  papelConhecido = undefined;
  contatosConhecidos = [];
  localStorage.removeItem('bc_papel');
}
