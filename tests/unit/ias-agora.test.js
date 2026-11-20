const assert = require('assert');
const { iasAgora } = require('../../netlify/functions/central/ias-agora');

describe('ias-agora', () => {
  it('deve classificar as IAs corretamente', () => {
    const vagas = [
      { vaga: 1, provedor: 'gemini', ligada: true, pausada: false },
      { vaga: 2, provedor: 'groq', ligada: true, pausada: false },
      { vaga: 3, provedor: 'mistral', ligada: true, pausada: false },
      { vaga: 4, provedor: 'nvidia', ligada: true, pausada: false }
    ];
    const julesEstado = { ligado: true };
    const agora = new Date().toISOString();
    const abertas = [
      { labels: [{ name: 'cortex-rodando' }], number: 1, title: 'IA 1', updated_at: agora },
      { labels: [{ name: 'cortex-reserva-sem-cota' }], number: 2, title: 'IA 2', updated_at: agora },
      { labels: [{ name: 'jules-enviado' }], number: 3, title: 'IA 3', updated_at: agora }
    ];

    const resultado = iasAgora({ vagas, julesEstado, abertas, agora });

    const ativa = resultado.find(i => i.nome === 'Cortex'); // ou vaga 1
    assert.strictEqual(ativa.situacao, 'ativa');
    
    const semCota = resultado.find(i => i.tarefa && i.tarefa.numero === 2);
    assert.strictEqual(semCota.situacao, 'sem-cota');

    const ociosa = resultado.find(i => i.nome === 'Jules');
    assert.strictEqual(ociosa.situacao, 'ativa'); // Jules está na lista de abertas
  });
});
