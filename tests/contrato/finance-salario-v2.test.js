'use strict';
// Contrato: Kernex Finance — SALÁRIO v2: vários recebimentos no mês + folha de ponto + previsão (dono 17/11:
// "recebo duas vezes ao mês... recebi o adiantamento e o 13º (o mensal não tá disponível). E ele não leu, leu só 1
// dos prints... quando eu colocar o print da folha de ponto ele estimar quanto receberei").
// Hoje: holerite_ler manda TODAS as imagens numa pergunta só (vem 1 resposta) e holerite_salvar grava 1 por mês (doc =
// mês), então o adiantamento e o 13º se apagam.
// Pedido: novo arquivo netlify/functions/prumo-lib/salario.js com agirSalario(acao, body, c) (devolve null se a ação
// não for dele), ligado em agirExtra (prumo-lib/extra.js) como os outros. Ações:
//  - 'salario_ler' { imagens, tipo: 'holerite' | 'ponto' }: valida com c.lerImagens (1 a 5); lê CADA imagem SEPARADA e
//    AO MESMO TEMPO (Promise.all), cada uma com 1 chamada a perguntarVisao(img, sistema). perguntarVisao =
//    c.deps.perguntarVisao se existir (testes), senão a mesma IA grátis com visão do holerite de hoje. Devolve
//    [200, { lidos: [...] }] com um item por imagem, na mesma ordem: { ok: true, pagamento } (holerite) |
//    { ok: true, ponto } (ponto) | { ok: false, erro }.
//    Holerite lido -> pagamento { tipo, mes, data_pagamento, bruto, liquido, salario_base, empresa, proventos, descontos }.
//    tipo ∈ 'adiantamento' | 'mensal' | 'decimo_terceiro_1' | 'decimo_terceiro_2' | 'ferias' | 'plr' | 'outro'; a IA
//    classifica pelo texto ("Adiant Quinzenal" -> adiantamento; "13º Salário - Adiantamento" -> decimo_terceiro_1).
//    Ponto lido -> ponto { mes, he50, he100, noturnas, faltas } (horas, número).
//  - 'pagamento_salvar': valida (mes AAAA-MM, data_pagamento AAAA-MM-DD, tipo da lista, liquido >= 0, bruto >= 0) e
//    grava na coleção 'pagamentos' com id `${mes}_${tipo}_${data_pagamento}` (o mesmo recebimento lido 2 vezes não
//    duplica). Se vier salario_base > 0, guarda também em config/salario (campo salario_base).
//  - 'pagamento_listar' { mes? }: [200, { pagamentos }] (do mês, ou todos), ordenados por data_pagamento.
//  - 'pagamento_apagar' { id }.
//  - 'ponto_salvar' { mes, he50, he100, noturnas, faltas }: grava em 'folhas_ponto' com id = mes ('pontos' é a coleção das MILHAS: não misturar).
//  - 'salario_config' { salario_base, dependentes, jornada_mensal }: grava em config/salario (junta com o que já tem);
//    sem campos, só devolve o que tem.
//  - 'salario_previsao' { mes }: [200, { mes, recebidos, total_recebido, previsao, motivo }] onde previsao =
//    require('./folha').estimarFechamento({ mes, salario_base, dependentes, jornada_mensal, ponto, recebidos }) com
//    config/salario e o ponto do mês. Sem salario_base -> previsao null e motivo 'Informe seu salário base...'.
//    Se já existe pagamento 'mensal' no mês -> previsao null e motivo dizendo que o mês já fechou.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');

function bancoFalso() {
  const dados = new Map();
  const col = (caminho) => ({
    doc: (id) => ({
      collection: (n) => col(`${caminho}/${id}/${n}`),
      set: async (v) => { dados.set(`${caminho}/${id}`, v); },
      delete: async () => { dados.delete(`${caminho}/${id}`); },
      get: async () => { const v = dados.get(`${caminho}/${id}`); return { exists: !!v, data: () => v }; },
    }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(caminho + '/') && !k.slice(caminho.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }),
  });
  return { collection: col, dados };
}
const IMG = (n) => `data:image/png;base64,${Buffer.from('img' + n).toString('base64')}`;
const ADIANT = { tipo: 'adiantamento', mes: '2026-11', data_pagamento: '2026-11-13', bruto: 4434.35, liquido: 4434.35, salario_base: 8868.69, empresa: 'Empresa X', proventos: [{ nome: 'Adiant Quinzenal', valor: 4434.35 }], descontos: [] };
const DECIMO = { tipo: 'decimo_terceiro_1', mes: '2026-11', data_pagamento: '2026-11-19', bruto: 5883.37, liquido: 5883.37, proventos: [{ nome: '13º Salário - Adiantamento', valor: 4434.35 }, { nome: 'Média adto 13º', valor: 1449.02 }], descontos: [] };
function preparar(respostas) {
  const banco = bancoFalso(); const pedidos = [];
  p.deps.db = () => banco;
  p.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  p.deps.perguntarVisao = async (img, sistema) => { pedidos.push({ img, sistema }); const r = respostas.shift(); return typeof r === 'string' ? r : JSON.stringify(r); };
  return { banco, pedidos };
}

