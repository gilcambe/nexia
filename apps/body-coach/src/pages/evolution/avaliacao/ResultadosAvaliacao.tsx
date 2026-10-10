import type { Avaliacao, Resultado } from '@/lib/avaliacao/calculos';
import { DOBRAS_PROTOCOLO } from '@/lib/avaliacao/calculos';

const BOM = ['Peso normal', 'Baixo', 'Adequado', 'Excelente', 'Bom', 'Acima da média'];
const ATENCAO = ['Sobrepeso', 'Moderado', 'Média', 'Abaixo da média', 'Depleção leve', 'Baixa', 'Abaixo do peso'];

function tom(classe: string | null): string {
  if (!classe) return 'bg-background-100 text-foreground-600';
  if (BOM.includes(classe)) return 'bg-accent-100 text-accent-700';
  if (ATENCAO.includes(classe)) return 'bg-secondary-100 text-secondary-800';
  return 'bg-red-100 text-red-700';
}

const n = (v: number | null | undefined, casas = 1) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

// Os números calculados da avaliação, com a classificação de cada um.
export default function ResultadosAvaliacao({ av, res, compacto }: { av: Avaliacao; res: Resultado; compacto?: boolean }) {
  const v = av.valores;
  const itens: { label: string; valor: string; classe?: string | null; dica?: string }[] = [
    { label: 'Peso', valor: `${n(v.peso)} kg`, dica: res.pesoSaudavel ? `saudável pelo IMC: ${n(res.pesoSaudavel[0])}–${n(res.pesoSaudavel[1])} kg` : undefined },
    { label: '% de gordura', valor: `${n(res.gordura)}%`, classe: res.gorduraClasse, dica: res.gorduraDobras != null ? 'pelas dobras' : res.gorduraBio != null ? 'pela balança' : undefined },
    { label: 'Massa de gordura', valor: `${n(res.massaGorda)} kg` },
    { label: 'Massa magra', valor: `${n(res.mlg)} kg`, dica: 'tudo que não é gordura' },
    { label: 'IMC', valor: n(res.imc), classe: res.imcClasse, dica: 'não separa músculo de gordura' },
    { label: 'Cintura/quadril', valor: n(res.rcq, 2), classe: res.rcqRisco ? `Risco ${res.rcqRisco.toLowerCase()}` : null },
    { label: 'Músculo do braço (CMB)', valor: `${n(res.cmb)} cm`, classe: res.cmbClasse },
    { label: 'Soma das dobras', valor: `${n(res.somaDobras, 0)} mm`, dica: res.protocolo ? DOBRAS_PROTOCOLO[res.protocolo].nome : undefined },
  ];
  if (res.densidade) itens.push({ label: 'Densidade corporal', valor: `${n(res.densidade, 3)} g/mL` });
  if (res.gorduraDobras != null && res.gorduraBio != null) itens.push({ label: '% gordura (balança)', valor: `${n(res.gorduraBio)}%`, dica: 'a balança costuma variar com a hidratação' });
  if (v.massa_muscular) itens.push({ label: 'Massa muscular (balança)', valor: `${n(v.massa_muscular)} kg` });
  if (v.visceral) itens.push({ label: 'Gordura visceral', valor: n(v.visceral, 0), classe: v.visceral <= 12 ? 'Bom' : 'Alto' });
  if (res.tmb) itens.push({ label: 'Metabolismo basal', valor: `${n(res.tmb, 0)} kcal`, dica: v.tmb ? 'da balança' : 'estimado pela massa magra' });
  if (res.massaResidual) itens.push({ label: 'Massa residual', valor: `${n(res.massaResidual)} kg`, dica: 'órgãos e líquidos' });
  if (res.aguaLitros && !compacto) itens.push({ label: 'Água por dia', valor: `${n(res.aguaLitros)} L`, dica: '35 ml por kg' });

  const visiveis = itens.filter((i) => !i.valor.startsWith('—'));
  if (visiveis.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-500">Resultados calculados</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visiveis.map((i) => (
          <div key={i.label} className="rounded-xl bg-background-100/70 p-2.5">
            <p className="text-[11px] text-foreground-500">{i.label}</p>
            <p className="font-heading text-base font-bold text-foreground-950">{i.valor}</p>
            {i.classe && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tom(i.classe.replace(/^Risco /, '').replace(/^./, (c) => c.toUpperCase()))}`}>{i.classe}</span>}
            {i.dica && <p className="mt-0.5 text-[10px] leading-tight text-foreground-400">{i.dica}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
