import { qaEngines, projectScan } from "@/data/qaData";

export default function MetricsGrid() {
  const metrics = [
    { label: "Arquivos", value: projectScan.totalFiles, icon: "ri-file-code-line", color: "#00d4aa" },
    { label: "Linhas de código", value: projectScan.totalLines.toLocaleString(), icon: "ri-code-s-slash-line", color: "#3b82f6" },
    { label: "Cobertura de testes", value: projectScan.testCoverage + "%", icon: "ri-test-tube-line", color: "#f59e0b" },
    { label: "Score de segurança", value: projectScan.securityScore + "/100", icon: "ri-shield-check-line", color: "#10b981" },
    { label: "Performance", value: projectScan.performanceScore + "/100", icon: "ri-dashboard-3-line", color: "#8b5cf6" },
    { label: "Acessibilidade", value: projectScan.a11yScore + "/100", icon: "ri-user-smile-line", color: "#ec4899" },
  ];
  const runningEngines = qaEngines.filter((e) => e.status === "running").length;
  const totalTests = qaEngines.reduce((a, e) => a + e.tests, 0);
  const totalPassed = qaEngines.reduce((a, e) => a + e.passed, 0);

  return (
    <section className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl bg-nexia-surface border border-nexia-border p-4">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2" style={{ backgroundColor: `${m.color}15` }}>
              <i className={`${m.icon} text-sm`} style={{ color: m.color }} />
            </div>
            <div className="text-lg font-bold text-white">{m.value}</div>
            <div className="text-[10px] text-nexia-muted mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-nexia-surface border border-nexia-border p-4 text-center">
          <div className="text-2xl font-bold text-nexia-cyan">{runningEngines}</div>
          <div className="text-xs text-nexia-muted">Engines rodando</div>
        </div>
        <div className="rounded-xl bg-nexia-surface border border-nexia-border p-4 text-center">
          <div className="text-2xl font-bold text-white">{totalTests}</div>
          <div className="text-xs text-nexia-muted">Total de testes</div>
        </div>
        <div className="rounded-xl bg-nexia-surface border border-nexia-border p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{Math.round((totalPassed / totalTests) * 100)}%</div>
          <div className="text-xs text-nexia-muted">Taxa de aprovação</div>
        </div>
      </div>
    </section>
  );
}
