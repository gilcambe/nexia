import { useEffect, useMemo, useRef, useState } from 'react';
import { ALTURA_NA_FOTO, CAMPO_DA_PARTE, NOME_DA_PARTE, escalaNaAltura, formaDoCorpo, type ParteCorpo } from '@/lib/avaliacao/corpoRealista';
import { BIOTIPOS, PELES, chaveDisponivel, lerAvatar, type Avatar, type VistaCorpo } from '@/lib/avaliacao/avatar';
import ANCORAS from '@/lib/avaliacao/corposAncoras.json';
import type { Sexo } from '@/lib/avaliacao/calculos';
import { pickBodyImage } from '../components/bodyImages';
import EditarMedida from '../components/EditarMedida';

// Onde está o corpo em cada foto gerada (centro, meia largura e altura de cada parte), medido com detecção de pose.
interface Ancora { cx: number; b: number; y: Record<ParteCorpo, number> }
const ANC = ANCORAS as Record<string, Ancora>;
const BASE = import.meta.env.BASE_URL;
const ANTIGA: Record<Exclude<VistaCorpo, 'frente'>, string> = {
  lado: `${BASE}imagens/bt-real-lado.jpg`,
  costas: `${BASE}imagens/bt-real-costas.jpg`,
};
const PADRAO: Ancora = { cx: 0.5, b: 0.28, y: ALTURA_NA_FOTO };

