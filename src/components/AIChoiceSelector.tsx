import { useState } from 'react';

interface AIChoiceSelectorProps {
  credits: number;
  selectedAI: 'automatic' | 'fast' | 'strong';
  onAIChange: (aiType: 'automatic' | 'fast' | 'strong') => void;
}

const AIChoiceSelector = ({ credits, selectedAI, onAIChange }: AIChoiceSelectorProps) => {
  const aiOptions = [
    { id: 'automatic', label: 'IA Automática', description: 'Equilíbrio entre velocidade e qualidade' },
    { id: 'fast', label: 'IA Rápida', description: 'Respostas rápidas com menor consumo' },
    { id: 'strong', label: 'IA Forte', description: 'Análises profundas com maior qualidade' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Selecione o modo de IA</h3>
        <div className="flex items-center space-x-2 bg-nexia-cyan/10 text-nexia-cyan px-3 py-1 rounded-full">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">{credits} créditos restantes</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {aiOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onAIChange(option.id as 'automatic' | 'fast' | 'strong')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedAI === option.id
                ? 'border-nexia-cyan bg-nexia-cyan/10 dark:bg-nexia-cyan/5'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                selectedAI === option.id ? 'bg-nexia-cyan' : 'bg-gray-300 dark:bg-gray-600'
              }`} />
              <h4 className="font-medium text-gray-900 dark:text-white">{option.label}</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AIChoiceSelector;