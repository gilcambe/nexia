import { useState, useEffect } from "react";
import { SEMANA, temaDoDia } from '../../lib/calendario';
import type { Dados } from "./api";
import { useCentral, haQuanto } from "./api";
import { Cartao, Sinal, Botao, Carregando } from "./ui";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Interface para os dados históricos de divulga-dados
interface DadosHistoricos {
  data: string;
  engajamento: number;
  horario: string;
  tema: string;
  canal: string;
}

interface MelhorHorarioTema {
  horario: string;
  tema: string;
  engajamentoMedio: number;
}

const REDE: Record<string, string> = { facebook: "Facebook", instagram: "Instagram" };
const HORARIOS = ["07h15", "12h15", "19h15"];

export default function Divulgar({ d, erro }: { d: Dados; erro?: string }) {
  const { agir } = useCentral();
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  
  // Estados para dados históricos e métricas
  const [dadosHistoricos, setDadosHistoricos] = useState<DadosHistoricos[]>([]);
  const [melhorHorarioTema, setMelhorHorarioTema] = useState<MelhorHorarioTema | null>(null);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [diasDisponiveis, setDiasDisponiveis] = useState(0);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(0);
  const [erroDados, setErroDados] = useState<string | null>(null);
  
  // Busca dados históricos do backend (últimos 30 dias)
  const buscarDadosHistoricos = async () => {
    try {
      const res = await fetch('/.netlify/functions/central/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buscarHistorico', periodo: 30 }),
      });
      const data = await res.json();
      if (data.success && data.dados) {
        // Limita aos últimos 30 dias ou ao período disponível
        const dadosLimitados = data.dados.slice(0, 30);
        setDadosHistoricos(dadosLimitados);
        setDiasDisponiveis(Math.min(data.diasDisponiveis || 0, 30));
        
        // Calcular melhor horário e tema
        const melhor = calcularMelhorHorarioTema(dadosLimitados);
        setMelhorHorarioTema(melhor);
      } else {
        console.error('Erro ao buscar dados históricos:', data.message);
      }
    } catch (err) {
      console.error('Falha ao buscar dados históricos:', err);
      setErroDados('Falha ao carregar dados de engajamento. Tente novamente mais tarde.');
    } finally {
      setCarregandoDados(false);
    }
  };
  
  // Calcula o melhor horário e tema com base nos dados históricos
  const calcularMelhorHorarioTema = (dados: DadosHistoricos[]): MelhorHorarioTema | null => {
    if (!dados || dados.length === 0) return null;
    
    // Agrupar por horário e tema
    const agrupado: Record<string, { totalEngajamento: number; contagem: number }> = {};
    
    dados.forEach(item => {
      const chave = `${item.horario}-${item.tema}`;
      if (!agrupado[chave]) {
        agrupado[chave] = { totalEngajamento: 0, contagem: 0 };
      }
      agrupado[chave].totalEngajamento += item.engajamento;
      agrupado[chave].contagem += 1;
    });
    
    // Encontrar o melhor horário e tema pela média de engajamento
    let melhorMedia = 0;
    let melhorHorario = '';
    let melhorTema = '';
    
    Object.entries(agrupado).forEach(([chave, dados]) => {
      const media = dados.totalEngajamento / dados.contagem;
      if (media > melhorMedia) {
        melhorMedia = media;
        [melhorHorario, melhorTema] = chave.split('-');
      }
    });
    
    return {
      horario: melhorHorario,
      tema: melhorTema,
      engajamentoMedio: melhorMedia
    };
  };
  
  // Carrega dados quando o componente montar
  useEffect(() => {
    buscarDadosHistoricos();
    
    // Marcar a visita para atualização automática
    setUltimaAtualizacao(Date.now());
  }, []);
  
  // Atualiza dados a cada visita do usuário (evita atualizações excessivas)
  useEffect(() => {
    const handleFocus = () => {
      // Verifica se passou mais de 5 minutos desde a última atualização
      if (Date.now() - ultimaAtualizacao > 5 * 60 * 1000) {
        buscarDadosHistoricos();
        setUltimaAtualizacao(Date.now());
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Verifica se passou mais de 5 minutos desde a última atualização
        if (Date.now() - ultimaAtualizacao > 5 * 60 * 1000) {
          buscarDadosHistoricos();
          setUltimaAtualizacao(Date.now());
        }
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ultimaAtualizacao]);
  

  
  // Posta na hora: usado pelos botões 07h15, 12h15 e 19h15 de cada tema da semana.
  // Função implementada conforme solicitado no pedido.
  const handlePostarAgora = async (horario: string, tema: string) => {
    try {
      const res = await fetch('/.netlify/functions/central/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'postarAgora', horario, tema }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Postagem agendada para ' + horario + ' com tema: ' + tema);
      } else {
        alert('Erro: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      alert('Falha na requisição');
    }
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

      {/* Gráfico de engajamento histórico */}
      <Cartao titulo="Engajamento Histórico">
        {carregandoDados ? (
          <div className="flex items-center justify-center py-8">
            <Carregando texto="Carregando dados de engajamento..." />
          </div>
        ) : dadosHistoricos.length > 0 ? (
          <div className="space-y-4">
            <div className="text-sm text-nexia-muted">
              <p>Exibindo dados dos últimos {diasDisponiveis} dias{diasDisponiveis < 30 ? ' (dados limitados)' : ''}</p>
              {melhorHorarioTema && (
                <p className="text-nexia-cyan mt-2">
                  🎯 Melhor horário: {melhorHorarioTema.horario} com tema "{melhorHorarioTema.tema}" 
                  (média: {melhorHorarioTema.engajamentoMedio.toFixed(1)})
                </p>
              )}
            </div>
            <div className="h-64">
              <Line 
                data={{
                  labels: dadosHistoricos.map(d => new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })),
                  datasets: [
                    {
                      label: 'Engajamento',
                      data: dadosHistoricos.map(d => d.engajamento),
                      borderColor: 'rgb(6, 182, 212)',
                      backgroundColor: 'rgba(6, 182, 212, 0.1)',
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: dadosHistoricos.map(d => {
                        // Destacar pontos com melhor horário/tema
                        if (melhorHorarioTema && d.horario === melhorHorarioTema.horario && d.tema === melhorHorarioTema.tema) {
                          return 'rgb(251, 191, 36)'; // Amarelo para destacar
                        }
                        return 'rgb(6, 182, 212)';
                      }),
                      pointRadius: dadosHistoricos.map(d => {
                        // Pontos maiores para melhor horário/tema
                        if (melhorHorarioTema && d.horario === melhorHorarioTema.horario && d.tema === melhorHorarioTema.tema) {
                          return 6;
                        }
                        return 4;
                      })
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const dataIndex = context.dataIndex;
                          const data = dadosHistoricos[dataIndex];
                          if (data) {
                            return [
                              `Engajamento: ${context.parsed.y}`,
                              `Horário: ${data.horario}`,
                              `Tema: ${data.tema}`,
                              `Canal: ${data.canal}`
                            ].join('\n');
                          }
                          return `Engajamento: ${context.parsed.y}`;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                      grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                  }
                }}
              />
            </div>
          </div>
        ) : erroDados ? (
          <div className="text-center py-4">
            <p className="text-sm text-nexia-erro">{erroDados}</p>
            <button 
              onClick={buscarDadosHistoricos}
              className="mt-2 text-sm text-nexia-cyan hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-nexia-muted">
              {diasDisponiveis === 0 
                ? "Nenhum dado de engajamento disponível nos últimos 30 dias."
                : "Carregando dados de engajamento..."}
            </p>
          </div>
        )}
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
                {['07h15', '12h15', '19h15'].map((horario) => (
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
