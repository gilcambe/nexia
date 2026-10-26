import { criarTarefaLocal, atualizarStatusTarefa, obterTarefaLocal, CLASSES_LEVES } from '../services/tarefaService';
import { pulsoRecente } from '../utils/pulseChecker';

const LIMITE_ESPERA_MS = 90_000; // até 90 s
const INTERVALO_VERIFICA_MS = 2_000;

export class ProvedorLocal {
  /**
   * Insere a tarefa na tabela 'tarefas_locais' (sem chamar URL externa),
   * inicia o loop de espera em segundo plano e retorna imediatamente o id.
   * Apenas classes internas leves são aceitas: classificar, resumir, título.
   */
  async executar(params: { classe: string; payload: unknown; actor?: { uid: string; role: string } }): Promise<{ id: string }> {
    if (!params.actor?.uid) {
      console.log('[local-provider] execução rejeitada sem autenticação', {
        classe: params.classe
      });
      throw new Error('Autenticação obrigatória para executar no provedor local.');
    }
    if (!CLASSES_LEVES.includes(params.classe)) {
      console.log('[local-provider] classe rejeitada', {
        classe: params.classe,
        aceitas: CLASSES_LEVES
      });
      throw new Error(`Classe não permitida pelo provedor local: ${params.classe}`);
    }

    const id = await criarTarefaLocal(params);
    console.log('[local-provider] tarefa inserida', {
      id,
      classe: params.classe,
      actor: params.actor?.uid
    });

    // Loop de espera não bloqueante: responde já com o id.
    this.aguardarResultado(id).catch(err => {
      console.error('[local-provider] erro no loop de espera', { id, erro: err.message });
    });

    return { id };
  }

  /**
   * Aguarda até LIMITE_ESPERA_MS verificando o status da tarefa.
   * - Pulso recente + pendente -> 'rodando'
   * - Sem pulso nos últimos 2 min -> 'cancelado' (não bloqueia)
   * - 'feito' ao receber resultado -> encerra
   * - Timeout 90 s ainda pendente -> 'cancelado'
   */
  private async aguardarResultado(id: string): Promise<void> {
    const limite = Date.now() + LIMITE_ESPERA_MS;

    while (Date.now() < limite) {
      const tarefa = await obterTarefaLocal(id);
      if (!tarefa) {
        console.log('[local-provider] tarefa não encontrada', { id });
        return;
      }
      if (tarefa.status === 'feito' || tarefa.status === 'cancelado') {
        console.log('[local-provider] tarefa finalizada', { id, status: tarefa.status });
        return;
      }

      const temPulso = await pulsoRecente();
      if (temPulso && tarefa.status === 'pendente') {
        await atualizarStatusTarefa(id, 'rodando');
        console.log('[local-provider] pulso detectado, tarefa rodando', { id });
      }

      if (!temPulso && tarefa.status === 'pendente') {
        await atualizarStatusTarefa(id, 'cancelado');
        console.log('[local-provider] sem pulso recente, tarefa cancelada', { id });
        return;
      }

      await new Promise(resolve => setTimeout(resolve, INTERVALO_VERIFICA_MS));
    }

    // Timeout: ainda pendente após 90 s.
    const tarefa = await obterTarefaLocal(id);
    if (tarefa && tarefa.status === 'pendente') {
      await atualizarStatusTarefa(id, 'cancelado');
      console.log('[local-provider] timeout 90 s, tarefa cancelada', { id });
    }
  }
}

export const provedorLocal = new ProvedorLocal();
