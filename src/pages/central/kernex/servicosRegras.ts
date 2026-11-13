// C2-E (13/11, dono: "mostra que 9 de 11 estão ativos... 9 de 11 o quê? o que preciso fazer?"):
// cada serviço medido vira uma linha com nome, situação em português, o porquê e o passo a passo para resolver.
export type Medida = { id: string; ok: boolean | null; codigo?: number; tempo?: number; lento?: boolean; quando?: string | null };
export type Produto = { id: string; nome?: string; url?: string };
export type Linha = { id: string; nome: string; url: string | null; cor: "verde" | "amarelo" | "vermelho" | "cinza"; situacao: string; porque: string; passos: string[]; precisaDono: boolean };

const NOMES: Record<string, string> = { bodycoach: "Body Coach", cortex: "Cortex", central: "Central", studiolima: "Site Studio Lima", finance: "Kernex Finance", prumo: "Kernex Finance" };

export function explicarServico(m: Medida, p?: Produto): Linha {
  const nome = p?.nome || NOMES[m.id] || m.id;
  const url = p?.url || null;
  const base = { id: m.id, nome, url };
  const c = Number(m.codigo || 0);
  if (m.ok === null) return { ...base, cor: "cinza", situacao: "Sem medição agora", porque: "O vigia ainda não conseguiu medir este serviço com prova.", passos: ["Não precisa fazer nada: o vigia mede de novo em até 1 hora."], precisaDono: false };
  if (m.ok && m.lento) return { ...base, cor: "amarelo", situacao: "No ar, mas lento", porque: `Respondeu em ${Math.round((m.tempo || 0) / 100) / 10} s (o normal é menos de 3 s).`, passos: ["Abra o site e veja se carrega.", "Se ficar lento o dia todo, peça ao Cortex: \"o " + nome + " está lento\"."], precisaDono: false };
  if (m.ok) return { ...base, cor: "verde", situacao: "No ar", porque: `Respondeu normalmente (${c || 200}) em ${Math.round(m.tempo || 0)} ms.`, passos: [], precisaDono: false };
  if (c === 404) return { ...base, cor: "vermelho", situacao: "Fora do ar: página não existe", porque: "O endereço responde, mas a página não foi publicada (erro 404).", passos: ["Toque em \"Pedir conserto ao Cortex\": ele publica de novo.", "Se for um site que não usa mais, avise para tirar da lista."], precisaDono: false };
  if (c === 401 || c === 403) return { ...base, cor: "amarelo", situacao: "Bloqueado ou pede senha", porque: `O servidor recusou o vigia (erro ${c}). Pode estar certo se a página tem senha.`, passos: ["Abra o site: se abrir para você, está tudo bem.", "Se não abrir, toque em \"Pedir conserto ao Cortex\"."], precisaDono: false };
  if (c >= 500) return { ...base, cor: "vermelho", situacao: "Fora do ar: erro no servidor", porque: `O servidor ou a hospedagem deu erro (${c}).`, passos: ["Espere 10 minutos: às vezes a hospedagem volta sozinha.", "Se continuar, toque em \"Pedir conserto ao Cortex\"."], precisaDono: false };
  return { ...base, cor: "vermelho", situacao: "Fora do ar: não respondeu", porque: "O endereço não respondeu (pode estar desligado ou com o domínio errado).", passos: ["Toque em \"Abrir\" para conferir.", "Se não abrir, toque em \"Pedir conserto ao Cortex\".", "Se o domínio venceu ou mudou, isso é com você: renove ou diga o endereço novo."], precisaDono: true };
}

/** Linhas na ordem que importa: fora do ar primeiro, depois atenção, depois no ar. */
export function listarServicos(medidas: Medida[] = [], produtos: Produto[] = []): Linha[] {
  const peso = { vermelho: 0, amarelo: 1, cinza: 2, verde: 3 } as const;
  return medidas.map((m) => explicarServico(m, produtos.find((p) => p.id === m.id))).sort((a, b) => peso[a.cor] - peso[b.cor] || a.nome.localeCompare(b.nome));
}

/** Frase curta para o menu e o Início: diz o quê, não só o número. */
export function resumoServicos(medidas: Medida[] = []): string {
  const medidos = medidas.filter((m) => m.ok !== null);
  if (!medidos.length) return "Serviços: sem medição agora";
  const fora = medidos.filter((m) => m.ok === false).length;
  return fora ? `${fora} de ${medidos.length} sites e sistemas fora do ar` : `Todos os ${medidos.length} sites e sistemas no ar`;
}
