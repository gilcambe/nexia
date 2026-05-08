import { aiModules } from "@/data/qaData";

export default function AIModules() {
  return (
    <section className="px-4 md:px-8 py-4 max-w-7xl mx-auto">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><i className="ri-robot-2-line text-nexia-cyan" /> Módulos de IA</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {aiModules.map((mod) => (
          <div key={mod.id} className="rounded-xl bg-nexia-surface border border-nexia-border p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ backgroundColor: `${mod.color}15`, border: `1px solid ${mod.color}25` }}>
                <i className={`${mod.icon} text-lg`} style={{ color: mod.color }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{mod.name}</h3>
                <p className="text-xs text-nexia-muted">{mod.description}</p>
              </div>
            </div>
            <div className="flex gap-4 text-xs">
              {"fixed" in mod && <span className="text-white">{mod.fixed} correções</span>}
              {"projects" in mod && <span className="text-white">{mod.projects} projetos</span>}
              <span className="text-nexia-cyan">{mod.accuracy}% accuracy</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
