import { useCallback, useEffect, useState } from "react";
import { haQuanto } from "../central/api";
import { NOME_SITUACAO, usePedidos } from "../meu-cortex/api";
import type { Deploy, Filtro, Resumo } from "../meu-cortex/api";
import type { Tema } from "./page";
import ContasReserva from "./Reservas";

const Cartao = ({ children, testid }: { children: React.ReactNode; testid?: string }) => (
  <div className="rounded-2xl border border-[var(--cx-line)] bg-[var(--cx-card)] p-4" data-testid={testid}>{children}</div>
);
const Ponto = ({ ok }: { ok: boolean | null }) => <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok === null ? "bg-gray-500" : ok ? "bg-emerald-400" : "bg-red-500"}`} />;
const Titulo = ({ t, s }: { t: string; s?: string }) => <header className="mb-5"><h2 className="text-2xl font-semibold">{t}</h2>{s && <p className="text-sm text-[var(--cx-mut)] mt-1">{s}</p>}</header>;

// O que o Cortex usa de verdade: o estado de GitHub e Cloudflare vem das APIs; as IAs grátis são o rodízio fixo do Cortex.
const IAS = ["Groq", "GitHub Models", "Gemini", "Workers AI", "Mistral", "OpenRouter"];

export function Conexoes({ email }: { email: string }) {
  const { listar, deploy } = usePedidos();
  const [gh, setGh] = useState<boolean | null>(null);
  const [d, setD] = useState<Deploy | null>(null);
  useEffect(() => {
    listar("", "todos", 1).then(() => setGh(true)).catch(() => setGh(false));
    deploy().then(setD).catch(() => setD(null));
  }, [listar, deploy]);
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-3">
      <Titulo t="Conexões" s="Tudo o que o Cortex usa para trabalhar. Tudo grátis." />
      <Cartao testid="cx-con-github"><p className="flex items-center gap-2 font-medium"><Ponto ok={gh} />GitHub</p>
        <p className="text-sm text-[var(--cx-mut)] mt-1">{gh === null ? "Verificando…" : gh ? "Conectado: a fila de pedidos e o histórico ficam nele, de graça." : "Sem acesso. Entre como dono."}</p></Cartao>
      <Cartao testid="cx-con-cloudflare"><p className="flex items-center gap-2 font-medium"><Ponto ok={d ? !d.falhou : null} />Cloudflare</p>
        <p className="text-sm text-[var(--cx-mut)] mt-1">{!d ? "Verificando…" : d.emAndamento ? "Publicando agora…" : d.falhou ? "A última publicação falhou." : `Último deploy ${haQuanto(d.ultimoDeploy?.quando)}. ${d.mudancas ? `${d.mudancas} mudança(s) esperando publicar.` : "Tudo no ar."}`}</p></Cartao>
      <Cartao testid="cx-con-firebase"><p className="flex items-center gap-2 font-medium"><Ponto ok={!!email} />Firebase</p>
        <p className="text-sm text-[var(--cx-mut)] mt-1">Login do dono ativo: {email}.</p></Cartao>
      <Cartao testid="cx-con-ias"><p className="font-medium">IAs grátis do Cortex</p>
        <div className="flex flex-wrap gap-2 mt-3">{IAS.map((i) => <span key={i} className="px-3 h-8 inline-flex items-center rounded-full border border-[var(--cx-line)] text-sm">{i}</span>)}</div>
        <p className="text-sm text-[var(--cx-mut)] mt-3">O Cortex alterna entre elas sozinho, para nunca parar por falta de IA.</p></Cartao>
      <ContasReserva />
    </div>
  );
}

function ListaPedidos({ itens, abrir, fazer }: { itens: Resumo[]; abrir: (n: number) => void; fazer?: (corpo: Record<string, unknown>) => Promise<void> | void }) {
  return (
    <ul className="space-y-2">{itens.map((t) => (
      <li key={t.numero} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-card)] px-4 py-3 hover:border-[var(--cx-ac)]">
        <button onClick={() => abrir(t.numero)} className="flex-1 min-w-[60%] text-left" data-testid="cx-linha">
          <span className="text-xs text-[var(--cx-mut)] flex flex-wrap items-center gap-1.5">{t.texto ? <span className="px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: COR_SELO[t.cor || "cinza"] }} data-testid="cx-selo">{t.icone} {t.texto}</span> : NOME_SITUACAO[t.situacao]} #{t.numero}{t.ia ? ` · ${t.ia}` : ""} · última atividade {haQuanto(t.quando)}</span>
          {t.estado === "travada" && t.motivo && <span className="block text-xs text-amber-500 mt-0.5">⚠️ {t.motivo}</span>}
          <span className="block break-words mt-0.5">{t.titulo}</span>
        </button>
        {fazer && (
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            {(t.situacao === "travado" || t.situacao === "fila" || t.situacao === "dividido") && (
              <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm(`Mandar o pedido #${t.numero} para o Jules? Ele abre o PR sozinho (sem juntar).`)) fazer({ acao: "jules", n: t.numero }); }} className="h-8 px-2.5 rounded-lg border border-[var(--cx-ac)] text-xs font-semibold" data-testid="cx-lista-jules">Mandar para o Jules</button>
            )}
            {t.situacao === "travado" && (
              <button type="button" onClick={(e) => { e.stopPropagation(); fazer({ acao: "tentar", n: t.numero }); }} className="h-8 px-2.5 rounded-lg bg-[var(--cx-ac)] text-black text-xs font-semibold" data-testid="cx-lista-tentar">Tentar de novo</button>
            )}
            {t.situacao === "travado" && (
              <button type="button" onClick={(e) => { e.stopPropagation(); fazer({ acao: "reserva", n: t.numero }); }} className="h-8 px-2.5 rounded-lg border border-[var(--cx-ac)] text-xs font-semibold" data-testid="cx-lista-reserva">Ajuda das IAs conectadas</button>
            )}
            {t.situacao !== "feito" && t.situacao !== "fechado" ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm("Cancelar este pedido?")) fazer({ acao: "cancelar", n: t.numero }); }} className="h-8 px-2.5 rounded-lg border border-[var(--cx-line)] text-xs" data-testid="cx-lista-cancelar">Cancelar</button>
            ) : (
              <button type="button" onClick={(e) => { e.stopPropagation(); fazer({ acao: "reabrir", n: t.numero }); }} className="h-8 px-2.5 rounded-lg border border-[var(--cx-line)] text-xs" data-testid="cx-lista-reabrir">Reabrir</button>
            )}
          </div>
        )}
      </li>
    ))}{!itens.length && <li className="text-sm text-[var(--cx-mut)]">Nada por aqui.</li>}</ul>
  );
}