// O Body Twin realista moldado com as medidas do aluno (fita métrica + peso e altura).
// O aluno escolhe o corpo base: homem ou mulher, tom de pele e biotipo.
export default function CorpoRealista({ valores, sexo, altura, gordura, onSalvarMedida, legenda, avatar: avatarSalvo, onMudarAvatar }: {
  valores: Record<string, number>;
  sexo: Sexo | null | undefined;
  altura: number | null;
  gordura: number | null;
  onSalvarMedida?: (campo: string, cm: number) => Promise<void>;
  legenda?: string;
  avatar?: unknown;
  onMudarAvatar?: (a: Avatar) => Promise<void>;
}) {
  const [vista, setVista] = useState<VistaCorpo>('frente');
  const [parte, setParte] = useState<ParteCorpo | null>(null);
  const [editando, setEditando] = useState(false);
  const [avatarLocal, setAvatarLocal] = useState<Avatar | null>(null);
  const avatar = avatarLocal ?? lerAvatar(avatarSalvo, sexo);
  const canvas = useRef<HTMLCanvasElement>(null);
  const forma = useMemo(() => formaDoCorpo(valores, sexo, altura), [valores, sexo, altura]);
  const chave = chaveDisponivel(avatar, gordura, vista, (k) => k in ANC);
  const anc = chave ? ANC[chave] : undefined;
  const src = anc ? `${BASE}imagens/corpos/${chave}.jpg` : vista === 'frente' ? pickBodyImage(gordura ?? 16) : ANTIGA[vista];
  const ancora = anc ?? PADRAO;

  useEffect(() => {
    let vivo = true;
    const img = new Image();
    img.onload = () => {
      const c = canvas.current;
      if (!vivo || !c) return;
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const cx = W * ancora.cx;
      const b = Math.min(W * ancora.b, cx - 2, W - cx - 2);
      for (let y = 0; y < H; y += 1) {
        const s = escalaNaAltura(forma, y / H, ancora.y);
        const bs = Math.min(cx - 1, W - cx - 1, b * s);
        ctx.drawImage(img, 0, y, cx - b, 1, 0, y, cx - bs, 1);
        ctx.drawImage(img, cx - b, y, 2 * b, 1, cx - bs, y, 2 * bs, 1);
        ctx.drawImage(img, cx + b, y, W - cx - b, 1, cx + bs, y, W - cx - bs, 1);
      }
    };
    img.src = src;
    return () => { vivo = false; };
  }, [src, forma, ancora]);

  const medidas = (Object.keys(ALTURA_NA_FOTO) as ParteCorpo[]).filter((p) => forma.partes[p].medida != null).length;

  const mudar = (novo: Partial<Avatar>) => {
    const a = { ...avatar, ...novo };
    setAvatarLocal(a);
    if (onMudarAvatar) void onMudarAvatar(a);
  };

  return (
    <div>
      <div className="relative mx-auto aspect-[592/800] w-full max-w-[290px] overflow-hidden rounded-2xl bg-[#d9d6d2]" data-testid="corpo-realista" data-corpo={chave ?? 'padrao'}>
        <canvas ref={canvas} className="h-full w-full" aria-label="Seu corpo realista com as suas medidas" role="img" />
        {vista === 'frente' && (Object.keys(ALTURA_NA_FOTO) as ParteCorpo[]).map((p) => {
          const ativo = parte === p;
          const m = forma.partes[p].medida;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setParte(ativo ? null : p)}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${ancora.cx * 100}%`, top: `${ancora.y[p] * 100}%` }}
              aria-label={`${onSalvarMedida ? 'Medir' : 'Ver medida'}: ${NOME_DA_PARTE[p]}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${ativo ? 'border-primary-500 bg-primary-500 text-white' : m != null ? 'border-white bg-black/40 text-white' : 'border-white bg-primary-500/80 text-white'}`}>
                <i className={m != null ? 'ri-ruler-line text-[11px]' : 'ri-add-line text-[12px]'}></i>
              </span>
              <span className={`pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold ${ativo ? 'bg-primary-500 text-white' : 'bg-black/60 text-white'}`}>
                {NOME_DA_PARTE[p]}{m != null ? ` · ${m.toLocaleString('pt-BR')} cm` : ''}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {(['frente', 'lado', 'costas'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setVista(v)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${vista === v ? 'bg-foreground-900 text-background-50' : 'bg-background-100 text-foreground-700'}`}>
            {v === 'frente' ? 'Frente' : v === 'lado' ? 'Lado' : 'Costas'}
          </button>
        ))}
        {onMudarAvatar && (
          <button type="button" onClick={() => setEditando((e) => !e)} aria-expanded={editando} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${editando ? 'bg-primary-500 text-white' : 'bg-primary-500/10 text-primary-600'}`}>
            <i className="ri-user-settings-line mr-1"></i>Personalizar corpo
          </button>
        )}
      </div>
      {editando && onMudarAvatar && (
        <div className="mt-2 space-y-2.5 rounded-xl border border-background-200 bg-background-50 p-3" data-testid="personalizar-corpo">
          <div>
            <p className="mb-1 text-[11px] font-semibold text-foreground-600">Corpo</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-background-100 p-1">
              {([['m', 'Homem'], ['f', 'Mulher']] as const).map(([id, nome]) => (
                <button key={id} type="button" aria-pressed={avatar.sexo === id} onClick={() => mudar({ sexo: id })} className={`rounded-md py-1.5 text-xs font-semibold ${avatar.sexo === id ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{nome}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold text-foreground-600">Tom de pele</p>
            <div className="flex gap-3">
              {PELES.map((p) => (
                <button key={p.id} type="button" aria-pressed={avatar.pele === p.id} aria-label={`Pele ${p.nome}`} onClick={() => mudar({ pele: p.id })} className="flex flex-col items-center gap-0.5">
                  <span className={`h-8 w-8 rounded-full border-2 ${avatar.pele === p.id ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-white shadow'}`} style={{ background: p.cor }}></span>
                  <span className="text-[10px] text-foreground-600">{p.nome}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold text-foreground-600">Biotipo</p>
            <div className="flex flex-wrap gap-1.5">
              {BIOTIPOS.map((b) => (
                <button key={b.id} type="button" aria-pressed={avatar.biotipo === b.id} onClick={() => mudar({ biotipo: b.id })} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${avatar.biotipo === b.id ? 'bg-foreground-900 text-background-50' : 'bg-background-100 text-foreground-700'}`}>{b.nome}</button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-foreground-500">Depois de escolher, o corpo continua sendo moldado com as suas medidas. "Pela gordura" troca sozinho conforme o seu % de gordura muda.</p>
        </div>
      )}
      {parte && (
        <div className="mt-2">
          {onSalvarMedida ? (
            <EditarMedida
              key={parte}
              nome={NOME_DA_PARTE[parte]}
              atual={forma.partes[parte].medida}
              onFechar={() => setParte(null)}
              onSalvar={(cm) => onSalvarMedida(CAMPO_DA_PARTE[parte][0], cm)}
            />
          ) : (
            <p className="text-center text-xs text-foreground-600">{NOME_DA_PARTE[parte]}: {forma.partes[parte].medida != null ? `${forma.partes[parte].medida!.toLocaleString('pt-BR')} cm` : 'sem medida'}</p>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-foreground-500">
        {legenda ?? `Corpo realista moldado com o seu peso, altura e ${medidas} de 6 medidas da fita.`} {onSalvarMedida && medidas < 6 ? 'Toque no + para colocar as que faltam.' : ''}
      </p>
    </div>
  );
}
