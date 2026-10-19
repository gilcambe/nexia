import test from 'node:test';
import assert from 'node:assert';
import { getStudentsNeedingAttention, generateWhatsAppMessage } from '../src/utils/coachAttention.ts';

test('getStudentsNeedingAttention - students needing attention (>= 3 days)', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  const students = [
    { id: '1', name: 'Alice', phone: '11999999999', lastWorkoutDate: '2026-10-18T10:00:00Z' }, // hoje (0 dias)
    { id: '2', name: 'Bob', phone: '11888888888', lastWorkoutDate: '2026-10-14T10:00:00Z' },   // 4 dias atrás (> 3 dias)
    { id: '3', name: 'Charlie', phone: '11777777777', lastWorkoutDate: '2026-10-15T12:00:00Z' }, // exatamente 3 dias atrás
    { id: '4', name: 'Diana', phone: '11666666666', lastWorkoutDate: '' }                      // sem data
  ];

  const result = getStudentsNeedingAttention(students, now);
  assert.strictEqual(result.length, 3);
  assert.deepStrictEqual(result.map(s => s.id), ['2', '3', '4']);
});

test('generateWhatsAppMessage - creates correct WhatsApp URL with encoded message', () => {
  const url = generateWhatsAppMessage('Bob');
  assert.ok(url.startsWith('https://wa.me/?text='));
  assert.ok(url.includes('Bob'));
});
