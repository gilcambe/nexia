import type { ReactNode } from 'react';

// Três telas do app desenhadas em HTML (leves, sem foto): treino do dia, dieta e evolução.
const LARANJA = '#ea580c';

function Celular({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <figure className="w-[200px] shrink-0 snap-center">
      <div className="rounded-[28px] border-[6px] border-stone-700 bg-stone-700 shadow-xl">
        <div className="h-[340px] overflow-hidden rounded-[22px] bg-white p-3 text-[#1c1917]">
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-stone-200" />
          {children}
        </div>
      </div>
      <figcaption className="mt-2 text-center text-sm font-semibold text-stone-200">{titulo}</figcaption>
    </figure>
  );
}

function Linha({ nome, info, feito }: { nome: string; info: string; feito?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-stone-100 px-2.5 py-2">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] text-white ${feito ? '' : 'bg-stone-300'}`}
        style={feito ? { background: LARANJA } : undefined}
      >
        {feito ? '✓' : ''}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold">{nome}</p>
        <p className="truncate text-[10px] text-stone-500">{info}</p>
      </div>
    </div>
  );
}

export default function Telas() {
  const pesos = [72, 71.4, 70.8, 70.1, 69.6, 69];
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      <Celular titulo="Treino do dia pronto">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Hoje</p>
        <p className="text-sm font-bold">Peito e tríceps</p>
        <p className="mb-2 text-[10px] text-stone-500">45 min · 6 exercícios</p>
        <div className="space-y-1.5">
          <Linha nome="Supino reto" info="4 × 10 · 40 kg" feito />
          <Linha nome="Supino inclinado" info="3 × 12 · 16 kg" feito />
          <Linha nome="Crucifixo" info="3 × 12 · 10 kg" />
          <Linha nome="Tríceps corda" info="3 × 15 · 20 kg" />
        </div>
        <div className="mt-3 rounded-xl py-2 text-center text-[11px] font-bold text-white" style={{ background: LARANJA }}>
          Continuar treino
        </div>
      </Celular>
      <Celular titulo="Dieta e água">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Nutrição</p>
        <p className="text-sm font-bold">1.420 de 2.100 kcal</p>
        <div className="mt-1.5 h-2 rounded-full bg-stone-200">
          <div className="h-2 w-2/3 rounded-full" style={{ background: LARANJA }} />
        </div>
        <div className="mt-3 space-y-1.5">
          <Linha nome="Café da manhã" info="Ovos, pão integral, café" feito />
          <Linha nome="Almoço" info="Arroz, feijão, frango, salada" feito />
          <Linha nome="Lanche" info="Iogurte e banana" />
        </div>
        <p className="mt-3 text-[11px] font-semibold">Água: 1,5 de 2,5 L</p>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <span key={i} className={`h-4 flex-1 rounded ${i <= 6 ? 'bg-sky-400' : 'bg-stone-200'}`} />
          ))}
        </div>
      </Celular>
      <Celular titulo="Evolução com medidas">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Evolução</p>
        <p className="text-sm font-bold">−3 kg em 6 semanas</p>
        <div className="mt-3 flex h-28 items-end gap-2 rounded-xl bg-stone-100 p-2">
          {pesos.map((p, i) => (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${(p - 66) * 15}%`, background: i === pesos.length - 1 ? LARANJA : '#fdba74' }}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-center">
          {[['Cintura', '−4 cm'], ['Gordura', '−2,1%'], ['Braço', '+1 cm'], ['Peso', '69 kg']].map(([a, b]) => (
            <div key={a} className="rounded-lg bg-stone-100 py-1.5">
              <p className="text-[10px] text-stone-500">{a}</p>
              <p className="text-[12px] font-bold">{b}</p>
            </div>
          ))}
        </div>
      </Celular>
    </div>
  );
}
