import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import { alertas, dataBr, prever, recordes, simetria } from '@/lib/avaliacao/calculos';
import { MAX_FOTO_BYTES, salvarAvaliacao, type PerfilAvaliacao } from '@/lib/avaliacao/dados';
import { hojeIso } from '@/lib/avaliacao/importar';
import { compressImageToDataUrl, setUserDoc } from '@/lib/userData';
import { useAuth } from '@/components/feature/AuthContext';
import type { Avatar } from '@/lib/avaliacao/avatar';
import type { ItemSerie } from '@/lib/avaliacao/serie';
import { compartilharArquivo } from '@/lib/avaliacao/imagens';
import { gerarIcsReavaliacao } from '@/lib/lembretes';
import PainelCorpo from './corpo3d/PainelCorpo';
import BodyTwin, { type Angle, type RegionKey } from './components/BodyTwin';
import CoachEvolucao from './CoachEvolucao';
import MetasCorpo, { useMetas } from './MetasCorpo';

const fmt = (n: number | undefined | null, c = 1) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: c }));

export default function ResumoEvolucao({
  uid, serie, perfil, volume, metaGordura, metaPeso, altura, irPara, onMudou,
}: {
  altura: number;
  uid: string | undefined;
  serie: ItemSerie[];
  perfil: PerfilAvaliacao;
  volume: Record<string, number>;
  metaGordura: number | null;
  metaPeso: number | null;
  irPara: (aba: 'avaliacoes' | 'fotos' | 'graficos') => void;
  onMudou?: () => void;
}) {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { metas, fotoMeta, salvar } = useMetas(uid);
  // Registros só com fotos não contam como avaliação (senão a última aparece toda em branco).
  const comMedidas = serie.filter((s) => Object.keys(s.av.valores).some((k) => k !== 'altura' && k !== 'idade'));
  const ult = comMedidas[comMedidas.length - 1] ?? null;
  const medido = [...serie].reverse().find((s) => s.m.peso != null && s.m.gordura != null) ?? null;
  const comFotos = [...serie].reverse().find((s) => s.fotos.frente || s.fotos.costas) ?? null;
  const ant = comMedidas.length > 1 ? comMedidas[comMedidas.length - 2] : null;
  const pts = serie.map((s) => ({ data: s.data, m: s.m }));
  const avisos = alertas(pts);
  const recs = recordes(pts).filter((r) => r.novo);
  const pontosGordura = serie.filter((s) => s.m.gordura != null).map((s) => ({ data: s.data, valor: s.m.gordura }));
  const prevGordura = prever(pontosGordura.slice(-6), metaGordura);
  const pontosPeso = serie.filter((s) => s.m.peso != null).map((s) => ({ data: s.data, valor: s.m.peso }));
  const prevPeso = prever(pontosPeso.slice(-6), metaPeso);
  const lados = ult ? simetria(ult.av.valores, ult.av.segmental).filter((l) => l.atencao) : [];
  const diasDesde = ult ? Math.floor((Date.now() - new Date(`${ult.data}T12:00:00`).getTime()) / 86400000) : null;

  const kpis = ([
    ['peso', 'Peso', 'kg', 0],
    ['gordura', 'Gordura', '%', -1],
    ['mlg', 'Massa magra', 'kg', 1],
    ['cintura', 'Cintura', 'cm', -1],
  ] as const).map(([k, l, u, sentido]) => {
    // Cada número vem da avaliação mais recente que tem esse dado (uma medida solta não apaga o resto).
    const com = comMedidas.filter((s) => s.m[k] != null);
    const v = com[com.length - 1]?.m[k];
    const a = com.length > 1 ? com[com.length - 2].m[k] : undefined;
    const desde = com.length > 1 ? com[com.length - 2].data : null;
    const d = v != null && a != null ? Math.round((v - a) * 10) / 10 : null;
    return { k, l, u, v, d, desde, bom: d && sentido ? Math.sign(d) === sentido : null };
  });

  // Medida mais recente de cada parte (para os pontos do Body Twin), com a variação desde a anterior.
  const medidaDe = (...chaves: string[]) => {
    const com = serie.filter((s) => chaves.some((c) => s.av.valores[c] != null));
    const v = (s: ItemSerie) => chaves.map((c) => s.av.valores[c]).find((x) => x != null)!;
    const u = com[com.length - 1];
    if (!u) return undefined;
    const a = com.length > 1 ? v(com[com.length - 2]) : null;
    const d = a != null ? Math.round((v(u) - a) * 10) / 10 : 0;
    return `${fmt(v(u))} cm${d ? ` (${d > 0 ? '+' : ''}${fmt(d)})` : ''} em ${dataBr(u.data).slice(0, 5)}`;
  };
  const CAMPO_REGIAO: Record<RegionKey, string[]> = {
    deltoides: ['ombro'], pecs: ['torax'], abdomen: ['cintura', 'abdomen'], gluteos: ['quadril'], quadriceps: ['coxa_medial', 'coxa_proximal'], panturrilhas: ['panturrilha'],
  };
  const ultimaMedida = (ks: string[]) => [...serie].reverse().map((s) => ks.map((k) => s.av.valores[k]).find((x) => x != null)).find((x) => x != null);
  const salvarMedida = async (campo: string, cm: number) => {
    if (!uid) throw new Error('entre na sua conta');
    await salvarAvaliacao(uid, { data: hojeIso(), valores: { [campo]: cm }, fonte: 'Manual' }, { existentes: serie.map((s) => s.registro) });
    onMudou?.();
  };
  // Corpo realista escolhido pelo aluno (sexo, pele, biotipo) fica no perfil.
  const mudarAvatar = async (a: Avatar) => {
    if (!uid) return;
    await setUserDoc(uid, 'profile', 'main', { avatar: a }, true);
    refreshProfile();
  };
  const medidaTwin = {
    atual: Object.fromEntries((Object.keys(CAMPO_REGIAO) as RegionKey[]).map((r) => [r, ultimaMedida(CAMPO_REGIAO[r])])) as Partial<Record<RegionKey, number>>,
    salvar: (r: RegionKey, cm: number) => salvarMedida(CAMPO_REGIAO[r][0], cm),
  };
  const medidasRegiao: Partial<Record<RegionKey, string>> = {
    deltoides: medidaDe('ombro'), pecs: medidaDe('torax'), abdomen: medidaDe('cintura', 'abdomen'),
    gluteos: medidaDe('quadril'), quadriceps: medidaDe('coxa_medial', 'coxa_proximal'), panturrilhas: medidaDe('panturrilha'),
  };

  const POSE_DO_ANGULO: Record<Angle, 'frente' | 'direita' | 'costas'> = { frente: 'frente', lado: 'direita', costas: 'costas' };
  const salvarFoto = async (a: Angle, foto: Blob) => {
    if (!uid) throw new Error('entre na sua conta');
    const url = await compressImageToDataUrl(foto, 900, MAX_FOTO_BYTES);
    await salvarAvaliacao(uid, { data: hojeIso(), valores: {}, fonte: 'Fotos' }, { fotos: { [POSE_DO_ANGULO[a]]: url }, existentes: serie.map((s) => s.registro) });
    onMudou?.();
  };

  const lembrete = () => void compartilharArquivo(new Blob([gerarIcsReavaliacao()], { type: 'text/calendar;charset=utf-8' }), 'reavaliacao-mensal.ics');

  return (
    <div className="space-y-4">
      {/* Body Twin (corpo realista): mantido como estava; usa a medição real mais recente (peso + % de gordura). */}
      <Card padding="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ri-body-scan-line text-lg text-primary-500"></i>
            <h2 className="font-heading text-base font-semibold text-foreground-950">Body Twin</h2>
          </div>
          <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-700">IA + Foto</span>
        </div>
        {!medido && (
          <p className="mb-3 rounded-lg bg-secondary-50 px-3 py-2 text-xs text-secondary-800">
            Corpo de exemplo. Registre peso e gordura corporal para ele virar o seu.
          </p>
        )}
        <BodyTwin
          selected={null}
          onSelect={() => {}}
          currentWeight={medido?.m.peso ?? 75}
          currentBodyFat={medido?.m.gordura ?? 16}
          currentHeight={medido?.av.valores.altura ?? altura}
          goalBodyFat={metaGordura ?? 15}
          goalWeight={metaPeso}
          onSalvarFoto={salvarFoto}
          medidasRegiao={medidasRegiao}
          onSalvarMedida={medidaTwin}
          fotosReais={comFotos ? { frente: comFotos.fotos.frente, lado: comFotos.fotos.direita ?? comFotos.fotos.esquerda, costas: comFotos.fotos.costas } : undefined}
        />
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
                      {x.d > 0 ? '↑ +' : '↓ '}{fmt(x.d)} {x.u} <span className="font-normal text-foreground-400">desde {dataBr(x.desde!).slice(0, 5)}</span>
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

      <Card padding="p-4">
        <PainelCorpo serie={serie} perfil={perfil} volume={volume} metas={metas} onSalvarMedida={salvarMedida} avatar={profile?.avatar} onMudarAvatar={mudarAvatar} />
      </Card>

      <MetasCorpo key={fotoMeta ?? 'sem'} serie={serie} metas={metas} fotoMeta={fotoMeta} salvar={salvar} />

      <CoachEvolucao />

      {(avisos.length > 0 || recs.length > 0 || prevGordura || prevPeso || lados.length > 0) && (
        <Card padding="p-5">
          <h2 className="mb-3 font-heading text-base font-semibold text-foreground-950">Destaques</h2>
          <ul className="space-y-2 text-sm">
            {recs.map((r) => (
              <li key={r.key} className="flex gap-2 rounded-lg bg-secondary-50 px-3 py-2 text-secondary-900"><span>🏆</span><span>Recorde: <b>{r.label}</b> {fmt(r.valor)} {r.unidade}</span></li>
            ))}
            {avisos.map((a) => (
              <li key={a.texto} className={`flex gap-2 rounded-lg px-3 py-2 ${a.nivel === 'atencao' ? 'bg-red-50 text-red-700' : 'bg-accent-50 text-accent-800'}`}><span>{a.nivel === 'atencao' ? '⚠️' : '✅'}</span><span>{a.texto}</span></li>
            ))}
            {lados.map((l) => (
              <li key={l.label} className="flex gap-2 rounded-lg bg-secondary-50 px-3 py-2 text-secondary-900"><span>↔️</span><span>{l.label}: lado {l.menor} {fmt(l.diferenca)} {l.unidade} menor. Vale um pouco mais de volume desse lado.</span></li>
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
