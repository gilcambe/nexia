import { recentFindings } from "@/data/qaData";

const severityColors: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  high: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  medium: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  low: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

export default function FindingsPanel() {
  return (
    <section className="px-4 md:px-8 py-4 max-w-7xl mx-auto">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><i className="ri-bug-line text-nexia-cyan" /> Findings Recentes</h2>
      <div className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-nexia-border text-nexia-muted text-xs uppercase">
                <th className="px-4 py-3">Severidade</th>
                <th className="px-4 py-3">Engine</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentFindings.map((f) => {
                const c = severityColors[f.severity] || severityColors.low;
                return (
                  <tr key={f.id} className="border-b border-nexia-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md ${c.bg} ${c.text} border ${c.border}`}>{f.severity}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-nexia-muted">{f.engine}</td>
                    <td className="px-4 py-3 text-xs text-white max-w-[200px] truncate">{f.title}</td>
                    <td className="px-4 py-3 text-xs text-nexia-muted font-mono truncate max-w-[150px]">{f.file}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md ${f.status === "fixed" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-nexia-surface2 text-nexia-muted border border-nexia-border"}`}>{f.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
