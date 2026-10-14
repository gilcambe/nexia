import type { ReactNode } from "react";

// Peças simples da Central: cartão, sinal colorido, botão e número grande.

export type Cor = "verde" | "amarelo" | "vermelho" | "cinza";
const CORES: Record<Cor, string> = { verde: "bg-emerald-400", amarelo: "bg-amber-400", vermelho: "bg-red-500", cinza: "bg-gray-500" };

export function Sinal({ cor }: { cor: Cor }) {
  return <span className={`inline-block w-3 h-3 rounded-full shrink-0 ${CORES[cor]}`} aria-label={cor} />;
}

export function Cartao({ titulo, children, acao }: { titulo?: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-nexia-border bg-nexia-surface p-4 space-y-3">
      {(titulo || acao) && (
        <div className="flex items-center justify-between gap-2">
          {titulo && <h2 className="font-semibold text-base">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

export function Numero({ valor, rotulo, destaque }: { valor: ReactNode; rotulo: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl bg-nexia-surface2 p-3">
      <div className={`font-bold ${destaque ? "text-2xl text-nexia-cyan" : "text-xl"}`}>{valor}</div>
      <div className="text-xs text-nexia-muted mt-1">{rotulo}</div>
    </div>
  );
}

export function Botao({ children, onClick, href, tipo = "normal", disabled, testid }: {
  children: ReactNode; onClick?: () => void; href?: string; tipo?: "normal" | "forte"; disabled?: boolean; testid?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm min-h-[40px] cursor-pointer disabled:opacity-50 ${
    tipo === "forte" ? "bg-nexia-cyan text-black font-semibold" : "border border-nexia-border bg-nexia-surface2 text-white"}`;
  if (href) return <a className={cls} href={href} target="_blank" rel="noopener noreferrer" data-testid={testid}>{children}</a>;
  return <button className={cls} onClick={onClick} disabled={disabled} data-testid={testid}>{children}</button>;
}

export function Carregando({ erro }: { erro?: string }) {
  if (erro) return <p className="text-sm text-red-400" role="alert">{erro}</p>;
  return <div className="h-16 rounded-xl bg-nexia-surface2 animate-pulse" />;
}

export function Barras({ itens, formato }: { itens: { rotulo: string; valor: number }[]; formato?: (v: number) => string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="flex items-end gap-1 h-28" role="img" aria-label="gráfico">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${i.rotulo}: ${formato ? formato(i.valor) : i.valor}`}>
          <div className="w-full rounded-t bg-nexia-cyan/80" style={{ height: `${Math.max(2, (i.valor / max) * 100)}%` }} />
          <div className="text-[10px] text-nexia-muted mt-1 truncate w-full text-center">{i.rotulo}</div>
        </div>
      ))}
    </div>
  );
}
