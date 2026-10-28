import { useState } from 'react';

type Aviso = {
  id: string;
  titulo: string;
  texto: string;
  impacto?: string;
  fazer?: string;
  auto?: string;
  aba: string;
};

const AVISOS: Aviso[] = [
  {
    id: 'financeiro',
    titulo: 'Financeiro',
    texto: 'Há contas a vencer nos próximos 7 dias.',
    impacto: 'Pode gerar juros e suspensão de serviços.',
    fazer: 'Pague as contas pendentes na aba Financeiro.',
    aba: 'financeiro',
  },
  {
    id: 'agenda',
    titulo: 'Agenda',
    texto: 'Você tem compromissos agendados para hoje.',
    impacto: 'Perder horários pode afetar o atendimento aos clientes.',
    fazer: 'Confirme os compromissos na aba Agenda.',
    auto: 'Já foi verificado pelo sistema.',
    aba: 'agenda',
  },
  {
    id: 'leads',
    titulo: 'Novos leads',
    texto: 'Existem leads não respondidos há mais de 24 horas.',
    impacto: 'Pode perder oportunidades de negócio.',
    fazer: 'Responda os leads na aba Leads.',
    aba: 'leads',
  },
  {
    id: 'clientes',
    titulo: 'Clientes',
    texto: 'Dois clientes têm documentos pendentes.',
    impacto: 'Pode impedir a emissão de notas fiscais.',
    fazer: 'Colete os documentos na aba Clientes.',
    auto: 'Aguardando envio dos clientes.',
    aba: 'clientes',
  },
];

export default function Inicio() {
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Central NEXIA</h1>
        <section className="space-y-4">
          {AVISOS.map((aviso) => (
            <article
              key={aviso.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-start gap-3 mb-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {aviso.titulo}
                </h2>
                {abaAtiva === aviso.id && (
                  <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    Ativa
                  </span>
                )}
              </div>
              <p className="text-slate-700 mb-4">{aviso.texto}</p>
              {aviso.impacto && (
                <p className="text-sm text-slate-600 mb-1 flex items-start gap-1">
                  <span className="font-semibold text-slate-800">Impacto:</span>{' '}
                  {aviso.impacto}
                </p>
              )}
              {aviso.fazer && (
                <p className="text-sm text-slate-600 mb-1 flex items-start gap-1">
                  <span className="font-semibold text-slate-800">O que fazer:</span>{' '}
                  {aviso.fazer}
                </p>
              )}
              {aviso.auto && (
                <p className="text-sm text-slate-500 mb-4 flex items-start gap-1 italic">
                  <span className="font-semibold text-slate-600">Já feito sozinho:</span>{' '}
                  {aviso.auto}
                </p>
              )}
              <button
                type="button"
                onClick={() => setAbaAtiva(abaAtiva === aviso.id ? null : aviso.id)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition"
                aria-expanded={abaAtiva === aviso.id}
                aria-controls={`aba-${aviso.id}`}
              >
                {abaAtiva === aviso.id ? 'Fechar aba' : `Abrir aba ${aviso.titulo}`}
              </button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
