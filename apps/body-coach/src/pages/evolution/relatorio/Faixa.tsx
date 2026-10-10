// Barra com faixas (como nos laudos de balança) e um marcador no valor da pessoa.
const CORES = ['#74c0fc', '#69db7c', '#ffd43b', '#ff8787', '#e599f7'];

export default function Faixa({
  titulo, valor, unidade, faixas, classe,
}: {
  titulo: string;
  valor: number;
  unidade: string;
  faixas: [number, number, string][];
  classe?: string | null;
}) {
  const min = faixas[0][0];
  const max = faixas[faixas.length - 1][1];
  const pos = Math.min(100, Math.max(0, ((valor - min) / (max - min)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold">{titulo}</span>
        <span>
          <b className="text-sm">{valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b> {unidade}
          {classe && <span className="ml-1 text-[#666]">· {classe}</span>}
        </span>
      </div>
      <div className="relative">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {faixas.map(([a, b, nome], i) => (
            <div key={nome} style={{ width: `${((b - a) / (max - min)) * 100}%`, background: CORES[i % CORES.length] }} />
          ))}
        </div>
        <div className="absolute -top-1 h-4.5 w-1 -translate-x-1/2 rounded bg-[#1f2328]" style={{ left: `${pos}%`, height: 18 }} />
        <div className="mt-0.5 flex text-[9px] text-[#868e96]">
          {faixas.map(([a, b, nome]) => (
            <span key={nome} className="truncate text-center" style={{ width: `${((b - a) / (max - min)) * 100}%` }}>{nome}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
