export interface Student {
  id: string;
  name: string;
  phone: string;
  lastWorkoutDate: string; // ISO date string
}

export function getStudentsNeedingAttention(students: Student[], referenceDate: Date = new Date()): Student[] {
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  return students.filter(student => {
    if (!student.lastWorkoutDate) return true;
    const lastWorkout = new Date(student.lastWorkoutDate).getTime();
    const diff = referenceDate.getTime() - lastWorkout;
    return diff >= THREE_DAYS_MS;
  });
}

export function generateWhatsAppMessage(studentName: string): string {
  const encoded = encodeURIComponent(`Olá ${studentName}, notei que você está sem registrar treinos há mais de 3 dias. Está tudo bem por aí? Vamos retomar o foco hoje?`);
  return `https://wa.me/?text=${encoded}`;
}