// #3136: abas com os estados reais. Concluídas saem da aba padrão.
const FILTROS: { id: Filtro; nome: string }[] = [{ id: "andamento", nome: "Em andamento" }, { id: "travadas", nome: "Travadas" }, { id: "precisa", nome: "Precisa de você" }, { id: "concluidas", nome: "Concluídas" }, { id: "todos", nome: "Todas" }];
const COR_SELO: Record<string, string> = { cinza: "#64748b", azul: "#3b82f6", roxo: "#8b5cf6", laranja: "#f59e0b", verde: "#22c55e", vermelho: "#ef4444" };

// #3138: avisa quando um pedido terminou ou travou (compara com o último estado visto neste aparelho).
function avisarMudancas(itens: Resumo[]) {
  let antes: Record<string, string> = {};
  try { antes = JSON.parse(localStorage.getItem("cx:estados") || "{}"); } catch { antes = {}; }
  const agora: Record<string, string> = { ...antes };
  const avisos: string[] = [];
  for (const t of itens) {
    if (!t.estado) continue;
    const k = String(t.numero);
    if (antes[k] && antes[k] !== t.estado && (t.estado === "concluida" || t.estado === "travada")) avisos.push(t.estado === "concluida" ? `Pedido #${t.numero} concluído` : `Pedido #${t.numero} travou: ${t.motivo || ""}`);
    agora[k] = t.estado;
  }
  try { localStorage.setItem("cx:estados", JSON.stringify(agora)); } catch { /* sem espaço: segue */ }
  if (avisos.length && typeof Notification !== "undefined" && Notification.permission === "granted") for (const a of avisos.slice(0, 3)) { try { new Notification(a); } catch { /* sem suporte */ } }
  return avisos;
}

