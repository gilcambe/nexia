import type { ReactNode } from "react";
import { useState } from "react";
import type { Dados, Parte, Tarefa } from "./api";
import { haQuanto } from "./api";
import type { Aviso, Aba } from "./avisos";
import InstalarApp from "./InstalarApp";
import Logo, { logoServico } from "./Logo";
import { Icone } from "./icones";
import { estadoVaga } from "./ConectarIAs";
import { formatarMoeda, formatarPercentual } from "./central";

// Início da Central Kernex: visão geral com dados reais. Sem dado, mostra "sem dado ainda"; nunca número inventado.
type Estado = "ok" | "atencao" | "erro" | "cinza";
const PILULA: Record<Estado, string> = {
  ok: "bg-emerald-50 text-emerald-700", atencao: "bg-amber-50 text-amber-700", erro: "bg-red-50 text-red-700", cinza: "bg-slate-100 text-slate-500",
};
const PONTO: Record<Estado, string> = { ok: "bg-emerald-500", atencao: "bg-amber-400", erro: "bg-red-500", cinza: "bg-slate-300" };

function Pilula({ e, children }: { e: Estado; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${PILULA[e]}`}><span className={`w-1.5 h-1.5 rounded-full ${PONTO[e]}`} />{children}</span>;
}

function Caixa({ titulo, acao, children, className = "" }: { titulo: string; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="font-semibold text-slate-900">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function VerTodos({ onClick, children = "Ver todos" }: { onClick: () => void; children?: ReactNode }) {
  return <button onClick={onClick} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer">{children}</button>;
}

const MODULOS: { nome: string; frase: string; icone: string; cor: string; aba?: Aba; href?: string }[] = [
  { nome: "Cortex", frase: "IA e automações", icone: "cortex", cor: "from-violet-500 to-fuchsia-500", aba: "cortex" },
  { nome: "Vault", frase: "Memória e contexto", icone: "vault", cor: "from-emerald-500 to-green-500", href: "/projetos" },
  { nome: "Tenants", frase: "Clientes e projetos", icone: "tenants", cor: "from-sky-500 to-blue-600", aba: "clientes" },
  { nome: "IA & Tokens", frase: "Provedores e uso", icone: "ia", cor: "from-indigo-500 to-violet-600", aba: "sistema" },
  { nome: "Infraestrutura", frase: "GitHub, Firebase, Cloudflare", icone: "infra", cor: "from-orange-400 to-amber-500", aba: "sistema" },
];

function Barra({ pct, cor }: { pct: number; cor: string }) {
  return <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} /></div>;
}

function Numero({ titulo, icone, cor, valor, sub, pct, conta, barra, onClick }: {
  titulo: string; icone: string; cor: string; valor: ReactNode | null; sub: string; pct?: number | null; conta?: string; barra?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5 cursor-pointer hover:shadow-md transition-shadow" data-testid="indicador">
      <div className="flex items-center gap-3">
        <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cor} text-[#fff] flex items-center justify-center`}><Icone nome={icone} /></span>
        <span className="text-sm font-medium text-slate-700 truncate">{titulo}</span>
      </div>
      <div className="text-3xl font-bold text-slate-900 mt-3">{valor === null ? "—" : valor}</div>
      <div className="text-xs text-slate-500 mt-1">{valor === null ? "sem dado ainda" : sub}</div>
      {valor !== null && pct != null && (
        <div className="mt-3 flex items-center gap-2" title={conta}>
          <div className="flex-1"><Barra pct={pct} cor={barra || "bg-indigo-500"} /></div>
          <span className="text-xs text-slate-500">{Math.round(pct)}%</span>
        </div>
      )}
    </button>
  );
}

// Rosca simples em SVG (sem biblioteca).
function Rosca({ fatias, centro, sub }: { fatias: { valor: number; cor: string }[]; centro: string; sub: string }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0) || 1;
  const r = 40, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0" role="img" aria-label={`${centro} ${sub}`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#eef2f7" strokeWidth="12" />
      {fatias.filter((f) => f.valor > 0).map((f, i) => {
        const len = (f.valor / total) * c;
        const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={f.cor} strokeWidth="12" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />;
        acc += len;
        return el;
      })}
      <text x="50" y="49" textAnchor="middle" className="fill-slate-900" fontSize="15" fontWeight="700">{centro}</text>
      <text x="50" y="62" textAnchor="middle" className="fill-slate-500" fontSize="7.5">{sub}</text>
    </svg>
  );
}

