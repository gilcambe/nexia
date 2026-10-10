// Papel do usuário na conversa com o coach e os contatos (para o aluno: os coaches dele).
// Uma chamada só por abertura do app; quem não tem coach fica como "nenhum" e as telas não insistem.
import { chatApi, type Contato } from './chat';

let papelConhecido: 'coach' | 'aluno' | 'nenhum' | undefined;
let contatosConhecidos: Contato[] = [];
let papelPromessa: Promise<void> | undefined;
function descobrirPapel() {
  papelPromessa ??= chatApi<{ papel: 'coach' | 'aluno'; contatos: Contato[] }>({ acao: 'contatos' })
    .then((r) => { papelConhecido = r.papel === 'aluno' && !r.contatos.length ? 'nenhum' : r.papel; contatosConhecidos = r.contatos ?? []; })
    .catch(() => { papelConhecido = 'nenhum'; });
  return papelPromessa;
}

export async function papelEContatos(): Promise<{ papel: 'coach' | 'aluno' | 'nenhum'; contatos: Contato[] }> {
  await descobrirPapel();
  return { papel: papelConhecido ?? 'nenhum', contatos: contatosConhecidos };
}


export const papelSalvo = () => papelConhecido;
