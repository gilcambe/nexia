import Icone from "./Icone";

// Número grande colorido (como os cartões do Painel Executivo). Sem dado real, mostra "—".
const FUNDO: Record<string, string> = { az: "linear-gradient(135deg,#3b82f6,#1d4ed8)", vd: "linear-gradient(135deg,#22c55e,#15803d)", rx: "linear-gradient(135deg,#8b5cf6,#6d28d9)", lj: "linear-gradient(135deg,#f59e0b,#c2410c)", vm: "linear-gradient(135deg,#ef4444,#b91c1c)", ci: "linear-gradient(135deg,#06b6d4,#0e7490)" };
export default function Kpi({ cor, icone, valor, rotulo, sub, ativo, onClick, testid }: { cor: "az" | "vd" | "rx" | "lj" | "vm" | "ci"; icone: string; valor: string | number | null | undefined; rotulo: string; sub?: string; ativo?: boolean; onClick?: () => void; testid?: string }) {
  return (
    <button type="button" className={"kx-kpi " + cor + (ativo ? " ativo" : "")} onClick={onClick} data-testid={testid} aria-pressed={ativo} style={onClick ? undefined : { cursor: "default" }}>
      <span className="ico" style={{ background: FUNDO[cor] }}><Icone nome={icone} tam={24} cor="#fff" /></span>
      <span style={{ minWidth: 0 }}><b>{valor === null || valor === undefined ? "—" : valor}</b><span>{rotulo}</span>{sub && <small style={{ color: "#c7d2fe" }}>{sub}</small>}</span>
    </button>
  );
}
