import { qaEngines } from "@/data/qaData";

export default function EnginesPanel() {
  return (
    <section className="px-4 md:px-8 py-4 max-w-7xl mx-auto">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><i className="ri-cpu-line text-nexia-cyan" /> Engines de QA</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {qaEngines.map((engine) => (
          <div key={engine.id} className="rounded-xl bg-nexia-surface border border-nexia-border p-4 hover:border-nexia-cyan/20 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-nexia-surface2 border border-nexia-border">
                <i className={`${engine.icon} text-nexia-muted text-lg`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white truncate">{engine.name}</h3>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${engine.status === "running" ? "bg-nexia-cyan animate-pulse" : "bg-nexia-muted/40"}`} />
                </div>
                <p className="text-[10px] text-nexia-muted">{engine.lastRun} · {engine.duration}</p>
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-white font-semibold">{engine.tests} total</span>
              <span className="text-emerald-400">{engine.passed} ✓</span>
              {engine.failed > 0 && <span className="text-red-400">{engine.failed} ✗</span>}
              {engine.skipped > 0 && <span className="text-nexia-muted">{engine.skipped} skip</span>}
            </div>
            <div className="mt-2 w-full h-1.5 rounded-full bg-nexia-surface2 overflow-hidden">
              <div className="h-full rounded-full bg-nexia-cyan" style={{ width: Math.round((engine.passed / engine.tests) * 100) + "%" }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
