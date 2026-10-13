// Gráfico de barras simples (sem biblioteca): altura proporcional ao maior valor.
export default function Barras({ titulo, itens, formato = (v) => String(v) }: { titulo: string; itens: { rotulo: string; valor: number }[]; formato?: (v: number) => string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-foreground-700">{titulo}</p>
      <div className="flex h-32 items-end gap-0.5">
        {itens.map((i) => (
          <div key={i.rotulo} className="flex h-full flex-1 flex-col justify-end" title={`${i.rotulo}: ${formato(i.valor)}`}>
            <div className="rounded-t bg-primary-500" style={{ height: `${(i.valor / max) * 100}%`, minHeight: i.valor ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-foreground-500">
        <span>{itens[0]?.rotulo}</span><span>maior: {formato(max === 1 && !itens.some((i) => i.valor) ? 0 : max)}</span><span>{itens[itens.length - 1]?.rotulo}</span>
      </div>
    </div>
  );
}
