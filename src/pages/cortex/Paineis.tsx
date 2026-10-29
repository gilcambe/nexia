import { useCallback, useEffect, useState } from "react";
import ConfigLocalAI from "../../config.js";
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
      <li key={t.numero} className="flex items-center gap-2 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-card)] px-4 py-3 hover:border-[var(--cx-ac)]">
        <button onClick={() => abrir(t.numero)} className="flex-1 text-left" data-testid="cx-linha">
          <span className="text-xs text-[var(--cx-mut)]">#{t.numero} · {NOME_SITUACAO[t.situacao]} · {haQuanto(t.quando)}</span>
          <span className="block break-words mt-0.5">{t.titulo}</span>
        </button>
        {fazer && (
          <div className="flex items-center gap-2 shrink-0">
            {(t.situacao === "travado" || t.situacao === "fila" || t.situacao === "dividido") && (
              <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm(`Mandar o pedido #${t.numero} para o Jules? Ele abre o PR sozinho (sem juntar).`)) fazer({ acao: "jules", n: t.numero }); }} className="h-8 px-2.5 rounded-lg border border-[var(--cx-ac)] text-xs font-semibold" data-testid="cx-lista-jules">Mandar para o Jules</button>
            )}
            {t.situacao === "travado" && (
              <button type="button" onClick={(e) => { e.stopPropagation(); fazer({ acao: "tentar", n: t.numero }); }} className="h-8 px-2.5 rounded-lg bg-[var(--cx-ac)] text-black text-xs font-semibold" data-testid="cx-lista-tentar">Tentar de novo</button>
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

const FILTROS: { id: Filtro; nome: string }[] = [{ id: "todos", nome: "Todas" }, { id: "abertos", nome: "Andando" }, { id: "travados", nome: "Travadas" }, { id: "feitos", nome: "Feitas" }];

export function Tarefas({ abrir }: { abrir: (n: number) => void }) {
  const { listar, agir } = usePedidos();
  const [f, setF] = useState<Filtro>("abertos");
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [itens, setItens] = useState<Resumo[]>([]);
  const [erro, setErro] = useState<string>();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setBuscaDebounced(busca); }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(() => {
    setErro(undefined);
    listar(buscaDebounced, f, 1).then((r) => setItens(r.itens)).catch((e: Error) => setErro(e.message));
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

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Titulo t="Tarefas" s="A fila do Cortex, do jeito que ele enxerga." />
      <div className="mb-4">
        <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar tarefas..." data-testid="cx-tarefas-busca"
          className="w-full h-10 px-4 rounded-xl border border-[var(--cx-line)] bg-[var(--cx-card)] text-sm text-[var(--cx-txt)] outline-none focus:border-[var(--cx-ac)]" />
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto">{FILTROS.map((x) => (
        <button key={x.id} onClick={() => setF(x.id)} data-testid={`cx-filtro-${x.id}`}
          className={`px-4 h-10 rounded-full text-sm border ${f === x.id ? "bg-[var(--cx-ac)] text-black border-transparent font-semibold" : "border-[var(--cx-line)]"}`}>{x.nome}</button>))}</div>
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
  const [iaNoAparelho, setIaNoAparelho] = useState(false);
  const [bloqueio, setBloqueio] = useState<{ tipo: "webgpu" | "memoria" | null }>(null);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
  const podeWebGPU = typeof window !== "undefined" && typeof navigator.gpu === "object" && navigator.gpu !== null;
  const memoriaSuficiente = typeof navigator.deviceMemory === "number" ? navigator.deviceMemory >= 6 : true;
  const podeLigar = podeWebGPU && memoriaSuficiente;
  const ligarIaNoAparelho = () => {
    if (!podeLigar) return;
    setDownloadMsg("O Cortex vai baixar um modelo de IA (~1 GB) para rodar no seu aparelho, sem precisar de internet. É recomendado usar Wi-Fi para economizar dados.");
    setTimeout(() => setDownloadMsg(null), 8000);
  };
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-3">
      <Titulo t="Configurações" s={email} />
      <Cartao><p className="font-medium mb-3">Aparência</p>
        <div className="flex gap-2">{op.map((o) => (
          <button key={o.id} onClick={() => mudarTema(o.id)} data-testid={`cx-tema-${o.id`}
            className={`flex-1 h-11 rounded-xl border text-sm ${tema === o.id ? "border-[var(--cx-ac)] bg-[var(--cx-hover)] font-semibold" : "border-[var(--cx-line)]"}`}>{o.nome}</button>))}</div></Cartao>
      <Cartao><p className="font-medium">App no celular</p>
        <p className="text-sm text-[var(--cx-mut)] mt-1">{instalar ? "Instale o Cortex na tela inicial." : "No Chrome do celular: menu ⋮ → Instalar app (ou Adicionar à tela inicial)."}</p>
        {instalar && <button onClick={instalar} className="mt-3 h-11 px-5 rounded-xl bg-[var(--cx-ac)] text-black font-semibold" data-testid="cx-instalar">Instalar app</button>}</Cartao>
      <ConfigLocalAI />
      <AvisosCelular />
      <Cartao><a href="/central" className="block font-medium">Central KERNEX</a><p className="text-sm text-[var(--cx-mut)] mt-1">Vendas, produtos e divulgação.</p></Cartao>
      <button onClick={sair} className="w-full h-12 rounded-xl border border-[var(--cx-line)] text-red-400" data-testid="cx-sair">Sair</button>
    </div>
  );
}