const NOME_IA: Record<string, string> = { groq: "Groq", gemini: "Gemini", google: "Gemini", nvidia: "NVIDIA", mistral: "Mistral", codestral: "Codestral", openrouter: "OpenRouter", "workers-ai": "Workers AI", cloudflare: "Workers AI", kilo: "Kilo", github: "GitHub Models" };
const CORES_IA = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6"];

// Liga os avisos no aparelho (a page.tsx manda a notificação quando algo fica vermelho). Veio do Início antigo.
function BotaoAvisar() {
  const suporta = typeof Notification !== "undefined";
  const [estado, setEstado] = useState(suporta ? Notification.permission : "denied");
  if (!suporta || estado === "granted") return null;
  if (estado === "denied") return <p className="text-xs text-slate-500">Os avisos no aparelho estão bloqueados no navegador.</p>;
  return (
    <button onClick={async () => setEstado(await Notification.requestPermission())} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer" data-testid="central-avisar">
      🔔 Avisar no celular quando algo parar
    </button>
  );
}

export default function Painel({ d, erros, avisos, ir, conferir, carregando }: {
  d: Dados; erros: Partial<Record<Parte, string>>; avisos: Aviso[]; ir: (a: Aba) => void; conferir: () => void; carregando: boolean;
}) {
  const cx = d.cortex;
  const semana = cx ? cx.feitas7 + cx.naFila + cx.travadas.length + cx.fazendo.length : 0;
  const pctSemana = cx && semana ? (cx.feitas7 / semana) * 100 : null;
  const medidos = d.saude?.produtos || [];
  const noAr = medidos.filter((m) => m.ok).length;
  const produtos = d.lista?.produtos || [];
  const saudeDe = (id: string) => medidos.find((m) => m.id === id);
  const cotas = (d.cotas?.itens || []).filter((c) => c.pct != null);
  const maiorCota = cotas.slice().sort((a, b) => (b.pct || 0) - (a.pct || 0))[0];
  const usoIa = (d.clientes?.usoIa?.porProvedor || []).filter((p) => p.usado > 0);
  const totalIa = usoIa.reduce((s, p) => s + p.usado, 0);
  const forn = d.empresa?.fornecedores || [];
  const robos = d.robos?.robos || [];

  // Estado dos serviços principais: só o que a Central consegue medir de verdade.
  const servicos: { nome: string; logo: string | null; e: Estado; texto: string; aba: Aba }[] = [
    { nome: "Cortex", logo: "/central/logos/cortex.svg", aba: "cortex",
      ...(erros.cortex ? { e: "erro" as Estado, texto: "Sem resposta" } : !cx ? { e: "cinza" as Estado, texto: "Conferindo" } : cx.travadas.length ? { e: "atencao" as Estado, texto: `${cx.travadas.length} travadas` } : { e: "ok" as Estado, texto: "Online" }) },
    { nome: "Firebase", logo: "/central/logos/firebase.svg", aba: "sistema",
      ...(!d.banco ? { e: "cinza" as Estado, texto: "Conferindo" } : d.banco.ok ? { e: "ok" as Estado, texto: "Online" } : { e: "erro" as Estado, texto: d.banco.cheio ? "Limite do dia" : "Sem resposta" }) },
    { nome: "Cloudflare", logo: "/central/logos/cloudflare.svg", aba: "sistema",
      ...(!d.cloudflare ? { e: "cinza" as Estado, texto: "Conferindo" } : d.cloudflare.erro ? { e: "atencao" as Estado, texto: "Erro na leitura" } : d.cloudflare.configurado ? { e: "ok" as Estado, texto: "Online" } : { e: "cinza" as Estado, texto: "Sem acesso" }) },
    { nome: "GitHub", logo: "/central/logos/github.svg", aba: "prs",
      ...(!d.robos ? { e: "cinza" as Estado, texto: "Conferindo" } : robos.some((r) => r.situacao === "sem-acesso") ? { e: "atencao" as Estado, texto: "Sem acesso" } : robos.some((r) => r.situacao === "erro") ? { e: "atencao" as Estado, texto: "Robô com erro" } : { e: "ok" as Estado, texto: "Online" }) },
    { nome: "Sites dos clientes", logo: "/central/logos/kernex.svg", aba: "clientes",
      ...(!medidos.length ? { e: "cinza" as Estado, texto: "Conferindo" } : noAr === medidos.length ? { e: "ok" as Estado, texto: `${noAr}/${medidos.length} no ar` } : { e: "erro" as Estado, texto: `${medidos.length - noAr} fora` }) },
  ];
  const todosOk = servicos.every((s) => s.e === "ok");

  const tarefas: { t: Tarefa; e: Estado; texto: string }[] = cx ? [
    ...cx.travadas.map((t) => ({ t, e: "erro" as Estado, texto: "Travada" })),
    ...cx.fazendo.map((t) => ({ t, e: "atencao" as Estado, texto: "Em execução" })),
    ...cx.ultimas.map((t) => ({ t, e: "ok" as Estado, texto: "Concluída" })),
  ].slice(0, 5) : [];

  const ecossistema = forn.filter((f) => f.grupo === "Inteligência artificial" || f.grupo === "Infraestrutura").slice(0, 15);

  // #1958: leva à aba IA e Infraestrutura, direto no cartão Conectar IAs.
  const irVagas = () => { ir("sistema"); setTimeout(() => document.getElementById("conectar-ias")?.scrollIntoView({ behavior: "smooth" }), 300); };
  const vagas = d.vagas;
  const PONTO_VAGA = { verde: "ok", amarelo: "atencao", vermelho: "erro", cinza: "cinza" } as const;

  const acoes: { nome: string; icone: string; cor: string; aba?: Aba; href?: string; onClick?: () => void }[] = [
    { nome: "Conectar IAs (10 vagas)", icone: "chave", cor: "bg-indigo-50 text-indigo-700 border-indigo-100", onClick: irVagas },
    { nome: "Pedir algo ao Cortex", icone: "mais", cor: "bg-blue-50 text-blue-700 border-blue-100", aba: "cortex" },
    { nome: "Clonar tenant", icone: "clonar", cor: "bg-violet-50 text-violet-700 border-violet-100", href: "/projetos" },
    { nome: "Ver entregas e testes", icone: "lista", cor: "bg-slate-50 text-slate-700 border-slate-200", aba: "prs" },
    { nome: "Testar IAs e chaves", icone: "chave", cor: "bg-emerald-50 text-emerald-700 border-emerald-100", aba: "sistema" },
    { nome: "Abrir robôs no GitHub", icone: "externo", cor: "bg-orange-50 text-orange-700 border-orange-100", href: "https://github.com/gilcambe/nexia/actions" },
  ];

  const topo: { nome: string; logo: string | null; icone?: string; e: Estado }[] = [
    { nome: "Cortex", logo: "/central/logos/cortex.svg", e: servicos[0].e },
    { nome: "Vault", logo: null, icone: "vault", e: "cinza" },
    { nome: "Tenants", logo: null, icone: "tenants", e: servicos[4].e },
    { nome: "GitHub", logo: "/central/logos/github.svg", e: servicos[3].e },
    { nome: "Firebase", logo: "/central/logos/firebase.svg", e: servicos[1].e },
    { nome: "Cloudflare", logo: "/central/logos/cloudflare.svg", e: servicos[2].e },
    { nome: "IAs grátis", logo: null, icone: "ia", e: forn.some((f) => f.grupo === "Inteligência artificial" && f.situacao === "ok") ? "ok" : "cinza" },
  ];

  // Seção de custos
  const [custos, setCustos] = useState(null);
  const [erroCustos, setErroCustos] = useState(null);
  const [carregandoCustos, setCarregandoCustos] = useState(true);

  useEffect(() => {
    let ignorar = false;
    const buscarCustos = async () => {
      try {
        const resposta = await fetch('/api/custos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXIA_JOBS_TOKEN || ''}`
          },
          body: JSON.stringify({}),
        });
        if (!resposta.ok) {
          throw new Error('Erro ' + resposta.status + ' ao buscar custos');
        }
        const json = await resposta.json();
        if (!json.ok) {
          throw new Error(json.erro || 'Falha ao calcular custos');
        }
        if (!ignorar) {
          setCustos(json);
          setErroCustos(null);
        }
      } catch (e) {
        if (!ignorar) {
          setErroCustos(e.message || 'Não foi possível carregar os custos.');
          setCustos(null);
        }
      } finally {
        if (!ignorar) setCarregandoCustos(false);
      }
    };
    buscarCustos();
    return () => { ignorar = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-4 xl:items-center">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Olá, Gil</h1>
          <p className="text-slate-500 mt-1">Tudo da Kernex em um só lugar.</p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-white border border-indigo-100 px-5 py-4 xl:min-w-[460px]">
          <img src="/central/logos/kernex.svg" alt="Kernex" className="w-12 h-12" />
          <div>
            <div className="font-semibold text-slate-900">Sua plataforma de controle total</div>
            <div className="text-sm text-slate-500">Produtos, clientes, Cortex, IAs e infraestrutura num painel só.</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4" data-testid="modulos">
        {MODULOS.map((m) => {
          const conteudo = (
            <>
              <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${m.cor} text-[#fff] flex items-center justify-center shadow-sm shrink-0`}><Icone nome={m.icone} className="w-6 h-6" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900 text-sm sm:text-base leading-tight">{m.nome}</span>
                <span className="hidden sm:block text-xs text-slate-500 truncate">{m.frase}</span>
              </span>
              <Icone nome="seta" className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            </>
          );
          const cls = "flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 text-left cursor-pointer hover:shadow-md transition-shadow";
          return m.href
            ? <a key={m.nome} href={m.href} className={cls}>{conteudo}</a>
            : <button key={m.nome} onClick={() => m.aba && ir(m.aba)} className={cls}>{conteudo}</button>;
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6 min-w-0">
          {/* Seção de custos */}
          {custos && (
            <div className="xl:col-span-4">
              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="font-semibold text-slate-900">Custos do mês</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-sm text-slate-600 mb-1">Custo total do mês</div>
                    <div className="text-xl font-bold text-slate-900">{formatarMoeda(custos.custoTotal)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-sm text-slate-600 mb-1">Custo médio por plano</div>
                    <div className="text-xl font-bold text-slate-900">{formatarMoeda(custos.custoMedioGeral || 0)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-sm text-slate-600 mb-1">% do custo sobre a receita</div>
                    <div className="text-xl font-bold text-slate-900">{formatarPercentual(custos.percentualCustoReceita)}</div>
                  </div>
                </div>

                {custos.circuitoGlobalAtivo && (
                  <div className={`rounded-xl p-4 mb-6 ${custos.alertaTetoGlobal ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                    ⚠️ Circuito global {custos.alertaTetoGlobal ? 'excedeu o teto global' : 'está ativo'}.
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Custo médio por plano</h3>
                    <div className="space-y-2">
                      {Object.entries(custos.custoMedioPorPlano || {}).map(([plano, media]) => (
                        <div key={plano} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-sm font-medium text-slate-700">{plano}</span>
                          <span className="font-semibold text-slate-900">{formatarMoeda(media)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Top 10 clientes que mais gastam</h3>
                    <div className="space-y-2">
                      {(custos.top10Clientes || []).map((c, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-sm font-medium text-slate-700">{c.cliente || 'Desconhecido'}</span>
                          <span className="font-semibold text-slate-900">{formatarMoeda(c.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {carregandoCustos && (
            <div className="xl:col-span-4">
              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5">
                <div className="h-32 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            </div>
          )}

          {erroCustos && (
            <div className="xl:col-span-4">
              <div className="rounded-2xl bg-red-50 border border-red-200 p-5">
                <p className="text-red-700">{erroCustos}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Numero titulo="Tarefas" icone="cortex" cor="from-violet-500 to-fuchsia-500" onClick={() => ir("cortex")}
              valor={cx ? cx.fazendo.length : null} sub={cx ? `em andamento · ${cx.naFila} na fila · ${cx.travadas.length} travadas` : ""}
              pct={pctSemana} barra="bg-violet-500"
              conta={cx ? `Prontas na semana: ${cx.feitas7} de ${semana} (entregues + na fila + rodando + travadas)` : ""} />
            <Numero titulo="Tenants no ar" icone="tenants" cor="from-emerald-500 to-green-500" onClick={() => ir("clientes")}
              valor={medidos.length ? noAr : null} sub={`de ${medidos.length} sites medidos agora`}
              pct={medidos.length ? (noAr / medidos.length) * 100 : null} barra="bg-emerald-500" conta={`${noAr} de ${medidos.length} sites responderam`} />
            <Numero titulo="Cota de IA" icone="ia" cor="from-sky-500 to-blue-600" onClick={() => ir("sistema")}
              valor={maiorCota ? `${Math.round(maiorCota.pct || 0)}%` : null} sub={maiorCota ? `a mais usada hoje: ${maiorCota.nome}` : ""}
              pct={maiorCota ? maiorCota.pct : null} barra={maiorCota && (maiorCota.pct || 0) >= 80 ? "bg-amber-500" : "bg-sky-500"}
              conta={maiorCota ? `${maiorCota.usado} de ${maiorCota.limite}` : ""} />
            <Numero titulo="Alertas" icone="alerta" cor="from-orange-400 to-amber-500" onClick={() => ir("inicio")}
              valor={d.saude ? avisos.length : null} sub={avisos.length ? "precisam de você" : "nada pendente"} />
          </div>

          {avisos.length > 0 && (
            <section className="lg:hidden rounded-2xl bg-white border border-amber-200 p-4 space-y-2" data-testid="alertas-celular">
              <h2 className="font-semibold text-slate-900">Precisa de você</h2>
              {avisos.map((a, k) => (
                <button key={k} onClick={() => ir(a.aba)} className="w-full flex items-start gap-2 text-left text-sm text-slate-700 cursor-pointer">
                  <Icone nome="alerta" className={`w-4 h-4 mt-0.5 shrink-0 ${a.cor === "vermelho" ? "text-red-600" : "text-amber-600"}`} />{a.texto}
                </button>
              ))}
            </section>
          )}

          <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
            <Caixa titulo="Ecossistema" acao={<VerTodos onClick={() => ir("sistema")} />}>
              {!d.empresa ? <div className="h-40 rounded-xl bg-slate-100 animate-pulse" /> : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3" data-testid="ecossistema">
                  {ecossistema.map((f) => {
                    const e: Estado = f.situacao === "ok" ? "ok" : f.situacao === "erro" ? "erro" : "cinza";
                    return (
                      <button key={f.id} onClick={() => ir("sistema")} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200/80 p-3 text-center cursor-pointer hover:bg-slate-50" title={f.paraQue}>
                        <Logo nome={f.nome} src={logoServico(f.id)} tam={40} />
                        <span className="text-xs font-semibold text-slate-800 leading-tight">{f.nome.replace(/ \(.*\)/, "")}</span>
                        <Pilula e={e}>{e === "ok" ? "Ativo" : e === "erro" ? "Erro" : "Desligado"}</Pilula>
                      </button>
                    );
                  })}
                </div>
              )}
            </Caixa>

            <Caixa titulo="Tenants" acao={<VerTodos onClick={() => ir("clientes")} />}>
              {!d.lista ? <div className="h-40 rounded-xl bg-slate-100 animate-pulse" /> : (
                <ul className="divide-y divide-slate-100" data-testid="tenants">
                  {produtos.filter((p) => !p.pendente).slice(0, 6).map((p) => {
                    const m = saudeDe(p.id);
                    const e: Estado = !m ? "cinza" : !m.ok ? "erro" : m.lento ? "atencao" : "ok";
                    return (
                      <li key={p.id} className="flex items-center gap-3 py-2.5">
                        <Logo nome={p.nome} src={p.logo} tam={36} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-900 truncate">{p.nome}</span>
                          <span className="block text-xs text-slate-500 truncate">{p.segmento || p.frase}</span>
                        </span>
                        <Pilula e={e}>{e === "ok" ? "Online" : e === "erro" ? "Fora do ar" : e === "atencao" ? "Lento" : "Sem medição"}</Pilula>
                        {p.site && <a href={p.site} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Abrir site"><Icone nome="site" className="w-4 h-4" /></a>}
                        {p.painel && p.painel !== p.site && <a href={p.painel} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Abrir painel do dono"><Icone nome="externo" className="w-4 h-4" /></a>}
                      </li>
                    );
                  })}
                  <li>
                    <a href="/projetos" className="flex items-center gap-3 py-2.5 group">
                      <span className="w-9 h-9 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400"><Icone nome="mais" className="w-4 h-4" /></span>
                      <span><span className="block text-sm font-medium text-slate-900 group-hover:text-indigo-600">Novo tenant</span><span className="block text-xs text-slate-500">Clonar ou criar</span></span>
                    </a>
                  </li>
                </ul>
              )}
            </Caixa>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-[1.4fr_1fr_1fr] gap-6">
            <Caixa titulo="Tarefas recentes" acao={<VerTodos onClick={() => ir("cortex")}>Ver todas</VerTodos>}>
              {!cx ? <div className="h-40 rounded-xl bg-slate-100 animate-pulse" /> : !tarefas.length ? <p className="text-sm text-slate-500">Nenhuma tarefa agora.</p> : (
                <ul className="space-y-3" data-testid="tarefas-recentes">
                  {tarefas.map(({ t, e, texto }) => (
                    <li key={t.numero}>
                      <a href={`/meu-cortex#p${t.numero}`} className="flex items-center gap-3 group">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${PILULA[e]}`}><Icone nome={e === "ok" ? "ok" : e === "erro" ? "alerta" : "cortex"} className="w-4 h-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-800 truncate group-hover:text-indigo-600">{t.titulo}</span>
                          <span className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">#{t.numero} · {haQuanto(t.quando)} <Pilula e={e}>{texto}</Pilula></span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Caixa>

            <Caixa titulo="Topologia do ecossistema" acao={<span className="text-[11px] text-slate-400">ligações reais</span>}>
              <div className="relative flex flex-col items-center gap-3" data-testid="topologia">
                <div className="grid grid-cols-3 gap-2 w-full">
                  {topo.slice(0, 3).map((n) => <No key={n.nome} {...n} />)}
                </div>
                <div className="flex items-center gap-2 w-full">
                  <No {...topo[3]} />
                  <div className="flex-1 flex flex-col items-center rounded-xl bg-indigo-50 border border-indigo-100 py-2">
                    <img src="/central/logos/kernex.svg" alt="" className="w-9 h-9" />
                    <span className="text-[11px] font-semibold text-indigo-700">Central Kernex</span>
                  </div>
                  <No {...topo[4]} />
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {topo.slice(5).map((n) => <No key={n.nome} {...n} />)}
                </div>
                <p className="text-[11px] text-slate-400 text-center">Verde = medido agora · cinza = sem medição. O mapa clicável está a caminho (tarefa #1861).</p>
              </div>
            </Caixa>

            <div className="space-y-6">
              <Caixa titulo="Uso de IA" acao={<VerTodos onClick={() => ir("sistema")}>Ver detalhes</VerTodos>}>
                {!totalIa ? <p className="text-sm text-slate-500">Sem dado ainda. O medidor de uso por IA está sendo feito (tarefas #1805 a #1809).</p> : (
                  <div className="flex items-center gap-4">
                    <Rosca fatias={usoIa.map((p, i) => ({ valor: p.usado, cor: CORES_IA[i % CORES_IA.length] }))} centro={String(totalIa)} sub="pedidos hoje" />
                    <ul className="space-y-1.5 text-xs flex-1 min-w-0">
                      {usoIa.map((p, i) => (
                        <li key={p.provedor} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CORES_IA[i % CORES_IA.length] }} />
                          <span className="flex-1 truncate text-slate-700">{NOME_IA[p.provedor] || p.provedor}</span>
                          <span className="text-slate-500">{Math.round((p.usado / totalIa) * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Caixa>
              <Caixa titulo="Máquinas locais">
                <div className="flex items-start gap-3 text-sm">
                  <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><Icone nome="pc" /></span>
                  <p className="text-slate-500">Os 2 PCs ainda não estão ligados à Central. O agente que mostra CPU, memória e IA local de cada PC está sendo feito (tarefa #1846).</p>
                </div>
              </Caixa>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Caixa titulo="Status dos serviços" acao={<Pilula e={todosOk ? "ok" : servicos.some((s) => s.e === "erro") ? "erro" : "atencao"}>{todosOk ? "Todos operacionais" : "Atenção"}</Pilula>}>
            <ul className="space-y-1" data-testid="status-servicos">
              {servicos.map((s) => (
                <li key={s.nome}>
                  <button onClick={() => ir(s.aba)} className="w-full flex items-center gap-3 rounded-lg px-1 py-2 text-left cursor-pointer hover:bg-slate-50">
                    <Logo nome={s.nome} src={s.logo} tam={32} />
                    <span className="flex-1 text-sm text-slate-800 truncate">{s.nome}</span>
                    <Pilula e={s.e}>{s.texto}</Pilula>
                    <Icone nome="seta" className="w-4 h-4 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          </Caixa>

          <Caixa titulo="IAs que ajudam o Cortex" acao={<VerTodos onClick={irVagas}>Conectar</VerTodos>}>
            {!vagas ? <div className="h-16 rounded-xl bg-slate-100 animate-pulse" /> : (
              <ul className="space-y-2" data-testid="painel-vagas">
                {vagas.vagas.filter((v, i, todas) => v.ligada || v === todas.find((x) => !x.ligada)).map((v) => {
                  const p = vagas.provedores.find((x) => x.id === v.provedor);
                  const e = estadoVaga(v);
                  return (
                    <li key={v.vaga}>
                      <button onClick={irVagas} className="w-full flex items-center gap-3 text-left cursor-pointer">
                        {p ? <Logo nome={p.nome} src={p.logo} tam={28} /> : <span className="w-7 h-7 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 text-xs font-bold flex items-center justify-center">{v.vaga}</span>}
                        <span className="flex-1 text-sm text-slate-700 truncate">{p ? p.nome : `Vaga ${v.vaga} livre`}</span>
                        <Pilula e={PONTO_VAGA[e.e]}>{e.texto}</Pilula>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Caixa>

          <Caixa titulo="Ações rápidas">
            <div className="space-y-2">
              {acoes.map((a) => {
                const cls = `w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium cursor-pointer ${a.cor}`;
                const dentro = <><Icone nome={a.icone} className="w-5 h-5" />{a.nome}</>;
                return a.href
                  ? <a key={a.nome} href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cls}>{dentro}</a>
                  : <button key={a.nome} onClick={() => (a.onClick ? a.onClick() : a.aba && ir(a.aba))} className={cls} data-testid={a.onClick ? "acao-conectar-ias" : undefined}>{dentro}</button>;
              })}
            </div>
          </Caixa>

          <Caixa className="hidden lg:block" titulo="Alertas e notificações" acao={<button onClick={conferir} disabled={carregando} className="text-xs font-medium text-indigo-600 cursor-pointer disabled:opacity-50" data-testid="central-conferir">{carregando ? "Conferindo…" : "Conferir agora"}</button>}>
            {!d.saude ? <div className="h-24 rounded-xl bg-slate-100 animate-pulse" /> : !avisos.length ? (
              <div className="flex items-center gap-3 text-sm text-slate-600"><span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><Icone nome="ok" className="w-5 h-5" /></span>Tudo funcionando. Nada precisa de você.</div>
            ) : (
              <ul className="space-y-3" data-testid="alertas">
                {avisos.map((a, k) => (
                  <li key={k}>
                    <button onClick={() => ir(a.aba)} className="w-full flex items-start gap-3 text-left cursor-pointer group" data-testid="central-aviso">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.cor === "vermelho" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}><Icone nome="alerta" className="w-4 h-4" /></span>
                      <span className="text-sm text-slate-700 group-hover:text-indigo-600">{a.texto}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Caixa>
          <InstalarApp />
          <BotaoAvisar />
        </div>
      </div>
    </div>
  );
}

function No({ nome, logo, icone, e }: { nome: string; logo: string | null; icone?: string; e: Estado }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1 rounded-xl border border-slate-200/80 py-2 px-1 min-w-0">
      <span className="relative">
        {logo ? <img src={logo} alt="" className="w-7 h-7" /> : <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"><Icone nome={icone || "mais"} className="w-4 h-4" /></span>}
        <span className={`absolute -right-1 -bottom-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${PONTO[e]}`} />
      </span>
      <span className="text-[11px] text-slate-600 truncate max-w-full">{nome}</span>
    </div>
  );
}
