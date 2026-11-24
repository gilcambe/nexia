// Dieta do nutricionista lida por IA (PDF qualquer, foto do papel ou texto colado do WhatsApp):
// a IA devolve um JSON e aqui ele vira o PlanoAlimentar do app. Calorias e macros de cada refeição
// são calculadas pela tabela de alimentos do app quando o nutricionista não escreveu.
import type { Macros, PlanoAlimentar, RefeicaoPlano } from './planoAlimentar';
import { identificar, quantidadeDoTexto } from './trocas';
import { porcaoDe } from './dietPlan';

const txt = (v: unknown, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };

function hora(v: unknown): string | null {
  const m = /(\d{1,2})\s*[:h]\s*(\d{2})?/.exec(String(v ?? ''));
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2] ?? 0);
  return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : null;
}

// Soma o que der para reconhecer na tabela. Só vale se reconheceu pelo menos metade dos itens.
export function estimarMacros(itens: { nome: string; qtd: string }[]): Macros | null {
  let ok = 0; const s = { proteina: 0, gordura: 0, carbo: 0, kcal: 0 };
  for (const it of itens) {
    const base = identificar(it.nome);
    const q = base ? quantidadeDoTexto(`${it.qtd} ${it.nome}`, base) : null;
    if (!base || !q) continue;
    const a = porcaoDe(base, q / base.qtd);
    s.kcal += a.kcal; s.proteina += a.p; s.carbo += a.c; s.gordura += a.g; ok++;
  }
  if (!itens.length || ok / itens.length < 0.5) return null;
  return { kcal: Math.round(s.kcal), proteina: Math.round(s.proteina), carbo: Math.round(s.carbo), gordura: Math.round(s.gordura) };
}

function macrosDe(v: unknown): Macros | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const m = { kcal: num(o.kcal ?? o.calorias), proteina: num(o.proteina ?? o.p), carbo: num(o.carbo ?? o.carboidrato ?? o.c), gordura: num(o.gordura ?? o.g) };
  return m.kcal > 0 ? m : null;
}

export function planoDoJson(resposta: string, arquivo = 'Plano importado', agora = new Date().toISOString()): PlanoAlimentar | null {
  const ini = resposta.indexOf('{'); const fim = resposta.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  let j: Record<string, unknown>;
  try { j = JSON.parse(resposta.slice(ini, fim + 1)); } catch { return null; }
  const lista = Array.isArray(j.refeicoes) ? j.refeicoes.slice(0, 12) : [];
  const refeicoes: RefeicaoPlano[] = [];
  for (const r of lista as Record<string, unknown>[]) {
    const itens = (Array.isArray(r?.itens) ? r.itens : []).slice(0, 25)
      .map((i: Record<string, unknown>) => ({ nome: txt(i?.nome, 80), qtd: txt(i?.qtd ?? i?.quantidade, 60) }))
      .filter((i: { nome: string }) => i.nome.length >= 2);
    if (!itens.length) continue;
    const trocas = (Array.isArray(r.trocas) ? r.trocas : []).slice(0, 25)
      .map((t: Record<string, unknown>) => ({ de: txt(t?.de, 80), por: (Array.isArray(t?.por) ? t.por : []).map((p: unknown) => txt(p, 80)).filter(Boolean).slice(0, 8) }))
      .filter((t: { de: string; por: string[] }) => t.de && t.por.length);
    refeicoes.push({
      horario: hora(r.horario),
      nome: txt(r.nome, 60) || `Refeição ${refeicoes.length + 1}`,
      itens, trocas,
      obs: (Array.isArray(r.obs) ? r.obs : r.obs ? [r.obs] : []).map((o: unknown) => txt(o, 200)).filter(Boolean).slice(0, 6),
      macros: macrosDe(r.macros) ?? estimarMacros(itens),
    });
  }
  if (!refeicoes.length) return null;
  refeicoes.sort((a, b) => (a.horario ?? '99').localeCompare(b.horario ?? '99'));
  const somadas = refeicoes.every((r) => r.macros) ? refeicoes.reduce((s, r) => ({ kcal: s.kcal + r.macros!.kcal, proteina: s.proteina + r.macros!.proteina, carbo: s.carbo + r.macros!.carbo, gordura: s.gordura + r.macros!.gordura }), { kcal: 0, proteina: 0, carbo: 0, gordura: 0 }) : null;
  const orient = (Array.isArray(j.orientacoes) ? j.orientacoes : []).map((o: unknown) => txt(o, 300)).filter(Boolean).slice(0, 20);
  return {
    arquivo: txt(arquivo, 80), importado_em: agora, refeicoes,
    totais: macrosDe(j.totais) ?? somadas,
    extras: orient.length ? [{ titulo: 'Orientações', texto: orient }] : [],
  };
}
