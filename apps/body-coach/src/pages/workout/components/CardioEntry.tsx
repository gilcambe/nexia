import React, { useState } from 'react';
import { cardioDoTexto, CardioAtividade } from '@/lib/cardioDoTexto';

interface CardioEntryProps {
  onRegister?: (atividades: CardioAtividade[], texto: string, fotoNome?: string) => void;
}

export function CardioEntry({ onRegister }: CardioEntryProps) {
  const [texto, setTexto] = useState('');
  const [fotoNome, setFotoNome] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [atividadesProcessadas, setAtividadesProcessadas] = useState<CardioAtividade[] | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoNome(file.name);
      const url = URL.createObjectURL(file);
      setFotoUrl(url);
    }
  };

  const handleTextoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTexto(val);
    setSucesso(false);
    if (val.trim()) {
      const res = cardioDoTexto(val);
      setAtividadesProcessadas(res);
    } else {
      setAtividadesProcessadas(null);
    }
  };

  const handleRegistrar = () => {
    const atividades = cardioDoTexto(texto);
    setAtividadesProcessadas(atividades);
    setSucesso(true);
    if (onRegister) {
      onRegister(atividades, texto, fotoNome || undefined);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 dark:text-orange-400">
          <i className="ri-heart-pulse-line text-xl" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Registro de Cardio</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Descreva seu treino ou anexe a foto do painel</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="cardio-texto" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Descrição do Cardio
          </label>
          <textarea
            id="cardio-texto"
            rows={3}
            value={texto}
            onChange={handleTextoChange}
            placeholder="Conte seu cardio, ex.: 30 min de escada e 10 min de esteira"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none"
          />
        </div>

        {/* Pré-visualização automática do que foi interpretado */}
        {atividadesProcessadas && atividadesProcessadas.length > 0 && texto.trim().length > 0 && (
          <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <div className="font-medium text-orange-800 dark:text-orange-300 flex items-center gap-1">
              <i className="ri-sparkles-line" /> Atividades detectadas:
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {atividadesProcessadas.map((ativ, idx) => (
                <span key={idx} className="bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900/50 px-2.5 py-1 rounded-lg shadow-2xs">
                  <strong>{ativ.tipo}</strong>: {ativ.minutos} min
                  {ativ.distanciaKm !== undefined ? ` • ${ativ.distanciaKm} km` : ''}
                  {ativ.kcal !== undefined ? ` • ${ativ.kcal} kcal` : ''}
                  {ativ.velocidadeKmh !== undefined ? ` • ${ativ.velocidadeKmh} km/h` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors shadow-2xs">
              <i className="ri-camera-line text-base text-orange-500" />
              <span>Anexar foto do painel</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {fotoNome && (
              <div className="flex items-center gap-2 mt-2">
                {fotoUrl && (
                  <img
                    src={fotoUrl}
                    alt="Miniatura do painel"
                    className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                  {fotoNome}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleRegistrar}
            disabled={!texto.trim() && !fotoNome}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-check-line text-base" />
            <span>Registrar</span>
          </button>
        </div>

        {sucesso && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
            <i className="ri-checkbox-circle-line text-base shrink-0" />
            <span>Cardio registrado com sucesso!</span>
          </div>
        )}
      </div>
    </div>
  );
}
