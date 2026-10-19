import React, { useState } from 'react';
import { getStudentsNeedingAttention, generateWhatsAppMessage, Student } from '../utils/coachAttention';

export function CoachDashboard() {
  // Mock inicial de alunos para demonstração e teste do painel
  const [students] = useState<Student[]>([
    { id: '1', name: 'Carlos Silva', phone: '5511999991111', lastWorkoutDate: '2026-10-10T10:00:00Z' },
    { id: '2', name: 'Mariana Souza', phone: '5511988882222', lastWorkoutDate: '2026-10-18T08:00:00Z' },
    { id: '3', name: 'João Pedro', phone: '5511977773333', lastWorkoutDate: '2026-10-14T15:00:00Z' },
  ]);

  const needingAttention = getStudentsNeedingAttention(students);

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Painel do Coach</h1>
        <p className="text-gray-600">Acompanhamento diário e engajamento de alunos.</p>
      </header>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-red-600 flex items-center gap-2">
            ⚠️ Quem precisa de atenção hoje ({needingAttention.length})
          </h2>
          <span className="text-sm text-gray-500">Alunos sem treino há 3 dias ou mais</span>
        </div>

        {needingAttention.length === 0 ? (
          <p className="text-gray-500 bg-gray-50 p-4 rounded-lg text-center">
            Parabéns! Nenhum aluno precisa de atenção no momento. Todos estão treinando regularmente.
          </p>
        ) : (
          <div className="grid gap-4">
            {needingAttention.map((student) => {
              const waUrl = generateWhatsAppMessage(student.name);
              return (
                <div key={student.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div>
                    <h3 className="font-bold text-gray-800">{student.name}</h3>
                    <p className="text-sm text-gray-600">
                      Último treino: {student.lastWorkoutDate ? new Date(student.lastWorkoutDate).toLocaleDateString() : 'Nunca registrado'}
                    </p>
                  </div>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition shadow"
                  >
                    💬 Mensagem em 1 toque
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default CoachDashboard;