test('salario_ler: cada imagem é lida SEPARADA (1 chamada por imagem) e volta 1 resultado por imagem', async () => {
  const { pedidos } = preparar([ADIANT, DECIMO]);
  const r = await p.agir('u1', { acao: 'salario_ler', tipo: 'holerite', imagens: [IMG(1), IMG(2)] });
  assert.equal(r[0], 200);
  assert.equal(pedidos.length, 2, 'uma chamada por imagem');
  assert.ok(pedidos.every((x) => x.img && !Array.isArray(x.img)), 'cada chamada leva UMA imagem');
  assert.equal(r[1].lidos.length, 2);
  assert.equal(r[1].lidos[0].pagamento.tipo, 'adiantamento');
  assert.equal(r[1].lidos[1].pagamento.tipo, 'decimo_terceiro_1');
  assert.equal(r[1].lidos[1].pagamento.liquido, 5883.37);
});

test('salario_ler: imagem que a IA não leu vira { ok:false }, as outras continuam', async () => {
  preparar(['não sei', ADIANT]);
  const r = await p.agir('u1', { acao: 'salario_ler', tipo: 'holerite', imagens: [IMG(1), IMG(2)] });
  assert.equal(r[1].lidos[0].ok, false);
  assert.equal(typeof r[1].lidos[0].erro, 'string');
  assert.equal(r[1].lidos[1].ok, true);
});

test('salario_ler tipo ponto: lê horas extras, noturnas e faltas', async () => {
  preparar([{ mes: '2026-11', he50: 10, he100: 2, noturnas: 0, faltas: 0 }]);
  const r = await p.agir('u1', { acao: 'salario_ler', tipo: 'ponto', imagens: [IMG(1)] });
  assert.deepEqual(r[1].lidos[0].ponto, { mes: '2026-11', he50: 10, he100: 2, noturnas: 0, faltas: 0 });
});

test('dois recebimentos no mesmo mês ficam guardados (não se apagam) e não duplicam', async () => {
  const { banco } = preparar([]);
  assert.equal((await p.agir('u1', { acao: 'pagamento_salvar', ...ADIANT }))[0], 200);
  assert.equal((await p.agir('u1', { acao: 'pagamento_salvar', ...DECIMO }))[0], 200);
  assert.equal((await p.agir('u1', { acao: 'pagamento_salvar', ...ADIANT }))[0], 200, 'o mesmo de novo');
  const l = await p.agir('u1', { acao: 'pagamento_listar', mes: '2026-11' });
  assert.equal(l[1].pagamentos.length, 2);
  assert.deepEqual(l[1].pagamentos.map((x) => x.data_pagamento), ['2026-11-13', '2026-11-19']);
  assert.equal(banco.dados.get('prumo_users/u1/config/salario').salario_base, 8868.69, 'salário base guardado');
  assert.equal((await p.agir('u1', { acao: 'pagamento_salvar', ...ADIANT, tipo: 'bonus_secreto' }))[0], 400);
  assert.equal((await p.agir('u1', { acao: 'pagamento_salvar', ...ADIANT, data_pagamento: '13/11' }))[0], 400);
});

test('salario_previsao: com adiantamento e ponto, prevê o fechamento (13º não desconta)', async () => {
  preparar([]);
  await p.agir('u1', { acao: 'pagamento_salvar', ...ADIANT });
  await p.agir('u1', { acao: 'pagamento_salvar', ...DECIMO });
  let r = await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' });
  assert.equal(r[0], 200);
  assert.equal(r[1].recebidos.length, 2);
  assert.ok(Math.abs(r[1].total_recebido - 10317.72) < 0.02);
  assert.ok(Math.abs(r[1].previsao.a_receber - 2187.81) < 0.02, 'sem ponto: 2.187,81');
  await p.agir('u1', { acao: 'ponto_salvar', mes: '2026-11', he50: 10, he100: 0, noturnas: 0, faltas: 0 });
  r = await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' });
  assert.ok(Math.abs(r[1].previsao.a_receber - 2759.64) < 0.02, 'com 10 h extras a 50%: 2.759,64');
});

test('salario_previsao: sem salário base pede o dado; com o mensal já pago diz que fechou', async () => {
  preparar([]);
  let r = await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' });
  assert.equal(r[1].previsao, null);
  assert.match(r[1].motivo, /salário base/i);
  await p.agir('u1', { acao: 'salario_config', salario_base: 8868.69 });
  await p.agir('u1', { acao: 'pagamento_salvar', ...ADIANT, tipo: 'mensal', data_pagamento: '2026-11-30', liquido: 2190 });
  r = await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' });
  assert.equal(r[1].previsao, null);
  assert.match(r[1].motivo, /fech/i);
});
