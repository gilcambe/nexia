import { useState, useEffect } from "react";

import type { Dados } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Sinal, Botao, Carregando } from "./ui";

const REDE: Record<string, string> = { facebook: "Facebook", instagram: "Instagram" };

export default function Divulgar({ d, erro }: { d: Dados; erro?: string }) {
  const { agir } = useCentral();
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [weekly, setWeekly] = useState<any[]>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggleDisabled, setToggleDisabled] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/.netlify/functions/central/github?action=getWeekly')
      .then(r => {
        if (!r.ok) throw new Error('Falha ao carregar lista semanal');
        return r.json();
      })
      .then(data => {
        setWeekly(data);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);
  
  const handleToggle = async (index: number) => {
    if (!weekly || toggleDisabled) return;
    
    setLoading(true);
    setToggleDisabled(true);
    setError(null);
    
    try {
      const novoWeekly = [...weekly];
      const novoEstado = !novoWeekly[index].done;
      novoWeekly[index] = { ...novoWeekly[index], done: novoEstado };
      setWeekly(novoWeekly);
      
      const response = await agir({ acao: 'toggle', index, done: novoEstado });
      if (!response.success) {
        throw new Error(response.mensagem || 'Falha ao atualizar status');
      }
    } catch (err) {
      setError((err as Error).message);
      // Reverte a mudança local se falhar
      const novoWeekly = [...weekly];
      novoWeekly[index] = { ...novoWeekly[index], done: !novoWeekly[index].done };
      setWeekly(novoWeekly);
    } finally {
      setLoading(false);
      setToggleDisabled(false);
    }
  };
  const rodar = async (corpo: Record<string, unknown>) => {
    setOcupado(true); setMsg(null);
    try { setMsg((await agir(corpo)).mensagem); } catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };
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

      {loading ? (
        <Cartao titulo="Lista Semanal">
          <div className="flex items-center justify-center py-4">
            <Carregando texto="Carregando lista..." />
          </div>
        </Cartao>
      ) : error ? (
        <Cartao titulo="Lista Semanal">
          <div className="text-center py-4">
            <p className="text-red-500 text-sm mb-2">{error}</p>
            <Botao onClick={() => window.location.reload()} tipo="forte">Tentar novamente</Botao>
          </div>
        </Cartao>
      ) : weekly && weekly.length > 0 ? (
        <Cartao titulo="Lista Semanal">
          <p className="text-sm text-nexia-muted">Clique para marcar como feito/nãofeito. Salvo automaticamente.</p>
          {weekly && weekly.map((d, i) => (
            <div 
              key={i} 
              className={`daily-box ${d.done ? 'done' : ''}`}
              onClick={() => handleToggle(i)}
            >
              <span className="day-name">{d.day}</span>
              <span className="status-icon">{d.done ? '✅' : '❌'}</span>
            </div>
          ))}
        </Cartao>
      ) : weekly && weekly.length === 0 ? (
        <Cartao titulo="Lista Semanal">
          <p className="text-sm text-nexia-muted">Nenhum item na lista. Aguarde a carga inicial ou tente novamente.</p>
        </Cartao>
      ) : null}

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
