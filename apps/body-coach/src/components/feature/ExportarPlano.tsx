import { useState } from 'react';
import type { FichaCoach } from '@/lib/coach/fichaCoach';
import type { PlanoAlimentar } from '@/lib/planoAlimentar';

type Plano = Pick<PlanoAlimentar, 'refeicoes' | 'totais' | 'extras'>;

// Dois botões: baixar o PDF (imprimir, guardar) e mandar no WhatsApp (o PDF pelo menu de compartilhar, ou o texto).
export default function ExportarPlano({ ficha, plano, aluno, coach }: { ficha?: FichaCoach | null; plano?: Plano | null; aluno?: string; coach?: string }) {
  const [ocupado, setOcupado] = useState(false);
  if (!ficha && !plano) return null;
  const nome = ficha ? `${ficha.nome}${aluno ? ` ${aluno}` : ''}` : `Plano alimentar${aluno ? ` ${aluno}` : ''}`;
  const fazer = async (onde: 'pdf' | 'whats') => {
    setOcupado(true);
    try {
      const m = await import('@/lib/exportar/planos');
      const pdf = ficha ? m.pdfDaFicha(ficha, aluno) : m.pdfDaDieta(plano as Plano, aluno, coach);
      if (onde === 'pdf') m.baixar(pdf, nome);
      else await m.mandarNoWhatsApp(pdf, nome, ficha ? m.fichaEmTexto(ficha, aluno) : m.dietaEmTexto(plano as Plano, aluno));
    } finally {
      setOcupado(false);
    }
  };
  const b = 'flex-1 rounded-xl border border-background-200 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 disabled:opacity-50';
  return (
    <div className="flex gap-2" data-testid="exportar-plano">
      <button type="button" onClick={() => void fazer('pdf')} disabled={ocupado} className={b}><i className="ri-file-pdf-2-line mr-1 text-red-600"></i>Baixar PDF</button>
      <button type="button" onClick={() => void fazer('whats')} disabled={ocupado} className={b}><i className="ri-whatsapp-line mr-1 text-green-600"></i>Mandar no WhatsApp</button>
    </div>
  );
}
