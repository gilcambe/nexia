import { useState } from "react";
import type { Vaga, Vagas, VagaTeste } from "./api";
import { useCentral, haQuanto } from "./api";
import Logo from "./Logo";

// Conectar IAs (#1958, #2716): 50 vagas de chave grátis que ajudam o Cortex quando ele trava.
// A chave é testada na hora e vira segredo criptografado do GitHub; nunca volta para esta página.
type Estado = "verde" | "amarelo" | "vermelho" | "cinza";
const PILULA: Record<Estado, string> = {
  verde: "bg-emerald-50 text-emerald-700", amarelo: "bg-amber-50 text-amber-700", vermelho: "bg-red-50 text-red-700", cinza: "bg-slate-100 text-slate-500",
};
const PONTO: Record<Estado, string> = { verde: "bg-emerald-500", amarelo: "bg-amber-400", vermelho: "bg-red-500", cinza: "bg-slate-300" };

export function estadoVaga(v: Vaga): { e: Estado; texto: string } {
  if (!v.ligada) return { e: "cinza", texto: "Vazia" };
  const t = v.teste;
  if (!t) return { e: "amarelo", texto: "Salva, ainda não testada" };
  if (t.situacao === "ok") return { e: "verde", texto: "Funcionando" };
  if (t.situacao === "sem-cota") return { e: "amarelo", texto: "Cota de hoje acabou" };
  if (t.situacao === "recusada") return { e: "vermelho", texto: "Chave recusada" };
  return { e: "vermelho", texto: "Não respondeu" };
}

const segundos = (t: VagaTeste) => `${(t.tempo / 1000).toFixed(1).replace(".", ",")} s`;