// #3138: painel "IAs trabalhando agora" + resumo de 1 frase (mesma fonte da Central).
function IasAgora() {
  const { ias } = usePedidos();
  const [d, setD] = useState<{ ias: { nome: string; situacao: string; texto: string }[]; resumo: string; conferidoEm: string } | null>(null);
  useEffect(() => { const ler = () => ias<NonNullable<typeof d>>().then(setD).catch(() => undefined); ler(); const t = setInterval(ler, 30000); return () => clearInterval(t); }, [ias]);
  if (!d) return null;
  const cor: Record<string, string> = { ativa: "#22c55e", ociosa: "#64748b", "sem-cota": "#f59e0b", erro: "#ef4444" };
  const nome: Record<string, string> = { ativa: "trabalhando", ociosa: "parada", "sem-cota": "sem cota", erro: "com erro" };
  return (
    <div className="rounded-2xl border border-[var(--cx-line)] bg-[var(--cx-card)] p-4 mb-4" data-testid="cx-ias-agora">
      <p className="font-semibold text-lg" data-testid="cx-resumo">{d.resumo}</p>
      <ul className="mt-3 space-y-1.5 text-sm">{d.ias.slice(0, 8).map((x) => (
        <li key={x.nome} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor[x.situacao] || "#64748b" }} /><b>{x.nome}</b><span className="text-[var(--cx-mut)]">{nome[x.situacao] || x.situacao} · {x.texto}</span></li>
      ))}</ul>
      <p className="text-xs text-[var(--cx-mut)] mt-2">Conferido às {new Date(d.conferidoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
    </div>
  );
}

function QuemTrabalha() {
  const { quem } = usePedidos();
  const [d, setD] = useState<{ itens: { issue: number; quem: string; onde: string; status: string; detalhes: string; pendentesCount: number; totalCount: number }[]; conferidoEm: string } | null>(null);
  useEffect(() => { const ler = () => quem<NonNullable<typeof d>>().then(setD).catch(() => undefined); ler(); const t = setInterval(ler, 60000); return () => clearInterval(t); }, [quem]);
  if (!d || !d.itens.length) return null;
  const cor: Record<string, string> = { trabalhando: "#22c55e", parou: "#ef4444", assumido: "#f59e0b" };
  return (
    <div className="rounded-2xl border border-[var(--cx-line)] bg-[var(--cx-card)] p-4 mb-4" data-testid="cx-quem-trabalha">
      <p className="font-semibold">Quem está trabalhando</p>
      <ul className="mt-2 space-y-1.5 text-sm">{d.itens.slice(0, 10).map((x) => (
        <li key={x.issue} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor[x.status] || "#64748b" }} /><b>{x.quem}</b><span className="text-[var(--cx-mut)]">{x.onde} · {x.status} · {x.detalhes} · faltam {x.pendentesCount} de {x.totalCount}</span></li>
      ))}</ul>
    </div>
  );
}

