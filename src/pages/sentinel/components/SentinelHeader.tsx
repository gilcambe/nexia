import { useNavigate } from "react-router-dom";

interface Props { scanning: boolean; onScan: () => void; lastScan: string; }

export default function SentinelHeader({ scanning, onScan, lastScan }: Props) {
  const navigate = useNavigate();
  return (
    <header className="border-b border-nexia-border bg-[#0a0a0f]">
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
            <div className="w-7 h-7 flex items-center justify-center rounded-md bg-nexia-cyan/20"><i className="ri-arrow-left-line text-nexia-cyan text-sm" /></div>
            Voltar ao site
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${scanning ? "bg-amber-400 animate-pulse" : "bg-nexia-cyan animate-pulse"}`} />
            <span className="text-xs text-nexia-muted">{scanning ? "Scanning..." : `Último scan: ${lastScan}`}</span>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/10 border border-nexia-cyan/20"><i className="ri-shield-keyhole-line text-nexia-cyan text-xl" /></div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Sentinel QA</h1>
              <p className="text-sm text-nexia-muted">Monitoramento contínuo · Auto-heal · Auditoria</p>
            </div>
          </div>
          <button onClick={onScan} disabled={scanning} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-all disabled:opacity-60 cursor-pointer whitespace-nowrap">
            {scanning ? <><i className="ri-loader-4-line animate-spin" /> Scanning...</> : <><i className="ri-scan-line" /> Novo Scan</>}
          </button>
        </div>
      </div>
    </header>
  );
}
