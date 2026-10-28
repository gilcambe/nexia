import { useState } from 'react';
import { Icone } from './icones';
import { useCelular } from './celular';

// Ordem recomendada de uso da Central: 5 passos, do novo cliente ao molde salvo.
// Exibe os 5 passos tanto no celular (lista vertical) quanto no desktop (linha).
export function ComeceAqui() {
  const celular = useCelular();

  const passos = [
    { id: 1, titulo: 'Novo cliente', descricao: 'Cadastre o cliente com nome e telefone/WhatsApp.' },
    { id: 2, titulo: 'Mandar link', descricao: 'Envie o link do guia ou orçamento pelo WhatsApp.' },
    { id: 3, titulo: 'Olhar prévia', descricao: 'O cliente abre o link e confere a prévia do serviço.' },
    { id: 4, titulo: 'Aprovar', descricao: 'O cliente aprova ou pede ajustes antes de seguir.' },
    { id: 5, titulo: 'Pronto / molde salvo', descricao: 'Salve o molde aprovado para reutilizar em outros clientes.' },
  ];

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.05)]" aria-labelledby="comece-aqui-titulo">
      <div className="mb-6">
        <h2 id="comece-aqui-titulo" className="text-xl font-semibold text-slate-900">Comece aqui</h2>
        <p className="text-sm text-slate-600 mt-1">Ordem recomendada para usar a Central do início ao fim.</p>
      </div>

      <div
        className={celular ? "grid grid-cols-1 gap-3" : "grid grid-cols-5 gap-3"}
        aria-label="Passos recomendados"
      >
        {passos.map((passo) => (
          <div key={passo.id} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-center" aria-current="step">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-semibold">
              {passo.id}
            </span>
            <h3 className="text-sm font-medium text-slate-900 leading-tight">{passo.titulo}</h3>
            <p className="text-xs text-slate-500 leading-tight">{passo.descricao}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
