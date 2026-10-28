import { assert } from 'node:test';
import { existsSync } from 'fs';
import { LIGACOES, NOS } from '../../central/topologia.js';

export const tests = {
  'cada LIGACAO.fonte existe no disco': () => {
    for (const ligacao of LIGACOES) {
      assert(ligacao.fonte, 'LIGACAO sem fonte');
      assert(existsSync(ligacao.fonte), `Arquivo não existe no disco: ${ligacao.fonte}`);
    }
  },
  'cada de/para corresponde a um id valido em NOS': () => {
    const ids = new Set(NOS.map((n) => n.id));
    for (const ligacao of LIGACOES) {
      assert(ids.has(ligacao.de), `id de invalido: ${ligacao.de}`);
      assert(ids.has(ligacao.para), `id para invalido: ${ligacao.para}`);
    }
  },
  'garante ids unicos': () => {
    const ids = NOS.map((n) => n.id);
    assert(new Set(ids).size === ids.length, 'ids duplicados em NOS');
  },
  'confirma que o estado das maquinas e planejado': () => {
    for (const maquina of NOS) {
      assert.strictEqual(maquina.estado, 'planejado', `estado invalido para ${maquina.id}: ${maquina.estado}`);
    }
  },
};
