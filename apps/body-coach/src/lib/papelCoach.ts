// Papel do usuário na conversa com o coach e os contatos (para o aluno: os coaches dele).
// Uma chamada só por abertura do app; quem não tem coach fica como "nenhum" e as telas não insistem.
import { chatApi, type Contato } from './chat';
import { aplicarMarca, type Marca } from './coach/profissionais';

type Papel = 'coach' | 'aluno' | 'nenhum';
// Guardado no aparelho: o menu certo aparece na hora, mesmo antes da resposta ou sem internet.
export function papelGuardado(): Papel | null {
  try {
    const p = localStorage.getItem('bc_papel');
    if (p === 'coach' || p === 'aluno' || p === 'nenhum') {
      return p as Papel;
    }
    return null;
  } catch {
    return null;
  }
}
// DICAS DE UI SÓ: papelGuardado lê o papel salvo no aparelho e serve para o menu certo
// aparecer na hora (inclusive sem internet). O valor pode ser alterado pelo usuário,
// então NUNCA use esta função para decisões de autorização — autorização sempre vem
// do servidor, via papelEContatos() (chat acao="contatos").