function Pilula({ e, children }: { e: Estado; children: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${PILULA[e]}`}><span className={`w-1.5 h-1.5 rounded-full ${PONTO[e]}`} />{children}</span>;
}

const BOTAO = "inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-medium min-h-[40px] cursor-pointer disabled:opacity-50";

function CartaoVaga({ v, dados, aoMudar }: { v: Vaga; dados: Vagas; aoMudar: () => Promise<void> }) {
  const { agir } = useCentral();
  const [editando, setEditando] = useState(!v.ligada);
  const [provedor, setProvedor] = useState(v.provedor || "");
  const [chave, setChave] = useState("");
  const [url, setUrl] = useState("");
  const [modelo, setModelo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const p = dados.provedores.find((x) => x.id === (editando ? provedor : v.provedor));
  const est = estadoVaga(v);

  const salvar = async () => {
    setOcupado(true); setMsg(null);
    try {
      const r = await agir<{ ok: boolean; mensagem: string }>({ acao: "vaga-salvar", vaga: v.vaga, provedor, chave, ...(p && p.custom ? { url, modelo } : {}) });
      setMsg({ ok: r.ok, texto: r.mensagem });
      if (r.ok) { setChave(""); setEditando(false); await aoMudar(); }
    } catch (e) { setMsg({ ok: false, texto: (e as Error).message }); }
    setChave(""); // a chave sai da memória da página depois de cada tentativa
    setOcupado(false);
  };
  const apagar = async () => {
    if (!window.confirm(`Desligar a vaga ${v.vaga} e apagar a chave guardada?`)) return;
    setOcupado(true); setMsg(null);
    try { const r = await agir({ acao: "vaga-apagar", vaga: v.vaga }); setMsg({ ok: true, texto: r.mensagem }); setEditando(true); setProvedor(""); await aoMudar(); }
    catch (e) { setMsg({ ok: false, texto: (e as Error).message }); }
    setOcupado(false);
  };

  return (
    <li className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 space-y-3" data-testid={`vaga-${v.vaga}`}>
      <div className="flex items-center gap-3">
        {p ? <Logo nome={p.nome} src={p.logo} tam={40} /> : <span className="w-10 h-10 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 font-bold">{v.vaga}</span>}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900">Vaga {v.vaga}{v.ligada && p ? ` · ${p.nome}` : ""}</div>
          <div className="text-xs text-slate-500 truncate">
            {v.ligada && v.teste ? `${v.teste.situacao === "ok" ? `respondeu em ${segundos(v.teste)}` : v.teste.motivo || "sem resposta"} · testada ${haQuanto(v.teste.em)}${v.teste.onde === "robo" ? " pelo robô" : ""}`
              : v.ligada ? `salva ${haQuanto(v.salvaEm)}` : "Escolha uma IA grátis e cole a chave"}
          </div>
        </div>
        <Pilula e={est.e}>{est.texto}</Pilula>
      </div>

      {v.ligada && !editando && (
        <>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600" data-testid={`vaga-${v.vaga}-uso`}>
            {v.usos.length ? (
              <ul className="space-y-1">
                {v.usos.slice(0, 3).map((u) => (
                  <li key={u.pr}>✅ Ajudou o Cortex: <a className="text-indigo-600 font-medium" href={u.link} target="_blank" rel="noopener noreferrer">PR #{u.pr}</a>{u.tarefa ? ` (tarefa #${u.tarefa})` : ""} {haQuanto(u.quando)}{u.entrou ? " · entrou no app" : ""}</li>
                ))}
              </ul>
            ) : "Ainda não precisou ajudar: entra sozinha quando uma tarefa do Cortex trava e o Jules não resolve."}
          </div>
          <div className="flex flex-wrap gap-2">
                      <button className={`${BOTAO} border border-slate-200 bg-white text-slate-700`} onClick={() => { setEditando(true); setMsg(null); }} disabled={ocupado} data-testid={`vaga-${v.vaga}-trocar`}>Trocar chave</button>
          <button className={`${BOTAO} border border-red-200 bg-white text-red-600`} onClick={apagar} disabled={ocupado} data-testid={`vaga-${v.vaga}-apagar`}>Desligar</button>
          <button className={`${BOTAO} border border-slate-200 bg-white text-slate-700`} onClick={() => onPause(v.vaga, !v.paused)} disabled={ocupado} data-testid={`vaga-${v.vaga}-pausar`}>
            {v.paused ? 'Ligar' : 'Pausar'}
          </button>
          <button className={`${BOTAO} border border-slate-200 bg-white text-slate-700 ml-2`} onClick={() => onOrder(v.vaga, 'up')} disabled={ocupado} data-testid={`vaga-${v.vaga}-up`}>↑</button>
          <button className={`${BOTAO} border border-slate-200 bg-white text-slate-700 ml-2`} onClick={() => onOrder(v.vaga, 'down')} disabled={ocupado} data-testid={`vaga-${v.vaga}-down`}>↓</button>
          </div>
        </>
      )}

      {editando && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`IA da vaga ${v.vaga}`}>
            {dados.provedores.map((x) => (
              <button key={x.id} role="radio" aria-checked={provedor === x.id} onClick={() => setProvedor(x.id)} data-testid={`vaga-${v.vaga}-${x.id}`}
                className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm cursor-pointer ${provedor === x.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700"}`}>
                <Logo nome={x.nome} src={x.logo} tam={22} />{x.nome.replace(" (modelos grátis)", "")}
              </button>
            ))}
          </div>
          {p && (
            <ol className="text-xs text-slate-600 list-decimal pl-5 space-y-0.5">
              {p.passos.map((s) => <li key={s}>{s}</li>)}
              <li>Cole a chave aqui embaixo e toque em "Testar e salvar".</li>
            </ol>
          )}
          {p && p.custom && (
            <div className="flex flex-col sm:flex-row gap-2" data-testid={`vaga-${v.vaga}-custom`}>
              <input type="url" inputMode="url" autoComplete="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Endereço da API (https://…/v1)"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 min-h-[40px]" aria-label={`Endereço da API da vaga ${v.vaga}`} data-testid={`vaga-${v.vaga}-url`} />
              <input type="text" autoComplete="off" spellCheck={false} value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Nome do modelo"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 min-h-[40px]" aria-label={`Modelo da vaga ${v.vaga}`} data-testid={`vaga-${v.vaga}-modelo`} />
            </div>
          )}
          {p && p.site && <a className="text-xs font-medium text-indigo-600" href={p.site} target="_blank" rel="noopener noreferrer">Abrir {p.nome} para pegar a chave ↗</a>}
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="password" autoComplete="off" spellCheck={false} value={chave} onChange={(e) => setChave(e.target.value)} placeholder="Cole a chave aqui"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 min-h-[40px]" aria-label={`Chave da vaga ${v.vaga}`} data-testid={`vaga-${v.vaga}-chave`} />
            <button className={`${BOTAO} bg-indigo-600 text-[#fff]`} onClick={salvar} disabled={ocupado || !provedor || chave.trim().length < (p && p.custom ? 8 : 16) || (!!p && !!p.custom && (!/^https:\/\//.test(url.trim()) || !modelo.trim()))} data-testid={`vaga-${v.vaga}-salvar`}>
              {ocupado ? "Testando…" : "Testar e salvar"}
            </button>
            {v.ligada && <button className={`${BOTAO} border border-slate-200 bg-white text-slate-700`} onClick={() => { setEditando(false); setChave(""); }}>Cancelar</button>}
          </div>
        </div>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`} role="status">{msg.texto}</p>}
    </li>
  );
}

export default function ConectarIAs({ inicial }: { inicial?: Vagas }) {
  const { buscar, agir } = useCentral();
  const [dados, setDados] = useState<Vagas | undefined>(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [livresVisiveis, setLivresVisiveis] = useState(1);
  const [testando, setTestando] = useState(false);
  const atual = dados || inicial;
  const recarregar = async () => { try { setDados(await buscar("vagas")); } catch { /* fica o que já tinha */ } };
  const testar = async () => {
    setTestando(true); setAviso(null);
    try { setAviso((await agir({ acao: "vaga-testar" })).mensagem); setTimeout(recarregar, 90000); } catch (e) { setAviso((e as Error).message); }
    setTestando(false);
  };
  const ligadas = atual ? atual.vagas.filter((v) => v.ligada).length : 0;
  const verdes = atual ? atual.vagas.filter((v) => estadoVaga(v).e === "verde").length : 0;

  return (
    <section id="conectar-ias" className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5 space-y-4" data-testid="conectar-ias">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 text-lg">🔌 Conectar IAs</h2>
          <p className="text-sm text-slate-500">IAs grátis que entram sozinhas quando o Cortex trava. {atual ? `${ligadas} de ${atual.vagas.length} conectadas, ${verdes} funcionando.` : ""}</p>
        </div>
        {ligadas > 0 && <button className={`${BOTAO} border border-slate-200 bg-white text-slate-700`} onClick={testar} disabled={testando} data-testid="vagas-testar">{testando ? "Mandando…" : "🧪 Testar agora"}</button>}
      </div>
      {aviso && <p className="text-sm text-slate-700" role="status">{aviso}</p>}
      {atual?.jules && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4" data-testid="jules">
          <Logo nome="Jules" tam={40} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900">Jules (Google) · entra pela conta Google</div>
            <div className="text-xs text-slate-500">
              {atual.jules.ligado
                ? `${atual.jules.comEle ?? "?"} tarefa(s) com ele agora · ${atual.jules.prsHoje} PR(s) hoje${atual.jules.ultimoPr ? ` · último PR #${atual.jules.ultimoPr.numero} ${haQuanto(atual.jules.ultimoPr.quando)}` : ""}`
                : "Falta a chave JULES_API_KEY no Cloudflare (jules.google.com → Settings → API)."}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${atual.jules.ligado ? PILULA.verde : PILULA.amarelo}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${atual.jules.ligado ? PONTO.verde : PONTO.amarelo}`} />{atual.jules.ligado ? "Ligado" : "Falta ligar"}
          </span>
        </div>
      )}
      {!atual ? <div className="h-24 rounded-xl bg-slate-100 animate-pulse" /> : (
        <ul className="grid grid-cols-1 gap-3">
          {/* Vagas ligadas sempre aparecem; das livres, só uma por vez (o botão abaixo abre a próxima). */}
          {[...atual.vagas.filter((v) => v.ligada), ...atual.vagas.filter((v) => !v.ligada).slice(0, livresVisiveis)].map((v) => <CartaoVaga key={`${v.vaga}-${v.ligada}-${v.provedor}`} v={v} dados={atual} aoMudar={recarregar} />)}
        </ul>
      )}
      {atual && atual.vagas.length - ligadas > livresVisiveis && (
        <button className={`${BOTAO} w-full border-2 border-dashed border-slate-300 bg-white text-slate-600`} onClick={() => setLivresVisiveis((n) => n + 1)} data-testid="vagas-mais">
          + Conectar mais uma IA ({atual.vagas.length - ligadas - livresVisiveis} vagas livres)
        </button>
      )}
      <details className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700" data-testid="vagas-explica">
        <summary className="font-medium cursor-pointer">Por que não dá para entrar com a conta do ChatGPT, Claude ou Gemini?</summary>
        <div className="mt-2 space-y-2 text-xs text-slate-600">
          <p><b>Conta de chat (site):</b> ChatGPT, Claude.ai e Gemini são para uma pessoa conversar. Um robô entrando nelas sozinho é proibido pelos termos e pode bloquear a conta. Para usar essas contas, toque em "Copiar contexto" no cartão "Usar outra IA" e cole na conversa você mesmo.</p>
          <p><b>Chave de API (o que estas vagas usam):</b> é o "login" feito para robôs. Gemini, Groq, OpenRouter, Mistral, Codestral, NVIDIA, Cohere, Hugging Face, Z.ai e SambaNova dão chave grátis, sem cartão, com limite por dia. Quando o limite acaba, a vaga fica amarela e volta sozinha no dia seguinte.</p>
          <p><b>GPT e Claude por API</b> cobram por uso. Pela regra "nada pago", não entram aqui.</p>
          <p><b>Outra IA:</b> qualquer IA grátis com API no formato OpenAI (endereço + modelo + chave) entra em "Outra IA". Login de chat no site (ChatGPT, Gemini web) não dá para ligar: as regras desses sites proíbem robôs.</p>
          <p><b>3 iguais?</b> Pode pôr o mesmo serviço em mais de uma vaga se forem contas de verdade diferentes (por exemplo, de outra pessoa da equipe). Criar contas falsas só para fugir do limite vai contra os termos.</p>
          <p><b>Segurança:</b> a chave é testada, criptografada e guardada como segredo do GitHub. Ela nunca aparece de novo, nem aqui, nem no banco, nem nos registros.</p>
        </div>
      </details>
    </section>
  );
}
