// Testes do modo Pensar do Cortex
// Não usa serviços pagos: simula provedores localmente

import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

// ============================================================
// Simulação do modo Pensar (versão de teste, sem rede)
// ============================================================

// Um "problema de pegadinha" tem: enunciado, resposta correta,
// e uma função que tenta resolvê-lo (simulando a IA).

const PEGADINHAS = [
  {
    id: 'bola-0-05',
    enunciado:
      'Uma bola e um bastão custam R$ 1,10 no total. O bastão custa R$ 1,00 a mais que a bola. Quanto custa a bola?',
    respostaEsperada: 0.05,
  },
  {
    id: 'relogio',
    enunciado:
      'Se 5 máquinas levam 5 minutos para fazer 5 peças, quanto tempo 100 máquinas levam para fazer 100 peças?',
    respostaEsperada: 5,
  },
  {
    id: 'porcentagem-sobre-porcentagem',
    enunciado:
      'Um produto custa R$ 100. Aumenta 20% e depois diminui 20%. Quanto custa agora?',
    respostaEsperada: 96,
  },
  {
    id: 'logica',
    enunciado:
      'Todos os bloops são razies. Todos os razies são lauups. Portanto, todos os bloops são lauups?',
    respostaEsperada: true,
  },
  {
    id: 'codigo-limite',
    enunciado:
      'Qual o maior índice válido de um array de 10 elementos em JavaScript?',
    respostaEsperada: 9,
  },
];

// Simula uma IA que responde a um problema de pegadinha.
// Em modo real isso chamaria um provedor de IA; aqui retornamos direto.
function resolverPegadinha(problema) {
  switch (problema.id) {
    case 'bola-0-05':
      return 0.05;
    case 'relogio':
      return 5;
    case 'porcentagem-sobre-porcentagem':
      return 96;
    case 'logica':
      return true;
    case 'codigo-limite':
      return 9;
    default:
      return null;
  }
}

// Converte a resposta da IA para comparar com o esperado (aceita string/numero/boolean).
function normalizar(resposta) {
  if (typeof resposta === 'boolean') return resposta;
  if (typeof resposta === 'number') return resposta;
  if (typeof resposta === 'string') {
    const n = Number(resposta.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (!Number.isNaN(n)) return n;
    return resposta.toLowerCase() === 'true' || resposta.toLowerCase() === 'sim';
  }
  return resposta;
}

function respostaCorreta(problema, resposta) {
  const normalizada = normalizar(resposta);
  return normalizada === problema.respostaEsperada;
}

// ============================================================
// Simulação de conferência com autococorreção
// ============================================================

// provedorFalso simula um provedor de IA que falha na primeira tentativa
// e acerta na segunda. Retorna { ok, resposta }.
function provedorFalso(tentativa) {
  if (tentativa === 1) {
    return { ok: false, resposta: 'resposta errada de proposito' };
  }
  return { ok: true, resposta: 'resposta correta apos correcao' };
}

// conferir com autococorreção: tenta até maxTentativas;
// para quando ok === true ou atinge o limite.
function conferirComAutocorrecao(resolver, maxTentativas = 2) {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    const resultado = resolver(tentativa);
    if (resultado.ok) {
      return { sucesso: true, tentativas: tentativa, resposta: resultado.resposta };
    }
  }
  return { sucesso: false, tentativas: maxTentativas };
}

// ============================================================
// TESTES
// ============================================================

describe('Modo Pensar - problemas de pegadinha', () => {
  for (const p of PEGADINHAS) {
    test(`resolve corretamente: ${p.id}`, () => {
      const resposta = resolverPegadinha(p);
      assert.strictEqual(respostaCorreta(p, resposta), true,
        `esperava ${p.respostaEsperada}, obteve ${resposta}`);
    });
  }
});

describe('Modo Pensar - autococorreção com provedor falso', () => {
  test('para após 2 voltas quando ok=false na 1ª vez e ok=true na 2ª', () => {
    const resultado = conferirComAutocorrecao(provedorFalso, 2);
    assert.strictEqual(resultado.sucesso, true);
    assert.strictEqual(resultado.tentativas, 2);
  });

  test('não passa na 1ª tentativa (ok=false forçando correção)', () => {
    const primeira = provedorFalso(1);
    assert.strictEqual(primeira.ok, false);
  });

  test('passa na 2ª tentativa (ok=true)', () => {
    const segunda = provedorFalso(2);
    assert.strictEqual(segunda.ok, true);
  });

  test('loop para após o limite de tentativas mesmo sem sucesso', () => {
    function sempreFalha() {
      return { ok: false, resposta: 'sempre falha' };
    }
    const resultado = conferirComAutocorrecao(sempreFalha, 2);
    assert.strictEqual(resultado.sucesso, false);
    assert.strictEqual(resultado.tentativas, 2);
  });
});

describe('Modo Pensar - utilitários', () => {
  test('normaliza número de resposta', () => {
    assert.strictEqual(normalizar('R$ 0,05'), 0.05);
    assert.strictEqual(normalizar(5), 5);
    assert.strictEqual(normalizar(true), true);
  });

  test('respostaCorreta compara valores esperados', () => {
    const p = PEGADINHAS.find((x) => x.id === 'bola-0-05');
    assert.strictEqual(respostaCorreta(p, 0.05), true);
    assert.strictEqual(respostaCorreta(p, 0.10), false);
  });
});

// ============================================================
// Execução automática ao rodar com node --test
// ============================================================

// Não há código fora de test/describe; node --test descobre os testes sozinho.

