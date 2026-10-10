import { useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { dataBr } from '@/lib/avaliacao/calculos';
import { POSES, type Pose } from '@/lib/avaliacao/dados';
import { analisarPostura, P, resumoPostura, type Achado, type Ponto } from '@/lib/avaliacao/postura';
import type { ItemSerie } from '@/lib/avaliacao/serie';

interface Resultado { pose: Pose; src: string; pontos: Ponto[] | null; largura: number; altura: number; achados: Achado[] }

// Linhas desenhadas sobre a foto: ombros, quadril e (de lado) orelha-ombro-quadril.
function Sobreposicao({ r }: { r: Resultado }) {
  if (!r.pontos) return null;
  const p = (i: number) => r.pontos![i];
  const cor = (id: Achado['id']) => (r.achados.find((a) => a.id === id)?.ok === false ? '#fd7e14' : '#40c057');
  const linha = (a: number, b: number, c: string, k: string) => (
    <line key={k} x1={p(a).x * 100} y1={p(a).y * 100} x2={p(b).x * 100} y2={p(b).y * 100} stroke={c} strokeWidth={0.9} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
  );
  const lado = r.pose === 'direita' || r.pose === 'esquerda';
  const e = (p(P.ombroE)?.visibility ?? 0) >= (p(P.ombroD)?.visibility ?? 0);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      {!lado && linha(P.ombroE, P.ombroD, cor('ombros'), 'o')}
      {!lado && linha(P.quadrilE, P.quadrilD, cor('quadril'), 'q')}
      {r.pose === 'frente' && linha(P.orelhaE, P.orelhaD, cor('cabeca_inclinada'), 'c')}
      {lado && linha(e ? P.orelhaE : P.orelhaD, e ? P.ombroE : P.ombroD, cor('cabeca_frente'), 'co')}
      {lado && linha(e ? P.ombroE : P.ombroD, e ? P.quadrilE : P.quadrilD, cor('ombros_frente'), 'oq')}
      {lado && <line x1={p(e ? P.tornozeloE : P.tornozeloD).x * 100} y1={0} x2={p(e ? P.tornozeloE : P.tornozeloD).x * 100} y2={100} stroke="#fff" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.5 }} opacity={0.8} />}
    </svg>
  );
}

// Checagem de postura pelas fotos (roda no celular, a foto não sai do aparelho).
export default function Postura({ serie }: { serie: ItemSerie[] }) {
  const comFoto = useMemo(() => serie.filter((s) => POSES.some((p) => s.fotos[p.id])), [serie]);
  const [id, setId] = useState<number | null>(null);
  const sessao = comFoto.find((s) => s.id === id) ?? comFoto[comFoto.length - 1];
  const [res, setRes] = useState<Resultado[] | null>(null);
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');

  if (!comFoto.length) return null;

  const checar = async () => {
    setErro(''); setRes(null);
    try {
      setStatus('Carregando o detector de postura (só na primeira vez)...');
      const { pontosDaFoto } = await import('@/lib/avaliacao/posturaDetector');
      const out: Resultado[] = [];
      for (const p of POSES) {
        const src = sessao.fotos[p.id];
        if (!src) continue;
        setStatus(`Analisando a foto ${p.label.toLowerCase()}...`);
        const r = await pontosDaFoto(src);
        out.push({ pose: p.id, src, ...r, achados: r.pontos ? analisarPostura(p.id, r.pontos, r.largura, r.altura) : [] });
      }
      setRes(out);
    } catch (e) {
      setErro(`Não consegui analisar agora (${e instanceof Error ? e.message : 'erro'}). Confira a internet e tente de novo.`);
    } finally {
      setStatus('');
    }
  };

  const resumo = res ? resumoPostura(res.flatMap((r) => r.achados)) : [];
  const semCorpo = res?.filter((r) => !r.pontos).map((r) => POSES.find((p) => p.id === r.pose)!.label.toLowerCase()) ?? [];

  return (
    <Card padding="p-5">
      <h2 className="mb-1 font-heading text-base font-semibold text-foreground-950"><i className="ri-walk-line mr-1 text-primary-500"></i>Checar postura pelas fotos</h2>
      <p className="mb-3 text-sm text-foreground-600">Mede ombros, quadril e cabeça nas fotos. Roda no seu celular: a foto não é enviada para lugar nenhum.</p>
      <div className="flex gap-2">
        <select value={sessao.id} onChange={(e) => { setId(Number(e.target.value)); setRes(null); }} aria-label="Fotos de qual dia" className="min-w-0 flex-1 rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm">
          {[...comFoto].reverse().map((s) => <option key={s.id} value={s.id}>{dataBr(s.data)}</option>)}
        </select>
        <button type="button" disabled={!!status} onClick={() => void checar()} className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">
          {status ? <i className="ri-loader-4-line animate-spin"></i> : 'Checar postura'}
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-foreground-500">{status}</p>}
      {erro && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {res && (
        <>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {res.map((r) => (
              <figure key={r.pose} className="text-center">
                <div className="relative overflow-hidden rounded-lg bg-foreground-800" style={{ aspectRatio: `${r.largura || 3} / ${r.altura || 4}` }}>
                  <img src={r.src} alt={`Postura ${r.pose}`} className="h-full w-full object-fill" />
                  <Sobreposicao r={r} />
                </div>
                <figcaption className="mt-0.5 text-[10px] text-foreground-500">{POSES.find((p) => p.id === r.pose)!.label}</figcaption>
              </figure>
            ))}
          </div>
          <ul className="mt-3 space-y-2" data-testid="postura-resultado">
            {resumo.map((a) => (
              <li key={a.id} className={`rounded-xl px-3 py-2 text-sm ${a.ok ? 'bg-accent-50 text-accent-900' : 'bg-secondary-50 text-secondary-900'}`}>
                <p className="font-semibold">{a.ok ? '✅' : '⚠️'} {a.titulo}</p>
                <p className="text-xs opacity-80">{a.detalhe}</p>
                {a.dica && <p className="mt-1 text-xs">💡 {a.dica}</p>}
              </li>
            ))}
            {resumo.length === 0 && <li className="text-sm text-foreground-600">Não achei o corpo inteiro nas fotos. Tire de corpo inteiro, a uns 2 metros, com a câmera na altura do umbigo.</li>}
          </ul>
          {semCorpo.length > 0 && resumo.length > 0 && <p className="mt-2 text-xs text-foreground-500">Não achei o corpo na foto: {semCorpo.join(', ')}.</p>}
          <p className="mt-2 text-[11px] text-foreground-500">É uma checagem simples, não um diagnóstico. A foto precisa estar reta e de corpo inteiro. Na dúvida, mostre ao seu coach ou a um fisioterapeuta.</p>
        </>
      )}
    </Card>
  );
}
