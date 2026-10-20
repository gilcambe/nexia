// Ficha de treino e plano alimentar em PDF (para baixar/imprimir) e em texto (para mandar no WhatsApp).
import type { FichaCoach } from '../coach/fichaCoach';
import type { PlanoAlimentar } from '../planoAlimentar';
import { gerarPdf, type LinhaPdf } from './pdfSimples';

type Plano = Pick<PlanoAlimentar, 'refeicoes' | 'totais' | 'extras'> & { arquivo?: string };
const descanso = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}min${s % 60 ? ` ${s % 60}s` : ''}` : `${s}s`);
const hoje = () => new Date().toLocaleDateString('pt-BR');

export function fichaEmLinhas(f: FichaCoach): LinhaPdf[] {
  const l: LinhaPdf[] = [];
  if (f.obs) l.push({ texto: f.obs, cinza: true, antes: 2 });
  f.dias.forEach((d) => {
    l.push({ texto: d.titulo, tam: 14, negrito: true, antes: 12 });
    d.exercicios.forEach((x, j) => {
      l.push({ texto: `${j + 1}. ${x.nome}`, negrito: true, antes: 4 });
      l.push({ texto: `${x.series} séries × ${x.reps} reps  ·  descanso ${descanso(x.descanso)}${x.carga ? `  ·  carga ${x.carga}` : ''}`, recuo: 14 });
      if (x.obs) l.push({ texto: x.obs, recuo: 14, cinza: true });
    });
  });
  return l;
}

export function fichaEmTexto(f: FichaCoach, aluno?: string): string {
  const linhas = [`*${f.nome}*${aluno ? ` · ${aluno}` : ''}`];
  if (f.obs) linhas.push(f.obs);
  f.dias.forEach((d) => {
    linhas.push('', `*${d.titulo}*`);
    d.exercicios.forEach((x, j) => linhas.push(`${j + 1}. ${x.nome}: ${x.series}×${x.reps}, descanso ${descanso(x.descanso)}${x.carga ? `, ${x.carga}` : ''}${x.obs ? ` (${x.obs})` : ''}`));
  });
  linhas.push('', 'Feito com Body Coach');
  return linhas.join('\n');
}

export function dietaEmLinhas(p: Plano): LinhaPdf[] {
  const l: LinhaPdf[] = [];
  const t = p.totais;
  if (t && (t.kcal || t.proteina)) l.push({ texto: `Metas do dia: ${Math.round(t.kcal)} kcal · proteína ${Math.round(t.proteina)} g · carbo ${Math.round(t.carbo)} g · gordura ${Math.round(t.gordura)} g`, negrito: true });
  p.refeicoes.forEach((r) => {
    l.push({ texto: `${r.horario ? `${r.horario}  ` : ''}${r.nome}`, tam: 13, negrito: true, antes: 12 });
    r.itens.forEach((it) => l.push({ texto: `• ${it.nome}${it.qtd ? ` – ${it.qtd}` : ''}`, recuo: 10 }));
    r.trocas.forEach((tr) => l.push({ texto: `Pode trocar ${tr.de} por: ${tr.por.join(', ')}`, recuo: 10, cinza: true }));
    r.obs.forEach((o) => l.push({ texto: o, recuo: 10, cinza: true }));
  });
  (p.extras ?? []).forEach((e) => {
    l.push({ texto: e.titulo, tam: 13, negrito: true, antes: 12 });
    e.texto.forEach((x) => l.push({ texto: x, recuo: 10 }));
  });
  return l;
}

export function dietaEmTexto(p: Plano, aluno?: string): string {
  const linhas = [`*Plano alimentar*${aluno ? ` · ${aluno}` : ''}`];
  const t = p.totais;
  if (t && t.kcal) linhas.push(`Metas: ${Math.round(t.kcal)} kcal, P ${Math.round(t.proteina)} g, C ${Math.round(t.carbo)} g, G ${Math.round(t.gordura)} g`);
  p.refeicoes.forEach((r) => {
    linhas.push('', `*${r.horario ? `${r.horario} ` : ''}${r.nome}*`);
    r.itens.forEach((it) => linhas.push(`• ${it.nome}${it.qtd ? ` (${it.qtd})` : ''}`));
    r.obs.forEach((o) => linhas.push(`_${o}_`));
  });
  linhas.push('', 'Feito com Body Coach');
  return linhas.join('\n');
}

export const pdfDaFicha = (f: FichaCoach, aluno?: string) =>
  gerarPdf(f.nome, [aluno && `Aluno: ${aluno}`, f.coach && `Coach: ${f.coach}`, hoje()].filter(Boolean).join('  ·  '), fichaEmLinhas(f));
export const pdfDaDieta = (p: Plano, aluno?: string, coach?: string) =>
  gerarPdf('Plano alimentar', [aluno && `Aluno: ${aluno}`, coach && `Por: ${coach}`, hoje()].filter(Boolean).join('  ·  '), dietaEmLinhas(p));

const nomeArquivo = (s: string) => `${s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'plano'}.pdf`;

export function baixar(pdf: Blob, nome: string) {
  const url = URL.createObjectURL(pdf);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo(nome);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// No celular, manda o PDF pelo menu de compartilhar (WhatsApp aparece lá). Sem isso, abre o WhatsApp com o texto.
export async function mandarNoWhatsApp(pdf: Blob, nome: string, texto: string): Promise<'arquivo' | 'texto'> {
  const arquivo = new File([pdf], nomeArquivo(nome), { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo], title: nome, text: nome });
      return 'arquivo';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'arquivo';
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto.slice(0, 3500))}`, '_blank', 'noopener');
  return 'texto';
}
