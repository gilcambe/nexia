import { describe, it, expect } from 'vitest';
import { getStudentsNeedingAttention, generateWhatsAppMessage, Student } from '../utils/coachAttention';

describe('coachAttention', () => {
  it('should identify students without workout for 3 days or more', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const students: Student[] = [
      { id: '1', name: 'Recente', phone: '123', lastWorkoutDate: '2026-10-17T12:00:00Z' }, // 1 dia atrás
      { id: '2', name: 'Exato 3 dias', phone: '123', lastWorkoutDate: '2026-10-15T12:00:00Z' }, // 3 dias atrás
      { id: '3', name: 'Mais de 3 dias', phone: '123', lastWorkoutDate: '2026-10-10T12:00:00Z' }, // 8 dias atrás
    ];

    const result = getStudentsNeedingAttention(students, now);
    expect(result.length).toBe(2);
    expect(result.map(s => s.name)).toEqual(['Exato 3 dias', 'Mais de 3 dias']);
  });

  it('should generate correct WhatsApp URL with encoded message', () => {
    const url = generateWhatsAppMessage('Carlos Silva');
    expect(url).toContain('https://wa.me/?text=');
    expect(url).toContain(encodeURIComponent('Carlos Silva'));
  });
});
