import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollReveal } from "@/hooks/useScrollReveal";
import api from "@/services/api";
import type { SentinelReport } from "@/services/api";

export default function QACenter() {
  const navigate = useNavigate();
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [healing, setHealing] = useState(false);
  const [healResult, setHealResult] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);

  // Auto-run scan on mount
  useEffect(() => {
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runScan = useCallback(async () => {
    setScanLoading(true);
    setScanError(null);
    setHealResult(null);
    try {
      const res = await api.sentinelScan();
      if (res.error) {
        setScanError(res.error);
      } else if (res.data) {
        setReport(res.data);
        setLastScan(new Date().toLocaleTimeString("pt-BR"));
      }
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Erro ao executar scan");
    } finally {
      setScanLoading(false);
    }
  }, []);

  const doHeal = useCallback(async () => {
    if (!report?.errors?.length) return;
    setHealing(true);
    setHealResult(null);
    try {
      const issues = report.errors.map((e) => ({
        type: "SCAN_FAIL",
        severity: "CRITICAL",
        route: e.url,
        detail: e.error,
        status: e.status,
      }));
      const res = await api.sentinelHeal(issues);
      if (res.error) {
        setHealResult("❌ Heal falhou: " + res.error);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = res.data as any;
        const applied = d?.firestoreOverrides?.applied ?? d?.applied ?? 0;
        const extras: string[] = [];
        if (d?.redeploy?.triggered) extras.push("Redeploy disparado");
        if (d?.githubIssue?.created) extras.push("Issue criada no GitHub");
        setHealResult(`✅ Auto-heal concluído: ${applied} overrides aplicados${extras.length ? " · " + extras.join(" · ") : ""}`);
        // Re-scan after heal
        setTimeout(runScan, 2500);
      }
    } catch (e) {
      setHealResult("❌ Erro: " + (e instanceof Error ? e.message : "Falha no heal"));
    } finally {
      setHealing(false);
    }
  }, [report, runScan]);

  const successRate = report && report.totalEndpoints > 0
    ? Math.round((report.okCount / report.totalEndpoints) * 100)
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border bg-[#0a0a0f]">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
              <i className="ri-arrow-left-line" /> Voltar ao site
            </button>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${scanLoading ? "bg-amber-400 animate-pulse" : "bg-nexia-cyan animate-pulse"}`} />
              <span className="text-xs text-nexia-muted">
                {scanLoading ? "Escaneando..." : lastScan ? `Último scan: ${lastScan}` : "QA Center"}
              </span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/10 border border-nexia-cyan/20">
                <i className="ri-shield-check-line text-nexia-cyan text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">QA Center</h1>
                <p className="text-sm text-nexia-muted">Scan real · Auto-heal · /api/sentinel-qa</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={runScan} disabled={scanLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg hover:bg-nexia-cyan-dim transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap">
                {scanLoading ? <><i className="ri-loader-4-line animate-spin" /> Scanning...</> : <><i className="ri-scan-line" /> Novo Scan</>}
              </button>
              <button onClick={doHeal} disabled={healing || !report?.errors?.length}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-nexia-surface border border-nexia-border text-white rounded-lg hover:border-nexia-cyan/40 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap">
                {healing ? <><i className="ri-loader-4-line animate-spin" /> Aplicando...</> : <><i className="ri-magic-line" /> Auto-Heal</>}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-5">

        {/* Error */}
        {scanError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
            <i className="ri-error-warning-line text-red-400 text-lg flex-shrink-0" />
            <div>
              <p className="text-sm text-red-300 font-medium">Scan falhou</p>
              <p className="text-xs text-red-300/70 mt-0.5">{scanError}</p>
              <p className="text-xs text-nexia-muted mt-1">O Render free tier pode estar dormindo. Aguarde 60s e tente novamente.</p>
            </div>
          </div>
        )}

        {/* Heal result */}
        {healResult && (
          <div className={`rounded-xl p-4 flex items-center gap-3 ${healResult.startsWith("✅") ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
            <p className="text-sm text-white">{healResult}</p>
          </div>
        )}

        {/* Loading */}
        {scanLoading && !report && (
          <div className="rounded-xl bg-nexia-surface border border-nexia-border p-10 text-center">
            <i className="ri-loader-4-line animate-spin text-nexia-cyan text-2xl mb-3 block" />
            <p className="text-sm text-nexia-muted">Verificando todos os endpoints do backend...</p>
          </div>
        )}

        {/* Metrics */}
        {report && (
          <>
            <ScrollReveal direction="up" delay={0}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Endpoints OK", value: report.okCount, color: "text-nexia-cyan", icon: "ri-check-double-line" },
                  { label: "Total", value: report.totalEndpoints, color: "text-white", icon: "ri-server-line" },
                  { label: "Falhas", value: report.errorCount, color: report.errorCount > 0 ? "text-red-400" : "text-emerald-400", icon: "ri-error-warning-line" },
                  { label: "Saúde", value: successRate !== null ? successRate + "%" : "—", color: (successRate ?? 0) >= 90 ? "text-emerald-400" : (successRate ?? 0) >= 70 ? "text-amber-400" : "text-red-400", icon: "ri-heart-pulse-line" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-nexia-surface border border-nexia-border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <i className={`${m.icon} text-nexia-muted text-xs`} />
                      <p className="text-xs text-nexia-muted">{m.label}</p>
                    </div>
                    <p className={`text-2xl font-black ${m.color}`}>{String(m.value)}</p>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            {/* Health bar */}
            <ScrollReveal direction="up" delay={40}>
              <div className="rounded-xl bg-nexia-surface border border-nexia-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white">Saúde Geral</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    (successRate ?? 0) >= 90 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : (successRate ?? 0) >= 70 ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}>
                    {(successRate ?? 0) >= 90 ? "Saudável" : (successRate ?? 0) >= 70 ? "Degradado" : "Crítico"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-nexia-surface2 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${(successRate ?? 0) >= 90 ? "bg-nexia-cyan" : (successRate ?? 0) >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: (successRate ?? 0) + "%" }} />
                </div>
              </div>
            </ScrollReveal>

            {/* Failures table */}
            <ScrollReveal direction="up" delay={80}>
              <div className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden">
                <div className="px-4 py-3 border-b border-nexia-border flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <i className="ri-bug-line text-red-400" /> Endpoints com Falha
                    {report.errorCount > 0 && <span className="px-2 py-0.5 text-[10px] bg-red-500/15 text-red-400 border border-red-500/25 rounded-full">{report.errorCount}</span>}
                  </h2>
                  {report.errorCount > 0 && (
                    <button onClick={doHeal} disabled={healing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer disabled:opacity-40">
                      {healing ? <><i className="ri-loader-4-line animate-spin" /> Aplicando...</> : <><i className="ri-magic-line" /> Auto-Heal</>}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-nexia-border text-nexia-muted text-xs uppercase">
                        <th className="px-4 py-3">Endpoint</th>
                        <th className="px-4 py-3">Erro</th>
                        <th className="px-4 py-3 text-right">HTTP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!report.errors || report.errors.length === 0) && (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-sm">
                          <i className="ri-checkbox-circle-line text-emerald-400 text-2xl mb-2 block" />
                          <span className="text-emerald-400 font-medium">Todos os endpoints respondendo normalmente ✓</span>
                        </td></tr>
                      )}
                      {report.errors?.map((e, i) => (
                        <tr key={i} className="border-b border-nexia-border/50 hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-mono text-xs text-nexia-muted max-w-[220px] truncate">{e.url}</td>
                          <td className="px-4 py-3 text-xs text-red-300 max-w-xs truncate">{e.error}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-red-500/15 text-red-400 border border-red-500/25">
                              {e.status ?? "FAIL"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollReveal>
          </>
        )}
      </main>
    </div>
  );
}