export function Tarefas({ abrir }: { abrir: (n: number) => void }) {
  const { listar, agir } = usePedidos();
  const [f, setF] = useState<Filtro>("andamento");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [itens, setItens] = useState<Resumo[]>([]);
  const [erro, setErro] = useState<string>();
  const [msg, setMsg] = useState<string | null>(null);
  const [jules, setJules] = useState<boolean>(() => {
    const saved = localStorage.getItem('cx-socorro-jules');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [socorroMsg, setSocorroMsg] = useState<string | null>(null);
  const [socorroLinks, setSocorroLinks] = useState<{ numero: number; titulo: string }[]>([]);
  const [socorroStatus, setSocorroStatus] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setBuscaDebounced(busca); }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(() => {
    setErro(undefined);
    listar(buscaDebounced, f, 1).then((r) => { setItens(r.itens); const a = avisarMudancas(r.itens); if (a.length) setAvisos(a); }).catch((e: Error) => setErro(e.message));
  }, [listar, buscaDebounced, f]);

  useEffect(() => { carregar(); }, [carregar]);

  const fazer = async (corpo: Record<string, unknown>) => {
    setMsg(null);
    try {
      const res = await agir(corpo);
      if (res && res.mensagem) setMsg(res.mensagem);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const tentarAlgumas = async () => {
    const travadas = itens.filter((t) => t.situacao === "travado").slice(0, 3);
    if (!travadas.length) return;
    if (!confirm(`Tentar de novo ${travadas.length} tarefa(s) travada(s)? As outras ficam esperando.`)) return;
    setMsg(null);
    for (const t of travadas) {
      try { await agir({ acao: "tentar", n: t.numero }); } catch (e) { setErro((e as Error).message); break; }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setMsg(`Mandei ${travadas.length} para a fila. Toque de novo para mandar mais 3.`);
    carregar();
  };

  const handleJulesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setJules(newValue);
    localStorage.setItem('cx-socorro-jules', JSON.stringify(newValue));
  };

  // #2718: o socorro passa pelo mesmo /api/pedidos (antes chamava /api/central/socorro, que não existe).
  const socorro = async () => {
    setSocorroMsg(null);
    setSocorroLinks([]);
    setSocorroStatus(null);
    try {
      const data = (await agir({ acao: "socorro", jules })) as unknown as { total: number; ias: number; jules: number; travadas: number; links: { numero: number; titulo: string }[]; assumiu?: { ia: string; numero: number; titulo?: string }[] };
      setSocorroMsg(data.total ? `Mandei ${data.total} tarefa(s): ${data.ias} para as IAs conectadas e ${data.jules} para o Jules.` : "Nenhuma tarefa travada precisava de ajuda agora.");
      setSocorroLinks(data.assumiu ? data.assumiu.map((a) => ({ numero: a.numero, titulo: `${a.ia} pegou: ${a.titulo || ''}` })) : data.links || []);
      setSocorroStatus(`Travadas olhadas: ${data.travadas}.`);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  // Botão de emergência: pausa a fila inteira (o que roda termina; nada novo começa).
  const emergencia = async (pausar: boolean) => {
    if (pausar && !confirm("Parar a fila do Cortex agora? O que já está rodando termina, mas nada novo começa.")) return;
    try { const r = await agir({ acao: pausar ? "pausar-fila" : "voltar-fila" }); setMsg(r.mensagem); } catch (e) { setErro((e as Error).message); }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Titulo t="Tarefas" s="A fila do Cortex, do jeito que ele enxerga." />
      <IasAgora />
      <QuemTrabalha />
      {avisos.length > 0 && <div className="rounded-xl bg-[var(--cx-ac)] text-black p-3 mb-4 text-sm font-semibold" role="status" data-testid="cx-avisos">{avisos.join(" · ")}</div>}
      <div className="mb-4">
        <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar tarefas..." data-testid="cx-tarefas-busca"
          className="w-full h-10 px-4 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-card)] text-sm text-[var(--cx-txt)] outline-none focus:border-[var(--cx-ac)]" />
      </div>
      <div className="flex items-center justify-between gap-2 mb-4 overflow-x-auto">
        <div className="flex gap-2">{FILTROS.map((x) => (
          <button key={x.id} onClick={() => setF(x.id)} data-testid={`cx-filtro-${x.id}`}
            className={`px-4 h-10 rounded-full text-sm border whitespace-nowrap ${f === x.id ? "bg-[var(--cx-ac)] text-black border-transparent font-semibold" : "border-[var(--cx-line)]"}`}>{x.nome}</button>))}</div>
        <button type="button" onClick={tentarAlgumas} data-testid="cx-tentar-algumas"
          className="h-10 px-4 rounded-xl bg-[var(--cx-ac)] text-black text-xs font-semibold shrink-0">Tentar travadas</button>
      </div>
      {(f === "travadas" || (f as string) === "travados") && itens.some((t) => t.situacao === "travado") && (
        <button type="button" onClick={tentarAlgumas} data-testid="cx-tentar-3"
          className="mb-4 h-11 px-5 rounded-xl bg-[var(--cx-ac)] text-black font-semibold">Tentar 3 travadas</button>
      )}
      {f === "travadas" && itens.length > 0 && (
        <button type="button" onClick={tentarAlgumas} data-testid="cx-tentar-travadas"
          className="w-full mb-4 h-11 rounded-xl bg-[var(--cx-ac)] text-black font-semibold text-sm flex items-center justify-center gap-2">
          Tentar novamente todas as travadas
        </button>
      )}
      <Cartao testid="cx-socorro">
        <p className="font-medium">Socorro</p>
        <button onClick={socorro} className="mt-3 w-full h-11 rounded-xl bg-[var(--cx-ac)] text-black font-semibold text-sm flex items-center justify-center gap-2">
          ⚡ Ativar ajuda das IAs
        </button>
        <div className="flex items-center gap-2 mt-3">
          <label className="text-sm">Incluir o Jules</label>
          <input type="checkbox" checked={jules} onChange={handleJulesChange} className="h-5 w-5" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button type="button" onClick={() => emergencia(true)} className="h-10 rounded-xl border border-red-400 text-red-500 text-sm font-semibold" data-testid="cx-parar-tudo">🛑 Parar tudo</button>
          <button type="button" onClick={() => emergencia(false)} className="h-10 rounded-xl border border-[var(--cx-line)] text-sm" data-testid="cx-voltar-rodar">▶ Voltar a rodar</button>
        </div>
        {socorroMsg && <p className="text-sm text-[var(--cx-ac)] mt-2">{socorroMsg}</p>}
        {socorroLinks.length > 0 && (
          <ul className="text-sm text-[var(--cx-mut)] list-disc pl-5 mt-2">
            {socorroLinks.map((link) => (
              <li key={link.numero}>
                <a href={`#${link.numero}`} className="text-[var(--cx-ac)] hover:underline">
                  #{link.numero} {link.titulo}
                </a>
              </li>
            ))}
          </ul>
        )}
        {socorroStatus && <p className="text-xs text-[var(--cx-mut)] mt-2">{socorroStatus}</p>}
      </Cartao>
      {erro && <p className="text-red-400 text-sm mb-2" role="alert">{erro}</p>}
      {msg && <p className="text-[var(--cx-ac)] text-sm mb-2" role="status">{msg}</p>}
      <ListaPedidos itens={itens} abrir={abrir} fazer={fazer} />
    </div>
  );
}

export function Artefatos({ abrir }: { abrir: (n: number) => void }) {
  const { listar, deploy, agir } = usePedidos();
  const [itens, setItens] = useState<Resumo[]>([]);
  const [d, setD] = useState<Deploy | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const ver = useCallback(() => { deploy().then(setD).catch((e: Error) => setMsg(e.message)); }, [deploy]);
  useEffect(() => { ver(); listar("", "feitos", 1).then((r) => setItens(r.itens)).catch(() => undefined); }, [ver, listar]);
  const publicar = async () => { setMsg(null); try { setMsg((await agir({ acao: "publicar" })).mensagem); setTimeout(ver, 4000); } catch (e) { setMsg((e as Error).message); } };
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <Titulo t="Artefatos" s="O que o Cortex entregou e o que já está no ar." />
      <Cartao testid="cx-publicar">
        <p className="font-medium" data-testid="cx-publicar-situacao">{!d ? "Verificando…" : d.emAndamento ? "⏳ Publicando agora…" : d.falhou ? "🔴 A última publicação falhou." : d.mudancas ? `🟡 ${d.mudancas} mudança(s) ainda não estão no ar.` : "🟢 Tudo o que entrou já está no ar."}</p>
        {d && d.titulos.length > 0 && <ul className="text-sm text-[var(--cx-mut)] list-disc pl-5 mt-2">{d.titulos.map((t) => <li key={t}>{t}</li>)}</ul>}
        <button disabled={!d || d.emAndamento || (!d.mudancas && !d.falhou)} onClick={() => confirm("Publicar o app novo no ar agora?") && publicar()} data-testid="cx-publicar-agora"
          className="mt-3 h-11 px-5 rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#7c6cf0] text-black font-semibold disabled:opacity-40">Publicar agora</button>
        {msg && <p className="text-sm text-[var(--cx-ac)] mt-2" role="status">{msg}</p>}
      </Cartao>
      <p className="text-sm font-medium">Entregues</p>
      <ListaPedidos itens={itens} abrir={abrir} />
    </div>
  );
}

// #833: avisos no celular (tarefa feita/travada e resumo das 8h). Web Push grátis pelo próprio servidor.
const b64ParaBytes = (b: string) => { const s = atob(b.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
function AvisosCelular() {
  const { agir } = usePedidos();
  const [msg, setMsg] = useState("");
  const pode = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ligar = async () => {
    try {
      setMsg("Ligando…");
      if ((await Notification.requestPermission()) !== "granted") { setMsg("O celular não deixou mostrar avisos. Libere nas configurações do Chrome."); return; }
      const reg = (await navigator.serviceWorker.getRegistration("/cortex")) || (await navigator.serviceWorker.register("/cortex-sw.js", { scope: "/cortex" }));
      const { chave } = (await agir({ acao: "avisos_chave" })) as unknown as { chave: string };
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ParaBytes(chave) }));
      await agir({ acao: "avisos_assinar", sub: sub.toJSON() });
      await agir({ acao: "avisos_testar" });
      setMsg("Pronto: você vai receber um aviso quando uma tarefa terminar ou travar, e um resumo às 8h.");
    } catch (e) { setMsg((e as Error).message || "Não consegui ligar os avisos."); }
  };
  return (
    <Cartao testid="cx-avisos"><p className="font-medium">Avisos no celular</p>
      <p className="text-sm text-[var(--cx-mut)] mt-1">{pode ? "Tarefa feita ou travada e resumo às 8h. Grátis." : "Este navegador não aceita avisos. Use o Chrome com o app instalado."}</p>
      {pode && <button onClick={ligar} className="mt-3 h-11 px-5 rounded-xl border border-[var(--cx-line)] text-sm font-medium" data-testid="cx-avisos-ligar">Ligar avisos</button>}
      {msg && <p className="text-sm mt-2" role="status">{msg}</p>}
    </Cartao>
  );
}

export function Config({ tema, mudarTema, email, instalar, sair }: { tema: Tema; mudarTema: (t: Tema) => void; email: string; instalar: (() => void) | null; sair: () => void }) {
  const op: { id: Tema; nome: string }[] = [{ id: "auto", nome: "Automático" }, { id: "escuro", nome: "Escuro" }, { id: "claro", nome: "Claro" }];
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-3">
      <Titulo t="Configurações" s={email} />
      <Cartao><p className="font-medium mb-3">Aparência</p>
        <div className="flex gap-2">{op.map((o) => (
          <button key={o.id} onClick={() => mudarTema(o.id)} data-testid={`cx-tema-${o.id}`}
            className={`flex-1 h-11 rounded-xl border text-sm ${tema === o.id ? "border-[var(--cx-ac)] bg-[var(--cx-hover)] font-semibold" : "border-[var(--cx-line)]"}`}>{o.nome}</button>))}</div></Cartao>
      <Cartao><p className="font-medium">App no celular</p>
        <p className="text-sm text-[var(--cx-mut)] mt-1">{instalar ? "Instale o Cortex na tela inicial." : "No Chrome do celular: menu ⋮ → Instalar app (ou Adicionar à tela inicial)."}</p>
        {instalar && <button onClick={instalar} className="mt-3 h-11 px-5 rounded-xl bg-[var(--cx-ac)] text-black font-semibold" data-testid="cx-instalar">Instalar app</button>}</Cartao>
      <AvisosCelular />
      <Cartao><a href="/central" className="block font-medium">Central KERNEX</a><p className="text-sm text-[var(--cx-mut)] mt-1">Vendas, produtos e divulgação.</p></Cartao>
      <button onClick={sair} className="w-full h-12 rounded-xl border border-[var(--cx-line)] text-red-400" data-testid="cx-sair">Sair</button>
    </div>
  );
}
