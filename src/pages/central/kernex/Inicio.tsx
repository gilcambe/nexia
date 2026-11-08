import { useCallback, useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import { useCentral } from "../api";
import Bloco from "./Bloco";
import { corSemaforo, haQuanto, type TelaId } from "./regras";

// #3219 parte 2: Início. Só número com fonte real; sem fonte, "sem dados".
interface Ias { ias: { nome: string; situacao: string; ativa: boolean; texto: string }[]; resumo: string; contagens: Record<string, number>; conferidoEm: string; origem: string }
interface Item { numero: number; titulo: string; texto?: string; motivo?: string; quando: string }
const COR = { verde: "#22c55e", amarelo: "#f59e0b", vermelho: "#ef4444" };
const RAPIDO = [
  { nome: "GitHub", href: "https://github.com/gilcambe/nexia" },
  { nome: "Firebase", href: "https://console.firebase.google.com/project/nexia-c8710" },
  { nome: "Cloudflare", href: "https://dash.cloudflare.com/" },
  { nome: "Google Drive", href: "https://drive.google.com/" },
  { nome: "Tailscale", href: "https://login.tailscale.com/admin/machines" },
  { nome: "Jules", href: "https://jules.google.com/" },
];

export default function Inicio({ irPara }: { irPara: (t: TelaId) => void }) {
  const { ias: pedirIas, listar } = usePedidos();
  const { buscar } = useCentral();
  const [ias, setIas] = useState<Ias | null>(null);
  const [precisa, setPrecisa] = useState<{ itens: Item[]; em: string } | null>(null);
  const [saude, setSaude] = useState<{ fora: number; total: number; em: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    setErro(null);
    const [a, b, c] = await Promise.allSettled([pedirIas<Ias>(), listar("", "precisa", 1), buscar("saude")]);
    if (a.status === "fulfilled") setIas(a.value); else setErro((a.reason as Error).message);
    if (b.status === "fulfilled") setPrecisa({ itens: (b.value.itens as unknown as Item[]).slice(0, 5), em: new Date().toISOString() });
    if (c.status === "fulfilled" && c.value && Array.isArray(c.value.produtos)) {
      const medidos = c.value.produtos.filter((p: { ok: boolean | null }) => p.ok !== null);
      setSaude({ fora: medidos.filter((p: { ok: boolean | null }) => p.ok === false).length, total: medidos.length, em: c.value.em || new Date().toISOString() });
    }
  }, [pedirIas, listar, buscar]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);

  const c = ias?.contagens || {};
  const sinal = corSemaforo({ precisa: c.precisaVoce || 0, travadas: c.travada || 0, servicosFora: saude?.fora || 0 });
  const fonteTarefas = ias ? ias.origem : null;
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "auto 1fr" }}>
      <Bloco className="kx-sinal-bloco" titulo="Como está tudo" ajuda="Verde: tudo certo. Amarelo: alguma tarefa travou. Vermelho: algo precisa de você ou um serviço caiu." fonte={fonteTarefas} atualizadoEm={ias?.conferidoEm || null}>
        <div className="kx-sinal" data-testid="kx-semaforo"><span className="kx-bola" style={{ background: COR[sinal.cor] }} /><b>{sinal.texto}</b></div>
        <p style={{ margin: "6px 0 0" }} data-testid="kx-resumo">{ias?.resumo}</p>
      </Bloco>
      <Bloco titulo="Tarefas hoje" ajuda="Tarefas sendo feitas agora e as que terminaram hoje." fonte={fonteTarefas} atualizadoEm={ias?.conferidoEm || null}>
        <p className="kx-num" style={{ color: "#3b82f6" }}>{(c.andamento || 0) + (c["aguardando-ia"] || 0)}</p><p className="kx-mut">em andamento · {c.concluida || 0} concluídas hoje</p>
      </Bloco>
      <Bloco titulo="Bloqueios" ajuda="Tarefas travadas e as que só você resolve." fonte={fonteTarefas} atualizadoEm={ias?.conferidoEm || null}>
        <p className="kx-num" style={{ color: "#f59e0b" }}>{c.travada || 0}</p><p className="kx-mut">travadas · {c.precisaVoce || 0} precisam de você</p>
      </Bloco>
      <Bloco titulo="Serviços no ar" ajuda="Sites e serviços conferidos de verdade. Cinza não entra na conta." fonte={saude ? "checagem real dos sites (parte saude)" : null} atualizadoEm={saude?.em || null}>
        <p className="kx-num" style={{ color: saude && saude.fora ? "#ef4444" : "#22c55e" }}>{saude ? `${saude.total - saude.fora} de ${saude.total}` : ""}</p><p className="kx-mut">{saude && saude.fora ? `${saude.fora} fora do ar` : "no ar"}</p>
      </Bloco>
      <Bloco titulo="Máquinas online" ajuda="PC 1 e PC 2 aparecem quando o Operário estiver instalado neles." fonte={null} atualizadoEm={null}>{null}</Bloco>
      <Bloco className="kx-largo" titulo="IAs agora" ajuda="Cada IA: trabalhando, parada, sem cota ou com erro." fonte={fonteTarefas} atualizadoEm={ias?.conferidoEm || null}>
        <ul className="kx-lista">{(ias?.ias || []).slice(0, 4).map((x) => <li key={x.nome}><span className="kx-bola" style={{ width: 10, height: 10, background: x.ativa ? "#22c55e" : x.situacao === "erro" ? "#ef4444" : x.situacao === "sem-cota" ? "#f59e0b" : "#64748b" }} /><b>{x.nome}</b><span className="kx-mut">{x.texto}</span></li>)}</ul>
      </Bloco>
      <Bloco titulo="Acesso rápido" ajuda="Abre cada serviço numa aba nova." fonte="links fixos" atualizadoEm={null}>
        <div className="kx-chips">{RAPIDO.map((r) => <a key={r.nome} className="kx-btn" href={r.href} target="_blank" rel="noreferrer">{r.nome}</a>)}</div>
      </Bloco>
      <Bloco className="kx-todo" titulo="Precisa de você" ajuda="Só o que depende de você. Clique para abrir." fonte={precisa ? "issues abertas que só o dono resolve" : null} atualizadoEm={precisa?.em || null}>
        {erro && <p className="kx-mut">Não consegui ler agora: {erro}</p>}
        {precisa && precisa.itens.length === 0 ? <p>Nada esperando você. 🎉</p> : (
          <ul className="kx-lista">{(precisa?.itens || []).map((t) => <li key={t.numero}><span className="kx-titulo">#{t.numero} {t.titulo}</span><span className="kx-mut">{haQuanto(t.quando)}</span><button type="button" className="kx-btn forte" onClick={() => irPara("tarefas")}>Abrir</button></li>)}</ul>
        )}
      </Bloco>
    </div>
  );
}

