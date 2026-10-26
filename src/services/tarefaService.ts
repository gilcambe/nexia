import { createD1Driver } from '../../lib/firebase-lite/d1-backend';

const driver = createD1Driver();

/** Classes internas leves que o provedor local aceita. */
export const CLASSES_LEVES = ['classificar', 'resumir', 'título'];

export function classeValida(classe: string): classe is (typeof CLASSES_LEVES)[number] {
  return CLASSES_LEVES.includes(classe);
}

/** Insere uma tarefa local com status 'pendente' e retorna seu id. */
export async function criarTarefaLocal(params: {
  classe: string;
  payload: unknown;
}): Promise<string> {
  if (!classeValida(params.classe)) {
    throw new Error(`Classe não permitida pelo provedor local: ${params.classe}`);
  }
  const id = crypto.randomUUID();
  await driver.run(
    `INSERT INTO tarefas_locais (id, classe, payload, status, criado_em)
     VALUES (?, ?, ?, 'pendente', datetime('now'))`,
    [id, params.classe, JSON.stringify(params.payload)]
  );
  return id;
}

/** Atualiza o status de uma tarefa local. */
export async function atualizarStatusTarefa(id: string, status: string): Promise<void> {
  await driver.run(`UPDATE tarefas_locais SET status = ? WHERE id = ?`, [status, id]);
}

/** Busca uma tarefa local pelo id. */
export async function obterTarefaLocal(id: string): Promise<any | null> {
  const linhas = await driver.query(`SELECT * FROM tarefas_locais WHERE id = ?`, [id]);
  return linhas.length ? linhas[0] : null;
}

/** Marca como 'cancelado' as tarefas pendentes mais velhas que o limite (minutos). */
export async function cancelarTarefasAntigas(minutos: number): Promise<number> {
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 1440) {
    throw new Error(`minutos inválido para cancelarTarefasAntigas: ${minutos}`);
  }
  const resultado = await driver.run(
    `UPDATE tarefas_locais SET status = 'cancelado'
     WHERE status = 'pendente'
       AND criado_em <= datetime('now', ? || ' minutes')`,
    [`-${minutos}`]
  );
  return resultado.changes ?? 0;
}
