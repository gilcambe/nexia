import { useEffect, useState, type ChangeEvent } from 'react';
import Card from '@/components/base/Card';
import { compressImageToDataUrl, getUserDoc, setUserDoc } from '@/lib/userData';
import { OPCOES_META, progressoMetas, type MetasMedidas } from '@/lib/avaliacao/metas';
import type { ItemSerie } from '@/lib/avaliacao/serie';

const fmt = (n: number | null, c = 1) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: c }));
const lerNum = (s: string) => { const n = Number(s.replace(',', '.')); return s.trim() && Number.isFinite(n) && n > 0 ? n : null; };

// Metas guardadas no perfil do aluno (o perfil já aceita campos extras; nada de regra nova).
export function useMetas(uid: string | undefined) {
  const [metas, setMetas] = useState<MetasMedidas>({});
  const [fotoMeta, setFotoMeta] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    getUserDoc<{ metas_medidas?: MetasMedidas; meta_foto?: string | null }>(uid, 'profile', 'main')
      .then((p) => { setMetas(p?.metas_medidas ?? {}); setFotoMeta(p?.meta_foto ?? null); })
      .catch(() => undefined);
  }, [uid]);
  const salvar = async (m: MetasMedidas, foto: string | null) => {
    if (!uid) return;
    await setUserDoc(uid, 'profile', 'main', { metas_medidas: m, meta_foto: foto }, true);
    setMetas(m); setFotoMeta(foto);
  };
  return { metas, fotoMeta, salvar };
}

// Minhas metas: medida-alvo de cada parte do corpo, quanto falta e uma foto de referência do físico desejado.
export default function MetasCorpo({ serie, metas, fotoMeta, salvar }: { serie: ItemSerie[]; metas: MetasMedidas; fotoMeta: string | null; salvar: (m: MetasMedidas, foto: string | null) => Promise<void> }) {
  const [editar, setEditar] = useState(false);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [foto, setFoto] = useState<string | null>(fotoMeta);
  const [msg, setMsg] = useState('');
  const progresso = progressoMetas(serie, metas);
  const ultFrente = [...serie].reverse().find((s) => s.fotos.frente)?.fotos.frente ?? null;
  const ult = serie[serie.length - 1];

  const abrir = () => {
    setRascunho(Object.fromEntries(OPCOES_META.map((o) => [o.key, metas[o.key] != null ? String(metas[o.key]).replace('.', ',') : ''])));
    setFoto(fotoMeta); setEditar(true); setMsg('');
  };
  const escolherFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setFoto(await compressImageToDataUrl(f, 700, 150_000)); } catch (err) { setMsg((err as Error).message); }
  };
  const gravar = async () => {
    const m: MetasMedidas = {};
    for (const o of OPCOES_META) { const n = lerNum(rascunho[o.key] ?? ''); if (n != null) m[o.key] = n; }
    try { await salvar(m, foto); setEditar(false); setMsg('Metas salvas.'); } catch (e) { setMsg(`Não consegui salvar: ${(e as Error).message}`); }
  };

  return (
    <Card padding="p-5">
      <div className="mb-3 flex items-center gap-2">
        <i className="ri-focus-3-line text-lg text-primary-500"></i>
        <h2 className="flex-1 font-heading text-base font-semibold text-foreground-950">Minhas metas</h2>
        {!editar && <button type="button" onClick={abrir} className="rounded-lg border border-background-300 px-3 py-1.5 text-xs font-semibold text-foreground-700">{progresso.length || fotoMeta ? 'Editar' : 'Definir metas'}</button>}
      </div>

      {!editar && progresso.length === 0 && !fotoMeta && (
        <p className="text-sm text-foreground-600">Defina a medida que quer alcançar em cada parte (ex.: cintura 80 cm, braço 40 cm) e veja quanto falta. Dá para pôr a foto de um físico de referência.</p>
      )}
      {!editar && progresso.length > 0 && (
        <ul className="space-y-3" data-testid="metas-lista">
          {progresso.map((p) => (
            <li key={p.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground-800">{p.label}</span>
                <span className="text-xs text-foreground-600">
                  {fmt(p.atual)} → <b className="text-foreground-950">{fmt(p.meta)} {p.unidade}</b>
                  {p.chegou ? <span className="ml-1 font-semibold text-accent-600">chegou! 🎉</span> : p.falta != null ? <span className="ml-1">faltam {fmt(Math.abs(p.falta))} {p.unidade}</span> : null}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-background-200">
                <div className={`h-full rounded-full ${p.chegou ? 'bg-accent-500' : 'bg-primary-500'}`} style={{ width: `${Math.max(3, p.pct)}%` }}></div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!editar && fotoMeta && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <figure className="text-center">
            {ultFrente ? <img src={ultFrente} alt="Você hoje" className="aspect-[3/4] w-full rounded-lg object-cover object-top" /> : <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-background-100 text-xs text-foreground-500">Tire a foto de frente</div>}
            <figcaption className="mt-1 text-[11px] text-foreground-500">Você {ult ? 'agora' : ''}</figcaption>
          </figure>
          <figure className="text-center">
            <img src={fotoMeta} alt="Físico de referência" className="aspect-[3/4] w-full rounded-lg object-cover object-top" />
            <figcaption className="mt-1 text-[11px] text-foreground-500">Referência</figcaption>
          </figure>
        </div>
      )}

      {editar && (
        <div className="space-y-3">
          <p className="text-xs text-foreground-600">Deixe em branco o que não quiser acompanhar.</p>
          <div className="grid grid-cols-2 gap-2">
            {OPCOES_META.map((o) => {
              const atual = [...serie].reverse().find((s) => s.m[o.key] != null)?.m[o.key];
              return (
                <label key={o.key} className="block">
                  <span className="mb-0.5 block text-[11px] font-medium text-foreground-600">{o.label} ({o.unidade}){atual != null ? ` · hoje ${fmt(atual)}` : ''}</span>
                  <input inputMode="decimal" name={`meta_${o.key}`} value={rascunho[o.key] ?? ''} onChange={(e) => setRascunho((r) => ({ ...r, [o.key]: e.target.value }))} className="w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm" />
                </label>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            {foto && <img src={foto} alt="Referência escolhida" className="h-16 w-12 rounded object-cover" />}
            <label className="cursor-pointer rounded-lg border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700">
              {foto ? 'Trocar foto de referência' : 'Foto de um físico de referência'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void escolherFoto(e)} data-testid="meta-foto" />
            </label>
            {foto && <button type="button" onClick={() => setFoto(null)} className="text-xs text-red-600">Tirar</button>}
          </div>
          <p className="text-[11px] text-foreground-500">Use a foto só como inspiração: cada corpo tem a sua estrutura. Fica guardada só na sua conta.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void gravar()} className="flex-1 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-background-50 dark:text-foreground-950">Salvar metas</button>
            <button type="button" onClick={() => setEditar(false)} className="rounded-lg border border-background-300 px-3 py-2 text-sm font-semibold text-foreground-700">Cancelar</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-foreground-700">{msg}</p>}
      {!editar && progresso.length > 0 && <p className="mt-3 text-[11px] text-foreground-500">No corpo 3D, toque em “Como vou ficar na meta” para ver o contorno com essas medidas.</p>}
    </Card>
  );
}
