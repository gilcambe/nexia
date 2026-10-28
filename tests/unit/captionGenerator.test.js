import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateSRT } from '../../src/utils/captionGenerator.js';

describe('generateSRT', () => {
  it('gera string SRT com numeração, timestamps e falas', () => {
    const scenes = [
      { id: 1, fala: 'Olá, tudo bem?', start: '00:00:00,000', end: '00:00:02,000' },
      { id: 2, fala: 'Esta é a segunda cena.', start: '00:00:02,500', end: '00:00:05,000' }
    ];
    const srt = generateSRT(scenes);
    assert.ok(typeof srt === 'string', 'deve retornar string');
    assert.ok(srt.includes('1'), 'deve conter número da primeira legenda');
    assert.ok(srt.includes('00:00:00,000 --> 00:00:02,000'), 'deve conter timestamp da primeira cena');
    assert.ok(srt.includes('Olá, tudo bem?'), 'deve conter a fala da primeira cena');
    assert.ok(srt.includes('2'), 'deve conter número da segunda legenda');
    assert.ok(srt.includes('00:00:02,500 --> 00:00:05,000'), 'deve conter timestamp da segunda cena');
    assert.ok(srt.includes('Esta é a segunda cena.'), 'deve conter a fala da segunda cena');
  });

  it('retorna string vazia para array vazio', () => {
    const srt = generateSRT([]);
    assert.ok(srt === '', 'deve retornar string vazia para array vazio');
  });
});
