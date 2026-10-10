// Lista de compras da semana a partir do cardápio automático (7 dias) ou do plano do nutricionista.
import { montarCardapio, POR_ID, type Metas } from '../dietPlan';

export interface ItemCompra { id: string; nome: string; total: string; grupo: string }

const GRUPO_NOME: Record<string, string> = {
  prot: 'Carnes, ovos e proteínas',
  prot_leve: 'Laticínios e proteínas leves',
  leguminosa: 'Grãos e leguminosas',
  carbo: 'Arroz, massas e raízes',
  carbo_cafe: 'Padaria e café da manhã',
  fruta: 'Frutas',
  gord: 'Oleaginosas, azeite e gorduras',
  leg: 'Verduras e legumes',
};

function formatar(qtd: number, un: 'g' | 'ml' | 'un'): string {
  if (un === 'un') return `${Math.ceil(qtd)} ${Math.ceil(qtd) === 1 ? 'unidade' : 'unidades'}`;
  if (qtd >= 1000) return `${(Math.ceil(qtd / 100) / 10).toLocaleString('pt-BR')} ${un === 'g' ? 'kg' : 'L'}`;
  return `${Math.ceil(qtd / 50) * 50} ${un}`;
}

export function listaDaSemana(ob: Record<string, unknown>, metas: Metas, evitar: string[] = [], dias = 7): ItemCompra[] {
  const soma = new Map<string, number>();
  for (let d = 0; d < dias; d++) {
    for (const r of montarCardapio(ob, metas, d, evitar)) {
      for (const i of r.itens) {
        if (!i.id || !i.qtd) continue;
        soma.set(i.id, (soma.get(i.id) ?? 0) + i.qtd);
      }
    }
  }
  const out: ItemCompra[] = [];
  for (const [id, qtd] of soma) {
    const b = POR_ID[id];
    if (!b) continue;
    out.push({ id, nome: b.nome, total: formatar(qtd, b.un), grupo: GRUPO_NOME[b.grupos[0]] ?? 'Outros' });
  }
  return out.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nome.localeCompare(b.nome));
}

// Plano do nutricionista: os itens vêm em texto livre; agrupa os nomes iguais e mostra a porção por dia.
export function listaDoPlano(refeicoes: { itens: { nome: string; qtd: string }[] }[]): ItemCompra[] {
  const vistos = new Map<string, ItemCompra>();
  for (const r of refeicoes) for (const i of r.itens) {
    const chave = i.nome.trim().toLowerCase();
    if (!chave) continue;
    const ant = vistos.get(chave);
    if (ant) ant.total = `${ant.total} + ${i.qtd}`;
    else vistos.set(chave, { id: chave, nome: i.nome.trim(), total: i.qtd || '—', grupo: 'Do seu plano (porção por dia × 7)' });
  }
  return [...vistos.values()];
}
