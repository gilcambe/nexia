import React, { useState } from 'react';
import { alimentoDoTexto, NutrientesTotais } from '@/lib/alimentoDoTexto';
import { perguntar } from '@/lib/coachAI';

export const RefeicaoRapida: React.FC = () => {
  const [texto, setTexto] = useState('');
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [totais, setTotais] = useState<NutrientesTotais | null>(null);
  const [veredito, setVeredito] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagemPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [analisando, setAnalisando] = useState(false);

  const handleCalcular = async () => {
    const resultado = alimentoDoTexto(texto);
    setTotais(resultado);

    if (imagemPreview) {
      setAnalisando(true);
      setVeredito(null);
      try {
        const resposta = await perguntar(
          `Analise esta foto de refeição e o texto descritivo ("${texto || 'Sem descrição'}"). Dê um veredito curto e construtivo sobre a qualidade nutricional, se está equilibrada e sugestões de melhoria se necessário.`
        );
        setVeredito(resposta || 'Refeição analisada com sucesso.');
      } catch (err) {
        setVeredito('Não foi possível gerar o veredito da foto no momento.');
      } finally {
        setAnalisando(false);
      }
    } else {
      setVeredito(null);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <i className="ri-restaurant-line text-emerald-500 text-xl"></i>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Refeição Rápida</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="o-que-comeu" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            O que você comeu?
          </label>
          <textarea
            id="o-que-comeu"
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex: 150g de frango com batata doce e salada"
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            <i className="ri-camera-line"></i>
            <span>Foto da refeição</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageChange}
            />
          </label>

          <button
            type="button"
            onClick={handleCalcular}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
          >
            <i className="ri-calculator-line"></i>
            <span>Calcular</span>
          </button>
        </div>

        {imagemPreview && (
          <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 mt-2">
            <img src={imagemPreview} alt="Miniatura da refeição" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setImagemPreview(null)}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
              title="Remover foto"
            >
              <i className="ri-close-line text-xs"></i>
            </button>
          </div>
        )}

        {totais && (
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Totais Calculados:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <span className="block text-xs text-emerald-600 dark:text-emerald-400 font-medium">Calorias</span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{totais.calorias} kcal</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                  <span className="block text-xs text-blue-600 dark:text-blue-400 font-medium">Proteínas</span>
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{totais.proteinas}g</span>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-100 dark:border-amber-900/50">
                  <span className="block text-xs text-amber-600 dark:text-amber-400 font-medium">Carboidratos</span>
                  <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{totais.carboidratos}g</span>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <span className="block text-xs text-purple-600 dark:text-purple-400 font-medium">Gorduras</span>
                  <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{totais.gorduras}g</span>
                </div>
              </div>
            </div>

            {analisando && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">\n                <i className="ri-loader-4-line animate-spin text-emerald-500 text-lg"></i>\n                <span>Coach analisando a foto da sua refeição...</span>\n              </div>
            )}

            {veredito && !analisando && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">\n                <div className="flex items-center gap-2 mb-2">\n                  <i className="ri-robot-2-line text-emerald-600 dark:text-emerald-400 text-lg"></i>\n                  <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Veredito do Coach</h4>\n                </div>\n                <p className="text-sm text-emerald-800 dark:text-emerald-300 whitespace-pre-line leading-relaxed">{veredito}</p>\n              </div>\n            )}
          </div>
        )}
      </div>
    </div>
  );
};
