const { test } = require('node:test'); const assert = require('node:assert');
const { urgencia } = require('../src/urgencia');
const alta = ['SAINDO FUMACA DO QUADRO DE LUZ', 'vazamento de gas na cozinha do salao', 'tomada dando choque na lavanderia', 'fio soltando faísca no poste interno',
  'elevador parou com uma senhora presa dentro', 'a água está subindo no subsolo, alagando tudo', 'incêndio no lixo do térreo', 'labaredas na churrasqueira fora de controle'];
const normal = ['o chuveiro queimou', 'queimou o fusível da campainha', 'barulho de obra no 502', 'limpeza da escada atrasada', 'interfone parou de funcionar',
  'portão eletrônico queimou o motor e não abre', 'trocar lâmpada queimada da escada', 'mancha de umidade na parede', 'o gás do fogão do salão acabou, pedir botijão'];
test('alta', () => { for (const f of alta) assert.strictEqual(urgencia(f), 'alta', f); });
test('normal', () => { for (const f of normal) assert.strictEqual(urgencia(f), 'normal', f); });
test('entrada vazia ou estranha: normal, sem erro', () => { for (const f of ['', null, undefined, 42]) assert.strictEqual(urgencia(f), 'normal'); });
