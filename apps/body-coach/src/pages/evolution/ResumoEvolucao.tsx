import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import { alertas, dataBr, prever, recordes } from '@/lib/avaliacao/calculos';
import type { PerfilAvaliacao } from '@/lib/avaliacao/dados';
import type { ItemSerie } from '@/lib/avaliacao/serie';
import { compartilharArquivo } from '@/lib/avaliacao/imagens';
import { gerarIcsReavaliacao } from '@/lib/lembretes';
import PainelCorpo from './corpo3d/PainelCorpo';

const fmt = (n: number | undefined | null, c = 1) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: c }));

export default function ResumoEvolucao({
  serie, perfil, volume, metaGordura, metaPeso, irPara,
}: {
  serie: ItemSerie[];
  perfil: PerfilAvaliacao;
  volume: Record<string, number>;
  metaGordura: number | null;
  metaPeso: number | null;
  irPara: (aba: 'avaliacoes' | 'fotos' | 'graficos') => void;
}) {
  const navigate = useNavigate();
  const ult = serie[serie.length - 1] ?? null;
  const ant = serie.length > 1 ? serie[serie.length - 2] : null;
  const pts = serie.map((s) => ({ data: s.data, m: s.m }));
  const avisos = alertas(pts);
  const recs = recordes(pts).filter((r) => r.novo);
  const pontosGordura = serie.filter((s) => s.m.gordura != null).map((s) => ({ data: s.data, valor: s.m.gordura }));
  const prevGordura = prever(pontosGordura.slice(-6), metaGordura);
  const pontosPeso = serie.filter((s) => s.m.peso != null).map((s) => ({ data: s.data, valor: s.m.peso }));
  const prevPeso = prever(pontosPeso.slice(-6), metaPeso);
  const diasDesde = ult ? Math.floor((Date.now() - new Date(`${ult.data}T12:00:00`).getTime()) / 86400000) : null;

  const kpis = ([
    ['peso', 'Peso', 'kg', 0],
    ['gordura', 'Gordura', '%', -1],
    ['mlg', 'Massa magra', 'kg', 1],
    ['cintura', 'Cintura', 'cm', -1],
  ] as const).map(([k, l, u, sentido]) => {
    const v = ult?.m[k];
    const a = ant?.m[k];
    const d = v != null && a != null ? Math.round((v - a) * 10) / 10 : null;
    return { k, l, u, v, d, bom: d && sentido ? Math.sign(d) === sentido : null };
  });

  const lembrete = () => void compartilharArquivo(new Blob([gerarIcsReavaliacao()], { type: 'text/calendar;charset=utf-8' }), 'reavaliacao-mensal.ics');

  return (
    <div className="space-y-4">
      <Card padding="p-4">
        <PainelCorpo serie={serie} perfil={perfil} volume={volume} />
      </Card>

      <Card padding="p-5">
        <div className="mb-3 flex items-center gap-2">
          <i className="ri-ruler-line text-lg text-primary-500"></i>
          <h2 className="font-heading text-base font-semibold text-foreground-950">Última avaliação</h2>
          <span className="ml-auto text-xs text-foreground-500">{ult ? dataBr(ult.data) : 'nenhuma ainda'}</span>
        </div>
        {!ult ? (
          <div className="text-center">
            <p className="mb-3 text-sm text-foreground-600">Comece importando o laudo da balança ou do nutricionista, ou preencha suas medidas.</p>
            <button type="button" onClick={() => irPara('avaliacoes')} className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 dark:text-foreground-950">Fazer minha primeira avaliação</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {kpis.map((x) => (
                <div key={x.k} className="rounded-xl bg-background-100/70 p-3">
                  <p className="text-[11px] text-foreground-500">{x.l}</p>
                  <p className="font-heading text-lg font-bold text-foreground-950">{fmt(x.v)} <span className="text-xs font-medium text-foreground-500">{x.u}</span></p>
                  {x.d ? (
                    <p className={`text-[11px] font-semibold ${x.bom == null ? 'text-foreground-500' : x.bom ? 'text-accent-600' : 'text-red-500'}`}>
                      {x.d > 0 ? '↑ +' : '↓ '}{fmt(x.d)} {x.u} <span className="font-normal text-foreground-400">desde {dataBr(ant!.data).slice(0, 5)}</span>
                    </p>
                  ) : <p className="text-[11px] text-foreground-400">&nbsp;</p>}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => navigate(`/evolution/relatorio/${ult.id}`)} className="flex-1 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-background-50 dark:text-foreground-950">
                <i className="ri-file-chart-line mr-1"></i>Ver relatório
              </button>
              <button type="button" onClick={() => irPara('graficos')} className="flex-1 rounded-lg border border-background-300 px-3 py-2 text-sm font-semibold text-foreground-800">
                <i className="ri-line-chart-line mr-1"></i>Gráficos
              </button>
            </div>
          </>
        )}
      </Card>

      {(avisos.length > 0 || recs.length > 0 || prevGordura || prevPeso) && (
        <Card padding="p-5">
          <h2 className="mb-3 font-heading text-base font-semibold text-foreground-950">Destaques</h2>
          <ul className="space-y-2 text-sm">
            {recs.map((r) => (
              <li key={r.key} className="flex gap-2 rounded-lg bg-secondary-50 px-3 py-2 text-secondary-900"><span>🏆</span><span>Recorde: <b>{r.label}</b> {fmt(r.valor)} {r.unidade}</span></li>
            ))}
            {avisos.map((a) => (
              <li key={a.texto} className={`flex gap-2 rounded-lg px-3 py-2 ${a.nivel === 'atencao' ? 'bg-red-50 text-red-700' : 'bg-accent-50 text-accent-800'}`}><span>{a.nivel === 'atencao' ? '⚠️' : '✅'}</span><span>{a.texto}</span></li>
            ))}
            {prevGordura?.semanas != null && prevGordura.dataMeta && (
              <li className="flex gap-2 rounded-lg bg-background-100 px-3 py-2 text-foreground-800"><span>🎯</span><span>No ritmo atual você chega a <b>{metaGordura}% de gordura</b> em cerca de {prevGordura.semanas} semanas ({dataBr(prevGordura.dataMeta)}).</span></li>
            )}
            {prevPeso?.semanas != null && prevPeso.dataMeta && (
              <li className="flex gap-2 rounded-lg bg-background-100 px-3 py-2 text-foreground-800"><span>🎯</span><span>Peso meta de <b>{metaPeso} kg</b> em cerca de {prevPeso.semanas} semanas ({dataBr(prevPeso.dataMeta)}).</span></li>
            )}
          </ul>
        </Card>
      )}

      <Card padding="p-5">
        <div className="flex items-center gap-3">
          <i className="ri-calendar-check-line text-2xl text-primary-500"></i>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground-950">Reavaliação todo mês</p>
            <p className="text-xs text-foreground-600">
              {diasDesde != null ? `Última há ${diasDesde} dia(s). ` : ''}Coloque um lembrete na agenda do celular para refazer fotos e medidas.
            </p>
          </div>
          <button type="button" onClick={lembrete} className="rounded-lg border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-800">Lembrar</button>
        </div>
        {diasDesde != null && diasDesde >= 30 && (
          <button type="button" onClick={() => irPara('fotos')} className="mt-3 w-full rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-background-50 dark:text-foreground-950">Está na hora: tirar as fotos de hoje</button>
        )}
      </Card>
    </div>
  );
}
