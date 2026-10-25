import { useCallback, useEffect, useState } from 'react';
import { useCentral } from './api';
import type { Dados } from './api';
import { TEMPLATES } from '../../../nexia-ai/robots/templates';

interface Automacao {
  id: string;
  nome: string;
  descricao: string;
  templateId: string;
  schedule: any;
  ativa: boolean;
  ultimaExecucao?: Date;
}

export default function Automacoes({ d }: { d: Dados }) {
  const { buscar } = useCentral();
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [novaAutomacao, setNovaAutomacao] = useState({
    templateId: '',
    horario: '09:00',
    canal: 'email',
    ativa: true
  });

  useEffect(() => {
    // Simulação de carregar automações existentes
    // Na implementação real, isso viria da API
    const mockAutomacoes: Automacao[] = [
      {
        id: '1',
        nome: 'Resumo diário de pedidos',
        descricao: 'Envia um resumo com os pedidos do dia anterior',
        templateId: 'daily_report',
        schedule: { kind: 'daily', time: '09:00' },
        ativa: true,
        ultimaExecucao: new Date('2026-10-24T09:00:00Z')
      },
      {
        id: '2',
        nome: 'Aviso de pedido novo',
        descricao: 'Notifica quando um novo pedido é recebido',
        templateId: 'pedido_novo',
        schedule: { kind: 'hourly', minute: 0 },
        ativa: true,
        ultimaExecucao: new Date('2026-10-24T08:00:00Z')
      }
    ];
    setAutomacoes(mockAutomacoes);
    setCarregando(false);
  }, []);

  const handleCriarAutomacao = useCallback(async () => {
    if (!novaAutomacao.templateId) return;
    
    setCriando(true);
    
    try {
      const template = TEMPLATES.find(t => t.id === novaAutomacao.templateId);
      if (!template) return;
      
      const nova: Automacao = {
        id: Date.now().toString(),
        nome: template.name,
        descricao: template.description,
        templateId: template.id,
        schedule: novaAutomacao.horario.includes(':') 
          ? { kind: 'daily', time: novaAutomacao.horario }
          : { kind: 'hourly', minute: 0 },
        ativa: novaAutomacao.ativa,
        ultimaExecucao: new Date()
      };
      
      setAutomacoes(prev => [...prev, nova]);
      setNovaAutomacao({
        templateId: '',
        horario: '09:00',
        canal: 'email',
        ativa: true
      });
    } catch (error) {
      console.error('Erro ao criar automação:', error);
    } finally {
      setCriando(false);
    }
  }, [novaAutomacao]);

  const handleToggleAtiva = useCallback((id: string) => {
    setAutomacoes(prev => 
      prev.map(aut => 
        aut.id === id ? { ...aut, ativa: !aut.ativa } : aut
      )
    );
  }, []);

  const handleExcluir = useCallback((id: string) => {
    setAutomacoes(prev => prev.filter(aut => aut.id !== id));
  }, []);

  const getTemplateById = (id: string) => {
    return TEMPLATES.find(t => t.id === id);
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nexia-cyan"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">Minhas Automações</h2>
        <p className="text-nexia-muted text-sm">Configure automações recorrentes para seu negócio</p>
      </div>

      {/* Formulário de criação */}
      <div className="bg-nexia-surface rounded-lg p-4 border border-nexia-border">
        <h3 className="font-semibold mb-3">Criar Nova Automação</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Escolha o tipo</label>
            <select 
              value={novaAutomacao.templateId}
              onChange={(e) => setNovaAutomacao(prev => ({ ...prev, templateId: e.target.value }))}
              className="w-full bg-nexia-background border border-nexia-border rounded px-3 py-2 text-white"
            >
              <option value="">Selecione um tipo de automação</option>
              {TEMPLATES.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          
          {novaAutomacao.templateId && (
            <>
              <div className="text-sm text-nexia-muted bg-nexia-surface/50 p-3 rounded">
                {getTemplateById(novaAutomacao.templateId)?.description}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  {novaAutomacao.templateId === 'daily_report' ? 'Horário do resumo' : 'Horário da verificação'}
                </label>
                <input 
                  type="time" 
                  value={novaAutomacao.horario}
                  onChange={(e) => setNovaAutomacao(prev => ({ ...prev, horario: e.target.value }))}
                  className="w-full bg-nexia-background border border-nexia-border rounded px-3 py-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Canal de notificação</label>
                <select 
                  value={novaAutomacao.canal}
                  onChange={(e) => setNovaAutomacao(prev => ({ ...prev, canal: e.target.value }))}
                  className="w-full bg-nexia-background border border-nexia-border rounded px-3 py-2 text-white"
                >
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="ativa"
                  checked={novaAutomacao.ativa}
                  onChange={(e) => setNovaAutomacao(prev => ({ ...prev, ativa: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="ativa" className="text-sm">Ativar imediatamente</label>
              </div>
              
              <button 
                onClick={handleCriarAutomacao}
                disabled={criando || !novaAutomacao.templateId}
                className="w-full bg-nexia-cyan text-black py-2 px-4 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {criando ? 'Criando...' : 'Criar Automação'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lista de automações */}
      <div className="space-y-3">
        <h3 className="font-semibold">Suas Automações</h3>
        
        {automacoes.length === 0 ? (
          <div className="text-center py-8 text-nexia-muted">
            <p>Nenhuma automação configurada</p>
            <p className="text-sm mt-1">Crie sua primeira automação acima</p>
          </div>
        ) : (
          automacoes.map(aut => {
            const template = getTemplateById(aut.templateId);
            return (
              <div key={aut.id} className="bg-nexia-surface rounded-lg p-4 border border-nexia-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{aut.nome}</h4>
                      <span className={`px-2 py-1 text-xs rounded ${aut.ativa ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {aut.ativa ? 'Ativa' : 'Pausada'}
                      </span>
                    </div>
                    <p className="text-sm text-nexia-muted mb-2">{aut.descricao}</p>
                    <div className="text-xs text-nexia-muted">
                      <p>Executa: {aut.schedule.kind === 'daily' ? `todo dia às ${aut.schedule.time}` : 'a cada hora'}</p>
                      {aut.ultimaExecucao && (
                        <p>Última execução: {new Date(aut.ultimaExecucao).toLocaleString('pt-BR')}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleToggleAtiva(aut.id)}
                      className={`px-3 py-1 text-xs rounded ${aut.ativa ? 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30' : 'bg-nexia-cyan/20 text-nexia-cyan hover:bg-nexia-cyan/30'}`}
                    >
                      {aut.ativa ? 'Pausar' : 'Ativar'}
                    </button>
                    <button 
                      onClick={() => handleExcluir(aut.id)}
                      className="px-3 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}