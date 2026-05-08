import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";

const TENANT_CONFIG: Record<string, { name: string; tagline: string; iframePath: string; accent: string; icon: string }> = {
  ces: { name: "CES 2027", tagline: "Missão Empresarial Brasileira — Conecte-se com os líderes de inovação global", iframePath: "/ces/landing", accent: "#3b82f6", icon: "ri-global-line" },
  bezsan: { name: "Bezsan", tagline: "Inteligência em Leilões Judiciais e Extrajudiciais — Análise e oportunidades com IA", iframePath: "/bezsan/landing", accent: "#d97706", icon: "ri-auction-line" },
  vp: { name: "Viajante Pro", tagline: "Gestão inteligente de viagens corporativas com IA embarcada", iframePath: "/vp/landing", accent: "#10b981", icon: "ri-plane-line" },
  splash: { name: "Splash", tagline: "Plataforma de eventos e experiências imersivas", iframePath: "/splash/landing", accent: "#8b5cf6", icon: "ri-drop-line" },
};

export default function TenantPage({ tenant }: { tenant?: string }) {
  const navigate = useNavigate();
  const tenantId = tenant || "";
  const config = TENANT_CONFIG[tenantId];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantData, setTenantData] = useState<boolean>(false);

  const iframeSrc = "https://nexia-os.onrender.com" + (config?.iframePath || "/") + (config?.iframePath?.includes("?") ? "&" : "?") + "embed=1";

  useEffect(() => {
    if (!config) return;
    let mounted = true;
    api.tenantInfo(tenantId)
      .then((res) => { if (!mounted) return; if (res.data) setTenantData(true); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [tenantId, config]);

  if (!config) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4 rounded-xl bg-red-500/10"><i className="ri-error-warning-line text-red-400 text-xl" /></div>
          <h1 className="text-xl font-bold mb-2">Tenant não encontrado</h1>
          <p className="text-sm text-nexia-muted mb-4">O tenant "{tenantId}" não está configurado.</p>
          <button onClick={() => navigate("/")} className="px-4 py-2 text-sm bg-nexia-cyan text-[#0a0a0f] rounded-lg hover:bg-nexia-cyan-dim transition-colors cursor-pointer">Voltar ao NEXIA OS</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="border-b border-nexia-border bg-[#0a0a0f] z-50 flex-shrink-0">
        <div className="px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
              <i className="ri-arrow-left-line" /> NEXIA OS
            </button>
            <div className="w-px h-5 bg-nexia-border" />
            <div className="flex items-center gap-2">
              <i className={`${config.icon} text-sm`} style={{ color: config.accent }} />
              <span className="text-sm font-semibold">{config.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tenantData && <span className="hidden sm:inline text-xs text-nexia-muted bg-nexia-surface px-2.5 py-1 rounded-full border border-nexia-border">Conectado ao backend</span>}
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: config.accent }} />
            <span className="text-xs" style={{ color: config.accent }}>Online</span>
          </div>
        </div>
        <div className="px-4 md:px-8 pb-2">
          <p className="text-xs text-nexia-muted">{config.tagline}</p>
        </div>
      </header>

      <main className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f] z-10">
            <div className="text-center">
              <i className="ri-loader-4-line animate-spin text-nexia-cyan text-2xl mb-3 block" />
              <p className="text-sm text-nexia-muted">Carregando {config.name}...</p>
              <p className="text-xs text-nexia-muted/60 mt-1">Conectando ao backend NEXIA_OS</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f] z-10">
            <div className="text-center p-6 rounded-xl bg-red-500/10 border border-red-500/20 max-w-md">
              <i className="ri-error-warning-line text-red-400 text-2xl mb-3 block" />
              <p className="text-sm text-red-300 mb-4">{error}</p>
              <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm bg-nexia-cyan text-[#0a0a0f] rounded-lg hover:bg-nexia-cyan-dim transition-colors cursor-pointer">Tentar novamente</button>
            </div>
          </div>
        )}
        <iframe
          src={iframeSrc}
          title={config.name}
          className="w-full h-full border-0"
          style={{ minHeight: "calc(100vh - 110px)" }}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(`Não foi possível carregar ${config.name}. O servidor pode estar inicializando (cold start).`); }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </main>
    </div>
  );
}
