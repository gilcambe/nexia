import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollReveal } from "@/hooks/useScrollReveal";
import api from "@/services/api";
import type { SentinelReport } from "@/services/api";

export default function SentinelPage() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [healing, setHealing] = useState(false);
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [healResult, setHealResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string>("Nunca");
  const [pingStatus, setPingStatus] = useState<"checking" | "ok" | "offline">("checking");

  // Ping on mount
  useEffect(() => {
    api.sentinelPing()
      .then((res) => setPingStatus(res.error ? "offline" : "ok"))
      .catch(() => setPingStatus("offline"));
  }, []);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setHealResult(null);
    try {
      const res = await api.sentinelScan();
      if (res.error) {
        setError("Scan falhou: " + res.error);
      } else if (res.data) {
        setReport(res.data);
        setLastScan(new Date().toLocaleTimeString("pt-BR"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setScanning(false);
    }
  }, []);

  const handleHeal = useCallback(async () => {
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
        const redeployed = d?.redeploy?.triggered ? " · Redeploy disparado" : "";
        const issue = d?.githubIssue?.created ? " · Issue criada no GitHub" : "";
        setHealResult(`✅ Auto-heal aplicado: ${applied} overrides${redeployed}${issue}`);
        // re-scan após heal
        setTimeout(() => handleScan(), 2000);
      }
    } catch (e) {
      setHealResult("❌ Erro: " + (e instanceof Error ? e.message : "Falha"));
    } finally {
      setHealing(false);
    }
  }, [report, handleScan]);

  const successRate = report && report.totalEndpoints > 0
    ? Math.round((report.okCount / report.totalEndpoints) * 100)
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      {/* Header */}
      <header className="border-b border-nexia-border bg-[#0a0a0f]">
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
              <div className="w-7 h-7 flex items-center justify-center rounded-md bg-nexia-cyan/20"><i className="ri-arrow-left-line text-nexia-cyan text-sm" /></div>
              Voltar ao site
            </button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${pingStatus === "ok" ? "bg-nexia-cyan animate-pulse" : pingStatus === "offline" ? "bg-red-500" : "bg-amber-500 animate-pulse"}`} />
                <span className="text-xs text-nexia-muted">
                  {pingStatus === "ok" ? "Backend online" : pingStatus === "offline" ? "Backend offline" : "Verificando..."}
                </span>
              </div>
              {lastScan !== "Nunca" && <span className="text-xs text-nexia-muted">Último scan: {lastScan}</span>}
            </div>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/10 border border-nexia-cyan/20">
                <i className="ri-shield-keyhole-line text-nexia-cyan text-xl" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Sentinel QA</h1>
                <p className="text-sm text-nexia-muted">Scan real · Auto-heal · Integrado ao backend NEXIA_OS</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleScan} disabled={scanning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-all disabled:opacity-60 cursor-pointer whitespace-nowrap">
                {scanning ? <><i className="ri-loader-4-line animate-spin" /> Scanning...</> : <><i className="ri-scan-line" /> Executar Scan</>}
              </button>
              <button onClick={handleHeal} disabled={healing || !report?.errors?.length}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-nexia-border text-white text-sm hover:border-nexia-cyan/40 transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap">
                {healing ? <><i className="ri-loader-4-line animate-spin" /> Aplicando...</> : <><i className="ri-magic-line" /> Auto-Heal</>}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6">

        {/* Alerts */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
            <i className="ri-error-warning-line text-red-400 text-lg flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300 font-medium">Erro no scan</p>
              <p className="text-xs text-red-300/70 mt-0.5">{error}</p>
              <p className="text-xs text-nexia-muted mt-1">O Render free tier pode estar dormindo — aguarde 60s e tente novamente.</p>
            </div>
          </div>
        )}
        {healResult && (
          <div className={`rounded-xl p-4 flex items-center gap-2 ${healResult.startsWith("✅") ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
            <p className="text-sm text-white">{healResult}</p>
          </div>
        )}

        {/* Empty state before first scan */}
        {!report && !scanning && !error && (
          <ScrollReveal direction="up" delay={0}>
            <div className="rounded-xl bg-nexia-surface border border-nexia-border p-12 text-center">
              <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-nexia-cyan/10 border border-nexia-cyan/20 mx-auto mb-4">
                <i className="ri-shield-keyhole-line text-nexia-cyan text-3xl" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Nenhum scan executado</h2>
              <p className="text-sm text-nexia-muted mb-6 max-w-md mx-auto">
                Clique em "Executar Scan" para verificar todos os endpoints do backend NEXIA_OS em tempo real.
              </p>
              <button onClick={handleScan} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-all cursor-pointer mx-auto">
                <i className="ri-scan-line" /> Executar Scan Agora
              </button>
            </div>
          </ScrollReveal>
        )}

        {/* Loading state */}
        {scanning && (
          <ScrollReveal direction="up" delay={0}>
            <div className="rounded-xl bg-nexia-surface border border-nexia-border p-12 text-center">
              <i className="ri-loader-4-line animate-spin text-nexia-cyan text-3xl mb-4 block" />
              <p className="text-sm text-white font-medium">Escaneando endpoints...</p>
              <p className="text-xs text-nexia-muted mt-2">Verificando todos os endpoints do backend NEXIA_OS</p>
            </div>
          </ScrollReveal>
        )}

        {/* Results */}
        {report && !scanning && (
          <>
            {/* Summary metrics */}
            <ScrollReveal direction="up" delay={0}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-nexia-surface border border-nexia-border p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="ri-check-double-line text-nexia-cyan text-sm" />
                    <span className="text-xs text-nexia-muted">Endpoints OK</span>
                  </div>
                  <div className="text-3xl font-black text-nexia-cyan">{report.okCount}</div>
                </div>
                <div className="rounded-xl bg-nexia-surface border border-nexia-border p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="ri-server-line text-nexia-muted text-sm" />
                    <span className="text-xs text-nexia-muted">Total Endpoints</span>
                  </div>
                  <div className="text-3xl font-black text-white">{report.totalEndpoints}</div>
                </div>
                <div className="rounded-xl bg-nexia-surface border border-nexia-border p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="ri-error-warning-line text-red-400 text-sm" />
                    <span className="text-xs text-nexia-muted">Falhas</span>
                  </div>
                  <div className={`text-3xl font-black ${report.errorCount > 0 ? "text-red-400" : "text-emerald-400"}`}>{report.errorCount}</div>
                </div>
                <div className="rounded-xl bg-nexia-surface border border-nexia-border p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="ri-percent-line text-nexia-muted text-sm" />
                    <span className="text-xs text-nexia-muted">Taxa de Sucesso</span>
                  </div>
                  <div className={`text-3xl font-black ${(successRate ?? 0) >= 90 ? "text-emerald-400" : (successRate ?? 0) >= 70 ? "text-amber-400" : "text-red-400"}`}>
                    {successRate !== null ? successRate + "%" : "—"}
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Health bar */}
            <ScrollReveal direction="up" delay={60}>
              <div className="rounded-xl bg-nexia-surface border border-nexia-border p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white">Saúde Geral do Backend</h2>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${(successRate ?? 0) >= 90 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : (successRate ?? 0) >= 70 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                    {(successRate ?? 0) >= 90 ? "Saudável" : (successRate ?? 0) >= 70 ? "Degradado" : "Crítico"}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-nexia-surface2 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${(successRate ?? 0) >= 90 ? "bg-nexia-cyan" : (successRate ?? 0) >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: (successRate ?? 0) + "%" }} />
                </div>
                <p className="text-xs text-nexia-muted mt-2">{report.okCount} de {report.totalEndpoints} endpoints respondendo normalmente</p>
              </div>
            </ScrollReveal>

            {/* Errors table */}
            <ScrollReveal direction="up" delay={120}>
              <div className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden">
                <div className="px-4 py-3 border-b border-nexia-border flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <i className="ri-bug-line text-red-400" />
                    Endpoints com Falha
                    {report.errorCount > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-xs bg-red-500/15 text-red-400 border border-red-500/25 rounded-full">{report.errorCount}</span>
                    )}
                  </h2>
                  {report.errorCount > 0 && (
                    <button onClick={handleHeal} disabled={healing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-nexia-cyan bg-nexia-cyan/10 border border-nexia-cyan/20 rounded-lg hover:bg-nexia-cyan/15 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40">
                      {healing ? <><i className="ri-loader-4-line animate-spin" /> Aplicando...</> : <><i className="ri-magic-line" /> Auto-Heal</>}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-nexia-border text-nexia-muted text-xs uppercase tracking-wider">
                        <th className="px-4 py-3">Endpoint</th>
                        <th className="px-4 py-3">Erro</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!report.errors || report.errors.length === 0) && (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-nexia-muted text-sm">
                          <i className="ri-checkbox-circle-line text-emerald-400 text-2xl mb-2 block" />
                          Todos os endpoints estão respondendo normalmente ✓
                        </td></tr>
                      )}
                      {report.errors?.map((e, i) => (
                        <tr key={i} className="border-b border-nexia-border/50 hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-mono text-xs text-nexia-muted max-w-[240px] truncate">{e.url}</td>
                          <td className="px-4 py-3 text-xs text-red-300 max-w-xs truncate">{e.error}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-red-500/15 text-red-400 border border-red-500/25">{e.status ?? "FAIL"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </ScrollReveal>

            {/* Re-scan CTA */}
            <ScrollReveal direction="up" delay={160}>
              <div className="flex items-center justify-between p-4 rounded-xl bg-nexia-surface border border-nexia-border">
                <div>
                  <p className="text-sm font-medium text-white">Scan concluído às {lastScan}</p>
                  <p className="text-xs text-nexia-muted mt-0.5">Execute um novo scan para verificar o estado atual do backend</p>
                </div>
                <button onClick={handleScan} disabled={scanning}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-nexia-surface2 border border-nexia-border text-nexia-muted hover:text-white hover:border-nexia-cyan/40 rounded-lg transition-all cursor-pointer disabled:opacity-40 whitespace-nowrap">
                  <i className="ri-refresh-line" /> Novo Scan
                </button>
              </div>
            </ScrollReveal>
          </>
        )}
      </main>

      <footer className="border-t border-nexia-border bg-nexia-surface mt-8">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-nexia-cyan/20"><i className="ri-brain-fill text-nexia-cyan text-sm" /></div>
            <span className="text-white font-bold text-sm tracking-tight">NEXIA<span className="text-nexia-cyan">OS</span></span>
          </div>
          <span className="text-[11px] text-nexia-muted">Sentinel QA v2.0 · Dados reais via /api/sentinel-qa · Auto-heal integrado</span>
        </div>
      </footer>
    </div>
  );
}
