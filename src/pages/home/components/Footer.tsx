import { Link } from "react-router-dom";

const tenants = [
  { label: "CES 2027", to: "/ces" },
  { label: "Bezsan", to: "/bezsan" },
  { label: "Viajante Pro", to: "/vp" },
  { label: "Splash", to: "/splash" },
];

const legais = [
  { label: "Privacidade", to: "/privacidade" },
  { label: "Termos de Uso", to: "/termos" },
  { label: "Cookies", to: "/cookies" },
  { label: "LGPD", to: "/lgpd" },
];

const product = [
  { label: "Sentinel QA", to: "/sentinel" },
  { label: "Pipeline", to: "/pipeline" },
  { label: "CORTEX v16", to: "/cortex-app" },
  { label: "Swarm Control", to: "/swarm-control" },
  { label: "Código-Fonte", to: "/codigo" },
  { label: "Documentação", to: "/docs" },
];

export default function Footer() {
  return (
    <footer className="border-t border-nexia-border bg-nexia-surface mt-16">
      <div className="px-4 md:px-8 py-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-nexia-cyan/20"><i className="ri-brain-fill text-nexia-cyan" /></div>
              <span className="font-bold text-white">NEXIA<span className="text-nexia-cyan">OS</span></span>
            </div>
            <p className="text-xs text-nexia-muted leading-relaxed mb-4">Sistema Operacional de Inteligência Artificial. Orquestre 50+ providers em uma única plataforma SaaS.</p>
            <a href="mailto:contato@nexiaos.com.br" className="text-xs text-nexia-muted hover:text-nexia-cyan transition-colors">contato@nexiaos.com.br</a>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Produto</h4>
            <ul className="space-y-2">
              {product.map((l) => (
                <li key={l.to}><Link to={l.to} className="text-xs text-nexia-muted hover:text-white transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Tenants</h4>
            <ul className="space-y-2">
              {tenants.map((l) => (
                <li key={l.to}><Link to={l.to} className="text-xs text-nexia-muted hover:text-white transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Legal</h4>
            <ul className="space-y-2">
              {legais.map((l) => (
                <li key={l.to}><Link to={l.to} className="text-xs text-nexia-muted hover:text-white transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-nexia-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-nexia-muted">© 2026 NEXIA OS · Todos os direitos reservados · LGPD Compliant</span>
          <div className="flex items-center gap-3">
            <a href="https://wa.me/5511944037259" target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center rounded-lg bg-nexia-surface2 border border-nexia-border hover:border-nexia-cyan/40 transition-colors">
              <i className="ri-whatsapp-line text-nexia-muted hover:text-nexia-cyan text-sm" />
            </a>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sistema Online
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
