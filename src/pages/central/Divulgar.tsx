import { useState } from "react";
import { SEMANA, temaDoDia } from '../../lib/calendario';
import type { Dados } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Sinal, Botao, Carregando } from "./ui";

const REDE: Record<string, string> = { facebook: "Facebook", instagram: "Instagram" };
const HORARIOS = ["07h15", "12h15", "19h15"];

export default function Divulgar({ d, erro }: { d: Dados; erro?: string }) {
  const { agir } = useCentral();
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  
  // Posta na hora: usado pelos botões 07h15, 12h15 e 19h15 de cada tema da semana.
  // Função implementada conforme solicitado no pedido.
  const handlePostarAgora = async (horario: string, tema: string) => {
    if (!HORARIOS.includes(horario)) { setMsg("Horário inválido. Escolha 07h15, 12h15 ou 19h15."); return; }
    const textoTema = (tema || "").trim();
    if (!textoTema) { setMsg("Esse dia ainda não tem tema definido."); return; }
    setOcupado(true); setMsg(null);
    try {
      const r = await agir({ acao: "rodar", arquivo: "divulga.yml", horario, tema: textoTema });
      setMsg(r.mensagem || `Post sobre ${textoTema} enviado para ${horario}.`);
    } catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };
  
  const rodar = async (corpo: Record<string, unknown>) => {
    setOcupado(true); setMsg(null);
    try { setMsg((await agir(corpo)).mensagem); } catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };
  // Temas da semana com horários de postagem (07h15, 12h15 e 19h15)
  const temasSemana = SEMANA.map((dia, idx) => ({ dia, tema: temaDoDia(dia) }));

  const x = d.divulga;
  return (
    <div className="space-y-4">
      <Cartao titulo="Propaganda grátis">
        <p className="text-sm text-nexia-muted">O robô posta sozinho todo dia às 7h15, 12h15 e 19h15 no Facebook e no Instagram.</p>
        <div className="grid grid-cols-2 gap-2">
          <Botao onClick={() => rodar({ acao: "rodar", arquivo: "divulga.yml" })} disabled={ocupado} tipo="forte" testid="divulga-postar">📣 Postar agora</Botao>
          <Botao onClick={() => rodar({ acao: "rodar", arquivo: "divulga.yml", ensaio: true })} disabled={ocupado}>👀 Testar sem postar</Botao>
        </div>
        {msg && <p className="text-sm text-nexia-cyan" role="status">{msg}</p>}
      </Cartao>

      <Cartao titulo="Temas da semana">
        <p className="text-sm text-nexia-muted">Cada dia tem um tema. Escolha o hor\u00e1rio e o rob\u00f4 cria e publica o texto na hora.</p>
        <div className="divulga-themes space-y-2">
          {temasSemana.map((t, i) => (
            <div key={i} className="tema-item rounded-xl bg-nexia-surface2 p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium text-nexia-text">{t.dia}</span>
                <span aria-hidden="true" className="text-nexia-muted">\u2013</span>
                <span className="text-nexia-muted">{t.tema}</span>
              </div>
              <div className="horarios flex flex-wrap gap-2">
                {HORARIOS.map((horario) => (
                  <button
                    key={horario}
                    type="button"
                    onClick={() => handlePostarAgora(horario, t.tema)}
                    disabled={ocupado}
                    className="rounded-lg border border-nexia-border bg-nexia-surface px-3 py-1.5 text-xs font-medium text-nexia-text transition hover:border-nexia-cyan hover:text-nexia-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nexia-cyan disabled:cursor-not-allowed disabled:opacity-50"
                  >Postar {horario}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Cartao>

      {!x ? <Carregando erro={erro} /> : (
        <>
          <Cartao titulo="Últimos posts">
            {x.historico.length === 0 && <p className="text-sm text-nexia-muted">Nenhum post ainda.</p>}
            <ul className="space-y-2">
              {x.historico.map((h, k) => (
                <li key={k} className="rounded-xl bg-nexia-surface2 p-3 text-sm space-y-1">
                  <div className="flex justify-between gap-2"><span className="font-medium">{h.cliente}</span><span className="text-xs text-nexia-muted">{haQuanto(h.quando)}</span></div>
                  {h.resultados.map((r) => (
                    <div key={r.canal} className="flex items-start gap-2 text-xs">
                      <Sinal cor={r.ok ? "verde" : "vermelho"} />
                      <span>{REDE[r.canal] || r.canal}: {r.ok ? "publicado" : `não saiu${r.erro ? ` (${r.erro})` : ""}`}</span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </Cartao>
          <Cartao titulo={`Próximos posts (${x.naFila} na fila)`}>
            {x.proximos.length === 0 && <p className="text-sm text-nexia-muted">Fila vazia: o robô cria textos sozinho com a IA grátis.</p>}
            <ul className="space-y-2">
              {x.proximos.map((p) => <li key={p.id} className="rounded-xl bg-nexia-surface2 p-3 text-sm whitespace-pre-line">{p.texto || p.id}</li>)}
            </ul>
          </Cartao>
        </>
      )}

      <Cartao titulo="De onde vêm as visitas">
        <p className="text-sm text-nexia-muted">Cada post leva um link marcado com a rede de onde a pessoa veio (Instagram ou Facebook). As visitas aparecem no Google Search Console.</p>
        <Botao href="https://search.google.com/search-console">Ver visitas no Google</Botao>
      </Cartao>

      <Cartao titulo="Robô de ofertas">
        <p className="text-sm text-nexia-muted">Busca ofertas fitness na Shopee e na Amazon e monta a vitrine.</p>
        <div className="grid grid-cols-2 gap-2">
          <Botao onClick={() => rodar({ acao: "rodar", arquivo: "afiliados.yml" })} disabled={ocupado}>🛍️ Buscar ofertas</Botao>
          <Botao href="https://achados-nexia.pages.dev/">Ver vitrine</Botao>
        </div>
      </Cartao>

      <Cartao titulo="Rede de crescimento de seguidores (sem automação proibida)">
        <p className="text-sm text-nexia-muted">Roteiro diário de colaborações, enquetes e Reels com ganchos. O robô só prepara e agenda; a interação em massa nunca é automática (evita bloqueio da conta). Risco de banimento da conta é maior que o ganho. Custo 0.</p>
        <div className="space-y-3 text-sm text-nexia-muted pt-2">\n          <div className="rounded-xl bg-nexia-surface2 p-3 space-y-1">\n            <p className="font-medium text-nexia-text">1. Colaborações (Collabs)</p>\n            <p>Parcerias semanais com perfis do mesmo nicho. Publicação cruzada de Reels para alcançar novas audiências organicamente sem custo.</p>\n          </div>\n          <div className="rounded-xl bg-nexia-surface2 p-3 space-y-1">\n            <p className="font-medium text-nexia-text">2. Enquetes e Caixas de Perguntas</p>\n            <p>Engajamento diário nos Stories para reter seguidores e entender dores do público para novos conteúdos.</p>\n          </div>\n          <div className="rounded-xl bg-nexia-surface2 p-3 space-y-1">\n            <p className="font-medium text-nexia-text">3. Reels com Ganchos Fortes</p>\n            <p>Vídeos curtos focados nos primeiros 3 segundos (gancho de curiosidade ou dor imediata) e chamada para ação nos comentários.</p>\n          </div>\n          <div className="rounded-xl bg-nexia-surface2 p-3 space-y-1">\n            <p className="font-medium text-nexia-text">⚠️ Regra de Ouro da Segurança</p>\n            <p>O robô prepara os roteiros e materiais, mas a interação e postagem manual ou agendada respeitam os limites da plataforma. Interação em massa automatizada é proibida para evitar banimentos.</p>\n          </div>\n        </div>
      </Cartao>
    </div>
  );
}
