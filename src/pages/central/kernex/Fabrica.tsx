import { useCallback, useEffect, useMemo, useState } from "react";
import { useCentral } from "../api";
import Bloco from "./Bloco";
import Kpi from "./Kpi";
import {
  PRECISA, ROTULO_STATUS, errosDaFicha, filtrarBiblioteca, grupos, limparFicha, modelosParaClonar, servidorSemFabrica, textoTempo,
  type Catalogo, type Consulta, type Ficha, type Status,
} from "./fabricaRegras";

// M5 (PC 2): Fábrica na Central nova. 3 abas: Novo sistema, Clonar projeto, Biblioteca.
// Fala com /api/central pelo contrato fixo (fabrica-catalogo, fabrica-consultar, fabrica-criar, fabrica-status, fabrica-publicar).
// Enquanto o servidor não tiver a Fábrica (M4), mostra o aviso "ainda não ligada" em vez de inventar número.
type Aba = "novo" | "clonar" | "biblioteca";
const ABAS: [Aba, string][] = [["novo", "Novo sistema"], ["clonar", "Clonar projeto"], ["biblioteca", "Biblioteca"]];
const FICHA_VAZIA: Ficha = { nome: "", ramo: "", cidade: "", whatsapp: "", precisa: ["site", "whatsapp"] };

export default function Fabrica() {
  const { ler, agir } = useCentral();
  const [aba, setAba] = useState<Aba>(() => (new URLSearchParams(window.location.search).get("aba") as Aba) || "novo");
  const [cat, setCat] = useState<Catalogo | null>(null);
  const [lidoEm, setLidoEm] = useState<string | null>(null);
  const [semServidor, setSemServidor] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    ler<Catalogo>("parte=fabrica-catalogo")
      .then((c) => { setCat(c); setLidoEm(new Date().toISOString()); })
      .catch((e) => { const m = (e as Error).message; if (servidorSemFabrica(m)) setSemServidor(true); else setErro(m); });
  }, [ler]);

  const trocarAba = (a: Aba) => {
    setAba(a);
    const u = new URL(window.location.href); u.searchParams.set("aba", a); window.history.replaceState(null, "", u.toString());
  };

  return (
    <div className="kx-tela" data-testid="kx-fabrica">
      <div className="kx-kpis">
        <Kpi cor="vd" icone="check" valor={cat ? cat.modulos.filter((m) => m.pronto).length : null} rotulo="Módulos prontos" sub="já testados" />
        <Kpi cor="az" icone="pasta" valor={cat ? cat.modelos.filter((m) => m.clonavel).length : null} rotulo="Projetos para clonar" />
        <Kpi cor="rx" icone="ia" valor={cat ? cat.modulos.reduce((s, m) => s + (m.testes || 0), 0) : null} rotulo="Testes automáticos" sub="somando a Biblioteca" />
      </div>
      {semServidor && <p className="kx-serve" data-testid="kx-fabrica-sem-servidor">A Fábrica ainda não está ligada no servidor. As telas já funcionam; os dados aparecem quando ela for ligada.</p>}
      {erro && <p className="kx-serve">Não deu para ler a Biblioteca: {erro}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }} role="tablist">
        {ABAS.map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} data-testid={`kx-fabrica-aba-${id}`}
            className="kx-btn" style={{ minHeight: 44, padding: "0 16px", fontWeight: aba === id ? 700 : 400, opacity: aba === id ? 1 : 0.75 }}
            onClick={() => trocarAba(id)}>{nome}</button>
        ))}
      </div>
      {aba === "novo" && <NovoSistema cat={cat} lidoEm={lidoEm} agir={agir} ler={ler} />}
      {aba === "clonar" && <Clonar cat={cat} lidoEm={lidoEm} agir={agir} ler={ler} />}
      {aba === "biblioteca" && <Biblioteca cat={cat} lidoEm={lidoEm} />}
    </div>
  );
}

type Api = { agir: ReturnType<typeof useCentral>["agir"]; ler: ReturnType<typeof useCentral>["ler"] };

