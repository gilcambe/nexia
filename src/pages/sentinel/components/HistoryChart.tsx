import { scanHistory } from "@/data/qaData";

export function HistoryChart() {
  const max = Math.max(...scanHistory.map((d) => d.critical + d.high + d.medium + d.low));
  return (
    <section className="px-4 md:px-8 py-4 pb-8 max-w-7xl mx-auto">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><i className="ri-line-chart-line text-nexia-cyan" /> Histórico de Scans</h2>
      <div className="rounded-xl bg-nexia-surface border border-nexia-border p-6">
        <div className="flex items-end justify-between gap-2 h-40">
          {scanHistory.map((day) => {
            const total = day.critical + day.high + day.medium + day.low;
            const pct = max > 0 ? (total / max) * 100 : 0;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col justify-end" style={{ height: "120px" }}>
                  <div className="w-full rounded-t-md bg-nexia-cyan/30 border-t border-nexia-cyan/40" style={{ height: pct + "%" }} />
                </div>
                <span className="text-[9px] text-nexia-muted">{day.date}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {[
            { label: "Crítico", color: "bg-red-500" },
            { label: "Alto", color: "bg-orange-500" },
            { label: "Médio", color: "bg-amber-500" },
            { label: "Baixo", color: "bg-emerald-500" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
              <span className="text-[10px] text-nexia-muted">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SentinelFooter() {
  return (
    <footer className="border-t border-nexia-border bg-nexia-surface">
      <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-nexia-cyan/20"><i className="ri-brain-fill text-nexia-cyan text-sm" /></div>
          <span className="text-white font-bold text-sm tracking-tight">NEXIA<span className="text-nexia-cyan">OS</span></span>
        </div>
        <span className="text-[11px] text-nexia-muted">Sentinel QA v1.0 · Build 2026.05.03 · Autonomous QA Engine</span>
      </div>
    </footer>
  );
}

export default HistoryChart;
