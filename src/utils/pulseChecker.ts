import { createD1Driver } from '../../lib/firebase-lite/d1-backend';

const driver = createD1Driver();

/**
 * Verdadeiro se alguma máquina enviou pulso nos últimos 2 minutos.
 * Usado pelo provedor local para decidir se aguarda ou cancela a tarefa.
 */
export async function pulsoRecente(): Promise<boolean> {
  const linhas = await driver.query(
    `SELECT id FROM maquinas WHERE ultimo_pulso >= datetime('now', '-2 minutes') LIMIT 1`
  );
  return linhas.length > 0;
}

/** Último pulso registrado em qualquer máquina (ms desde a época) ou null. */
export async function ultimoPulsoMs(): Promise<number | null> {
  const linhas = await driver.query(
    `SELECT MAX(ultimo_pulso) AS ts FROM maquinas`
  );
  const ts = linhas[0]?.ts;
  return ts ? new Date(String(ts)).getTime() : null;
}