function CamposFicha({ ficha, setFicha, comPrecisa = true }: { ficha: Ficha; setFicha: (f: Ficha) => void; comPrecisa?: boolean }) {
  const campo = (k: keyof Ficha, rotulo: string, dica: string) => (
    <label style={{ display: "grid", gap: 4 }}>
      <span>{rotulo}</span>
      <input className="kx-busca" style={{ minHeight: 44, fontSize: 16 }} value={String(ficha[k] || "")} placeholder={dica}
        data-testid={`kx-ficha-${k}`} onChange={(e) => setFicha({ ...ficha, [k]: e.target.value })} />
    </label>
  );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {campo("nome", "Nome do negócio", "Ex.: Clínica Sorriso")}
      {campo("ramo", "Ramo", "Ex.: dentista, viagens, estética")}
      {campo("cidade", "Cidade", "Ex.: Recife")}
      {campo("whatsapp", "WhatsApp (com DDI e DDD)", "Ex.: 5581999999999")}
      {campo("fotos", "Fotos do negócio (opcional, links https separados por vírgula)", "Ex.: https://site.com/foto1.jpg, https://site.com/foto2.jpg")}
      {comPrecisa && (
        <fieldset style={{ border: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <legend style={{ marginBottom: 6 }}>O que o sistema precisa</legend>
          {PRECISA.map(([id, nome]) => {
            const marcado = ficha.precisa.includes(id);
            return (
              <label key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }}>
                <input type="checkbox" checked={marcado} data-testid={`kx-precisa-${id}`}
                  onChange={() => setFicha({ ...ficha, precisa: marcado ? ficha.precisa.filter((x) => x !== id) : [...ficha.precisa, id] })} />
                {nome}
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}

/** Passo 3 comum: criar prévia, acompanhar, publicar (com confirmação). */
function CriarEPublicar({ ficha, modelo, agir, ler, pronto }: Api & { ficha: Ficha; modelo: string | null; pronto: boolean }) {
  const [id, setId] = useState<string | null>(null);
  const [st, setSt] = useState<Status | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const acompanhar = useCallback(async (novo: string) => {
    for (let i = 0; i < 60; i++) {
      try {
        const s = await ler<Status>(`parte=fabrica-status&id=${encodeURIComponent(novo)}`);
        setSt(s);
        if (s.status !== "gerando") return;
      } catch (e) { setMsg((e as Error).message); return; }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }, [ler]);

  const criar = async () => {
    setOcupado(true); setMsg(null); setSt(null);
    try {
      const r = await agir<{ id: string; status: Status["status"] }>({ acao: "fabrica-criar", ficha: limparFicha(ficha), modelo });
      setId(r.id); setSt({ status: r.status }); await acompanhar(r.id);
    } catch (e) { setMsg("Não deu certo: " + (e as Error).message); }
    setOcupado(false);
  };
  const publicar = async () => {
    if (!id || !window.confirm(`Publicar "${ficha.nome}" para todo mundo ver?`)) return;
    setOcupado(true);
    try {
      const r = await agir<{ endereco?: string; reserva?: string }>({ acao: "fabrica-publicar", id });
      setSt((s) => ({ ...(s || { status: "previa" }), status: "no-ar" }));
      if (r && r.endereco) setMsg(`Publicando (1 a 2 minutos): ${r.endereco}. Se o endereço ainda não abrir, use ${r.reserva}.`);
    }
    catch (e) { setMsg("Não deu certo: " + (e as Error).message); }
    setOcupado(false);
  };

  return (
    <div style={{ display: "grid", gap: 8 }} data-testid="kx-fabrica-criar">
      <button type="button" className="kx-btn" style={{ minHeight: 48 }} disabled={!pronto || ocupado} onClick={criar} data-testid="kx-fabrica-btn-criar">
        {ocupado && !st ? "Mandando…" : "Criar prévia"}
      </button>
      {st && <p data-testid="kx-fabrica-status"><b>{ROTULO_STATUS[st.status]}</b>{st.minutos != null ? ` · ${textoTempo(st.minutos)}` : ""}</p>}
      {st?.portoes && <ul className="kx-lista">{st.portoes.map((p) => <li key={p.nome}>{p.ok ? "✅" : "❌"} {p.nome}</li>)}</ul>}
      {st?.previa && <a href={st.previa} target="_blank" rel="noreferrer" data-testid="kx-fabrica-previa">Abrir a prévia</a>}
      {st?.status === "previa" && <button type="button" className="kx-btn" style={{ minHeight: 48 }} disabled={ocupado} onClick={publicar} data-testid="kx-fabrica-btn-publicar">Publicar</button>}
      {msg && <p className="kx-mut">{msg}</p>}
    </div>
  );
}

function NovoSistema({ cat, lidoEm, agir, ler }: Api & { cat: Catalogo | null; lidoEm: string | null }) {
  const [ficha, setFicha] = useState<Ficha>(FICHA_VAZIA);
  const [cons, setCons] = useState<Consulta | null>(null);
  const [consEm, setConsEm] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const erros = errosDaFicha(ficha);
  const g = grupos(cons);

  const consultar = async () => {
    setMsg(null); setCons(null);
    try { const r = await agir<Consulta>({ acao: "fabrica-consultar", ficha: limparFicha(ficha) }); setCons(r); setConsEm(new Date().toISOString()); }
    catch (e) { setMsg("Não deu certo: " + (e as Error).message); }
  };

  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
      <Bloco icone="lista" titulo="1. Ficha do sistema" ajuda="Poucos dados do negócio. A Fábrica procura o que já temos pronto antes de criar qualquer coisa." fonte={cat ? "Biblioteca" : null} atualizadoEm={lidoEm}>
        <CamposFicha ficha={ficha} setFicha={(f) => { setFicha(f); setCons(null); }} />
        {erros.length > 0 && <ul className="kx-mut" data-testid="kx-ficha-erros">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
        <button type="button" className="kx-btn" style={{ minHeight: 48, marginTop: 8 }} disabled={erros.length > 0} onClick={consultar} data-testid="kx-fabrica-btn-consultar">Ver o que já temos</button>
        {msg && <p className="kx-mut">{msg}</p>}
      </Bloco>
      <Bloco icone="check" titulo="2. O que já temos" ajuda="Verde: já pronto. Amarelo: temos parecido e vamos adaptar. Vermelho: o Cortex vai criar." fonte={cons ? "Buscador da Fábrica" : null} atualizadoEm={consEm}>
        {cons && (
          <div data-testid="kx-fabrica-consulta" style={{ display: "grid", gap: 8 }}>
            {cons.modelo && <p>Modelo sugerido: <b>{cons.modelo.nome}</b> <span className="kx-mut">({cons.modelo.porque})</span></p>}
            <p>✅ Já pronto: <b>{g.prontos}</b> · 🟡 Adaptar: <b>{g.adaptar}</b> · 🔴 Criar: <b>{g.criar}</b></p>
            <ul className="kx-lista">
              {cons.prontos.map((p) => <li key={p.id}>✅ {p.nome}</li>)}
              {cons.parecidos.map((p) => <li key={p.pedido}>🟡 {p.nome} <span className="kx-mut">({p.diferenca})</span></li>)}
              {cons.faltam.map((f) => <li key={f}>🔴 {f}</li>)}
            </ul>
            <p>Tempo estimado: <b>{textoTempo(cons.minutos)}</b></p>
            {cons.erros.length > 0 && <ul className="kx-mut">{cons.erros.map((e) => <li key={e}>{e}</li>)}</ul>}
          </div>
        )}
      </Bloco>
      <Bloco icone="foguete" titulo="3. Criar e publicar" ajuda="Cria a prévia sem publicar. Você confere o link e só depois aperta Publicar." fonte={cons ? "Fábrica" : null} atualizadoEm={consEm}>
        <CriarEPublicar ficha={ficha} modelo={cons?.modelo?.id || null} agir={agir} ler={ler} pronto={!!cons && cons.erros.length === 0} />
      </Bloco>
    </div>
  );
}

function Clonar({ cat, lidoEm, agir, ler }: Api & { cat: Catalogo | null; lidoEm: string | null }) {
  const [ficha, setFicha] = useState<Ficha>({ ...FICHA_VAZIA, precisa: ["site"] });
  const [modelo, setModelo] = useState<string | null>(null);
  const lista = useMemo(() => modelosParaClonar(cat, ficha.ramo), [cat, ficha.ramo]);
  const erros = errosDaFicha(ficha);
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
      <Bloco icone="troca" titulo="1. Escolha o projeto para copiar" ajuda="Copia a estrutura de um projeto pronto. Dados e fotos dos clientes de origem nunca são copiados." fonte={cat ? "Biblioteca" : null} atualizadoEm={lidoEm}>
        <ul className="kx-lista" data-testid="kx-clonar-lista">
          {lista.map((m) => (
            <li key={m.id}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
                <input type="radio" name="kx-modelo" checked={modelo === m.id} onChange={() => setModelo(m.id)} data-testid={`kx-clonar-${m.id}`} />
                <span><b>{m.nome}</b> <span className="kx-mut">{m.nichos.join(", ")}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </Bloco>
      <Bloco icone="lista" titulo="2. Dados do novo negócio" ajuda="Nome, ramo e contato do novo cliente." fonte={cat ? "Biblioteca" : null} atualizadoEm={lidoEm}>
        <CamposFicha ficha={ficha} setFicha={setFicha} comPrecisa={false} />
        {(erros.length > 0 || !modelo) && <ul className="kx-mut">{!modelo && <li>Escolha um projeto à esquerda.</li>}{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
      </Bloco>
      <Bloco icone="foguete" titulo="3. Criar e publicar" ajuda="Cria a prévia sem publicar. Você confere o link e só depois aperta Publicar." fonte={modelo ? "Fábrica" : null} atualizadoEm={lidoEm}>
        <CriarEPublicar ficha={ficha} modelo={modelo} agir={agir} ler={ler} pronto={!!modelo && erros.length === 0} />
      </Bloco>
    </div>
  );
}

function Biblioteca({ cat, lidoEm }: { cat: Catalogo | null; lidoEm: string | null }) {
  const [q, setQ] = useState("");
  const r = filtrarBiblioteca(cat, q);
  return (
    <div className="kx-grade" style={{ gridTemplateColumns: "1fr" }}>
      <Bloco icone="arquivo" titulo="Biblioteca de módulos e projetos" ajuda="Tudo que já fizemos e está testado. O Cortex usa daqui antes de criar algo novo." fonte={cat ? "Biblioteca" : null} atualizadoEm={lidoEm}>
        <input className="kx-busca" style={{ minHeight: 44, fontSize: 16, width: "100%" }} placeholder="Buscar por ramo (ex.: dentista, viagens)" value={q} onChange={(e) => setQ(e.target.value)} data-testid="kx-biblioteca-busca" />
        <h3 style={{ marginTop: 12 }}>Projetos ({r.modelos.length})</h3>
        <ul className="kx-lista" data-testid="kx-biblioteca-modelos">
          {r.modelos.map((m) => <li key={m.id}><b>{m.nome}</b> <span className="kx-mut">{m.clonavel ? "dá para clonar" : "não clonável"} · {m.nichos.join(", ")}</span></li>)}
        </ul>
        <h3 style={{ marginTop: 12 }}>Módulos ({r.modulos.length})</h3>
        <ul className="kx-lista" data-testid="kx-biblioteca-modulos">
          {r.modulos.map((m) => <li key={m.id}>{m.pronto ? "✅" : "🟡"} <b>{m.nome}</b> <span className="kx-mut">{m.faz} · de {m.origem} · {m.testes} testes</span></li>)}
        </ul>
      </Bloco>
    </div>
  );
}
