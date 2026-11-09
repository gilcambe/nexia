import { useCallback, useEffect, useState } from "react";
import { usePedidos } from "../../meu-cortex/api";
import Bloco from "./Bloco";
import Icone from "./Icone";
import Kpi from "./Kpi";
import { COR_ESTADO, haQuanto } from "./regras";

// 09/11 (dono): "KD ONDE EU PEÇO AS COISAS DIRETO PELA CENTRAL". Tela própria no menu: escreve, manda,
// e acompanha cada pedido (na fila, fazendo, travado, feito) sem perguntar a ninguém.
interface Item { numero: number; titulo: string; texto?: string; icone?: string; cor?: string; estado?: string; quando: string; link: string; motivo?: string }

export default function Pedir() {
  const { listar, agir } = usePedidos();
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [itens, setItens] = useState<Item[] | null>(null);
  const [em, setEm] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    try { const r = await listar("", "meus", 1); setItens(r.itens as unknown as Item[]); setEm(new Date().toISOString()); } catch (e) { setMsg((e as Error).message); setItens([]); }
  }, [listar]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);
  const mandar = async () => {
    const t = texto.trim();
    if (t.length < 3) { setMsg("Escreva o seu pedido ou a sua pergunta."); return; }
    setOcupado(true);
    try {
      const r = await agir({ acao: "pedir", texto: t }) as { mensagem: string; resposta?: boolean };
      // Pergunta de status: a Central responde na hora (não vira tarefa).
      setMsg(r.resposta ? r.mensagem : r.mensagem + " Ele aparece na lista ao lado."); setTexto(""); carregar();
    } catch (e) { setMsg("Não deu certo: " + (e as Error).message); }
    setOcupado(false);
  };
  const lista = itens || [];
  const conta = (e: string) => lista.filter((x) => x.estado === e).length;
  return (
    <div className="kx-tela">
      <div className="kx-kpis" data-testid="kx-kpis-pedir">
        <Kpi cor="az" icone="lista" valor={itens ? conta("fila") + conta("aguardando-ia") : null} rotulo="Esperando a vez" />
        <Kpi cor="rx" icone="raio" valor={itens ? conta("andamento") : null} rotulo="Sendo feitos agora" />
        <Kpi cor="lj" icone="alerta" valor={itens ? conta("travada") : null} rotulo="Travados" sub="as IAs tentam de novo" />
        <Kpi cor="vd" icone="check" valor={itens ? conta("concluida") : null} rotulo="Prontos" />
      </div>
      <div className="kx-grade" style={{ gridTemplateColumns: "2fr 3fr" }}>
        <Bloco className="kx-assist" icone="enviar" corIcone="#a5b4fc" titulo="Pedir ao Cortex" ajuda="Escreva em português o que você quer. Vira uma tarefa na fila; as IAs grátis fazem e a Central mostra o andamento." fonte="fila do Cortex (issues cortex-fila)" atualizadoEm={null}>
          <ol style={{ margin: "0 0 8px", paddingLeft: 20, color: "#c7d2f0" }}>
            <li>Escreva o que você quer, do seu jeito (ex.: "no Body Coach, o botão Entrar não funciona no celular").</li>
            <li>Toque em "Mandar para o Cortex".</li>
            <li>Acompanhe ao lado. Quando ficar "Pronto", já está no ar.</li>
          </ol>
          <textarea data-testid="kx-pedir-texto" placeholder="Digite seu pedido…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Seu pedido" style={{ minHeight: 120 }} />
          <button type="button" className="kx-btn forte" style={{ justifyContent: "center", marginTop: 8, width: "100%" }} disabled={ocupado} onClick={mandar} data-testid="kx-pedir-mandar"><Icone nome="enviar" tam={16} />Mandar para o Cortex</button>
          {msg && <p className="kx-mut" style={{ whiteSpace: "normal" }}>{msg}</p>}
        </Bloco>
        <Bloco icone="lista" corIcone="#fb923c" titulo="Meus pedidos" ajuda="Tudo o que você pediu pela Central, do mais novo para o mais velho, com o estado de cada um." fonte={itens ? "issues do GitHub (pedidos feitos pela Central)" : null} atualizadoEm={em}>
          <ul className="kx-lista" data-testid="kx-meus">
            {lista.map((t) => (
              <li key={t.numero}>
                {t.texto && <span className="kx-selo" style={{ background: COR_ESTADO[t.cor || "cinza"] || "#64748b" }}>{t.icone} {t.texto}</span>}
                <span className="kx-titulo">#{t.numero} {t.titulo}</span>
                <span className="kx-mut">{haQuanto(t.quando)}</span>
                <a className="kx-btn" style={{ minHeight: 30 }} href={t.link} target="_blank" rel="noreferrer">Ver</a>
              </li>
            ))}
            {itens && !lista.length && <li className="kx-mut">Você ainda não pediu nada pela Central.</li>}
          </ul>
        </Bloco>
      </div>
    </div>
  );
}
