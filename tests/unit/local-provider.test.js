import { describe, it, expect, vi, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// --- stub do driver D1 ---
const linhasTarefas = [];
const linhasMaquinas = [];

vi.mock('../../lib/firebase-lite/d1-backend', () => ({
  createD1Driver: () => ({
    query: async (sql, params = []) => {
      if (sql.includes('ultimo_pulso >= datetime')) {
        const agora = Date.now();
        return linhasMaquinas.filter(m => new Date(m.ultimo_pulso).getTime() >= agora - 2 * 60 * 1000);
      }
      if (sql.includes('SELECT * FROM tarefas_locais WHERE id = ?')) {
        const id = params[0];
        return linhasTarefas.filter(t => t.id === id);
      }
      if (sql.includes('SELECT MAX(ultimo_pulso)')) {
        const maisNovo = linhasMaquinas.reduce((m, maq) => new Date(maq.ultimo_pulso) > m ? new Date(maq.ultimo_pulso) : m, new Date(0));
        return [{ ts: maisNovo }];
      }
      return [];
    },
    run: async (sql, params = []) => {
      if (sql.includes("INSERT INTO tarefas_locais")) {
        const [id, classe, payload] = params;
        linhasTarefas.push({ id, classe, payload, status: 'pendente', criado_em: new Date().toISOString() });
        return { changes: 1 };
      }
      if (sql.includes("UPDATE tarefas_locais SET status = 'cancelado' WHERE status = 'pendente'")) {
        let n = 0;
        for (const t of linhasTarefas) {
          if (t.status === 'pendente') { t.status = 'cancelado'; n++; }
        }
        return { changes: n };
      }
      if (sql.includes("UPDATE tarefas_locais SET status = ? WHERE id = ?")) {
        const [status, id] = params;
        const t = linhasTarefas.find(x => x.id === id);
        if (t) t.status = status;
        return { changes: 1 };
      }
      return { changes: 0 };
    }
  })
}));

import { ProvedorLocal } from '../../src/providers/local';
import { criarTarefaLocal, atualizarStatusTarefa, obterTarefaLocal } from '../../src/services/tarefaService';
import { pulsoRecente } from '../../src/utils/pulseChecker';

describe('provedor local', () => {
  beforeEach(() => {
    linhasTarefas.length = 0;
    linhasMaquinas.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('insere tarefa e retorna imediatamente com id', async () => {
    const provedor = new ProvedorLocal();
    const inicio = Date.now();
    const resultado = await provedor.executar({ classe: 'classificar', payload: { texto: 'oi' } });
    const duracao = Date.now() - inicio;
    assert.ok(resultado.id);
    assert.ok(duracao < 1000, 'não deve bloquear esperando');
    const tarefa = await obterTarefaLocal(resultado.id);
    assert.strictEqual(tarefa.status, 'pendente');
  });

  it('rejeita classe não leve', async () => {
    const provedor = new ProvedorLocal();
    await assert.rejects(
      provedor.executar({ classe: 'treinar-modelo', payload: {} }),
      /não permitida/
    );
  });

  it('marca cancelado após 90 s sem pulso recente', async () => {
    const provedor = new ProvedorLocal();
    await provedor.executar({ classe: 'resumir', payload: { texto: 'x' } });
    // sem máquina com pulso -> cancela no primeiro ciclo
    await vi.advanceTimersByTimeAsync(95_000);
    // forçar checagem do loop (já rodou em background)
    await new Promise(r => setTimeout(r, 0));
    const id = linhasTarefas[0].id;
    const tarefa = await obterTarefaLocal(id);
    assert.strictEqual(tarefa.status, 'cancelado');
  });

  it('muda para rodando com pulso e feito ao receber resultado', async () => {
    linhasMaquinas.push({ id: 'maq-1', ultimo_pulso: new Date().toISOString() });
    const provedor = new ProvedorLocal();
    const resultado = await provedor.executar({ classe: 'título', payload: { texto: 'x' } });

    // simula pulso recente detectado pelo loop
    await vi.advanceTimersByTimeAsync(2_500);
    await new Promise(r => setTimeout(r, 0));
    let tarefa = await obterTarefaLocal(resultado.id);
    assert.strictEqual(tarefa.status, 'rodando');

    // simula recebimento do resultado
    await atualizarStatusTarefa(resultado.id, 'feito');
    await vi.advanceTimersByTimeAsync(2_500);
    await new Promise(r => setTimeout(r, 0));
    tarefa = await obterTarefaLocal(resultado.id);
    assert.strictEqual(tarefa.status, 'feito');
  });

  it('detecta pulso recente nos últimos 2 minutos', async () => {
    linhasMaquinas.push({ id: 'maq-2', ultimo_pulso: new Date().toISOString() });
    assert.strictEqual(await pulsoRecente(), true);

    linhasMaquinas.length = 0;
    linhasMaquinas.push({ id: 'maq-3', ultimo_pulso: new Date(Date.now() - 3 * 60 * 1000).toISOString() });
    assert.strictEqual(await pulsoRecente(), false);
  });
});
