import { getStudentsNeedingAttention, generateWhatsAppMessage } from '../utils/coachAttention';

describe('coachAttention', () => {
  it('should identify students without workout for 3 days or more', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const students = [
      { id: '1', name: 'Active Student', phone: '123', lastWorkoutDate: '2026-10-17T12:00:00Z' }, // 1 dia
      { id: '2', name: 'Inactive Student', phone: '456', lastWorkoutDate: '2026-10-14T11:00:00Z' }, // 4 dias
      { id: '3', name: 'No Workout', phone: '789', lastWorkoutDate: '' }, // sem treino
    ];

    const result = getStudentsNeedingAttention(students, now);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Inactive Student');
    expect(result[1].name).toBe('No Workout');
  });

  it('should generate correct whatsapp url', () => {
    const url = generateWhatsAppMessage('Carlos Silva');
    expect(url).toContain('wa.me');
    expect(url).toContain('Carlos%20Silva');
  });
});
