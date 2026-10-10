import { useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { CAMPOS } from '@/lib/avaliacao/campos';
import { METRICAS_DERIVADAS, metricaInfo } from '@/lib/avaliacao/calculos';
import type { ItemSerie } from '@/lib/avaliacao/serie';

const curta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// Linhas da tabela: primeiro os resultados, depois as medidas na ordem da ficha.
const LINHAS = [
  ...METRICAS_DERIVADAS.map((m) => m.key),
  ...CAMPOS.filter((c) => ['dobras', 'circ', 'diametros'].includes(c.grupo)).map((c) => c.key),
];

// Tabela comparando até 5 datas, com a seta de subiu/desceu (verde quando é bom, vermelho quando não).
export default function TabelaEvolucao({ serie, inicial }: { serie: ItemSerie[]; inicial?: number[] }) {
  const padrao = useMemo(() => {
    if (inicial?.length) return inicial;
    // As mais completas primeiro, até 5, em ordem de data.
    return [...serie].sort((a, b) => Object.keys(b.m).length - Object.keys(a.m).length).slice(0, 5).map((s) => s.id);
  }, [serie, inicial]);
  const [marcadas, setEscolhidas] = useState<number[] | null>(null);
  const escolhidas = marcadas ?? padrao;
  const cols = serie.filter((s) => escolhidas.includes(s.id));
  const linhas = LINHAS.filter((k) => cols.some((c) => c.m[k] != null));

  const alternar = (id: number) =>
    setEscolhidas(escolhidas.includes(id) ? escolhidas.filter((x) => x !== id) : escolhidas.length >= 5 ? escolhidas : [...escolhidas, id]);

  return (
    <Card padding="p-5">
      <h2 className="mb-1 font-heading text-base font-semibold text-foreground-950">Tabela de evolução</h2>
      <p className="mb-3 text-xs text-foreground-500">Escolha até 5 datas para comparar.</p>
      <div className="-mx-1 mb-3 flex flex-wrap gap-1.5 px-1">
        {serie.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => alternar(s.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${escolhidas.includes(s.id) ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'bg-background-100 text-foreground-600'}`}
          >
            {curta(s.data)}
          </button>
        ))}
      </div>
      {cols.length === 0 ? (
        <p className="text-sm text-foreground-500">Escolha ao menos uma data.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[420px] text-xs">
            <thead>
              <tr className="border-b border-background-200 text-foreground-500">
                <th className="sticky left-0 bg-background-50 py-2 pr-2 text-left font-medium">Medida</th>
                {cols.map((c) => <th key={c.id} className="px-2 py-2 text-right font-medium">{curta(c.data)}</th>)}
              </tr>
            </thead>
            <tbody>
              {linhas.map((k) => {
                const info = metricaInfo(k);
                return (
                  <tr key={k} className="border-b border-background-100">
                    <td className="sticky left-0 bg-background-50 py-1.5 pr-2 text-foreground-700">
                      {info?.label} {info?.unidade && <span className="text-foreground-400">({info.unidade})</span>}
                    </td>
                    {cols.map((c, i) => {
                      const v = c.m[k];
                      const ant = cols.slice(0, i).reverse().find((p) => p.m[k] != null)?.m[k];
                      const d = v != null && ant != null ? Math.round((v - ant) * 100) / 100 : null;
                      const bom = d && info?.sentido ? Math.sign(d) === info.sentido : null;
                      return (
                        <td key={c.id} className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-foreground-900">
                          {v == null ? <span className="text-foreground-300">–</span> : fmt(v)}
                          {d ? (
                            <span className={`ml-1 text-[10px] font-medium ${bom == null ? 'text-foreground-400' : bom ? 'text-accent-600' : 'text-red-500'}`}>
                              {d > 0 ? '↑' : '↓'}{fmt(Math.abs(d))}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
