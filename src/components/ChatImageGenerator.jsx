import React, { useState } from 'react';

/**
 * ChatImageGenerator - Componente para geração de imagens no chat (Flux / IA).
 * Requisitos:
 * 1) Verifica canGenerate() e isContentAllowed()
 * 2) Usa translatePtToEnImproved() para traduzir o prompt
 * 3) Chama fluxWorker.generateImage() para três formatos (quadrado, 9:16, 16:9)
 * 4) Exibe resultados com botões 'Baixar' e 'Fazer variação'
 * 5) Registra contagem de imagens no plano
 *
 * Props (todas obrigatórias, vindas do pai que integra o plano do usuário):
 * - canGenerate(): retorna { ok, remaining }
 * - isContentAllowed(text): retorna { allowed, reason }
 * - translatePtToEnImproved(text): retorna promise com prompt em inglês
 * - fluxWorker.generateImage(prompt, aspectRatio): retorna promise com URL da imagem
 * - onImageGeneratedCountUpdate(count): callback para registrar contagem no plano
 */
export default function ChatImageGenerator({
  initialPrompt = '',
  canGenerate,
  isContentAllowed,
  translatePtToEnImproved,
  fluxWorker,
  onImageGeneratedCountUpdate = () => {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState([]); // Array com os 3 formatos gerados

  const handleOpenModal = () => {
    const check = canGenerate();
    if (!check.ok) {
      setError('Limite de imagens do plano atingido.');
      setIsOpen(true);
      return;
    }
    setError('');
    setIsOpen(true);
    if (initialPrompt && !prompt) {
      setPrompt(initialPrompt);
    }
  };

  const handleGenerate = async (currentPrompt = prompt) => {
    if (!currentPrompt.trim()) {
      setError('Digite um prompt válido.');
      return;
    }

    const contentCheck = isContentAllowed(currentPrompt);
    if (!contentCheck.allowed) {
      setError(`Conteúdo não permitido: ${contentCheck.reason || 'Termos bloqueados.'}`);
      return;
    }

    const planCheck = canGenerate();
    if (!planCheck.ok) {
      setError('Limite de imagens do plano atingido.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!canGenerate || !isContentAllowed || !translatePtToEnImproved || !fluxWorker || !fluxWorker.generateImage) {
        setError('Serviços de geração não configurados.');
        return;
      }

      // 2) Traduz prompt pt -> en
      const translated = await translatePtToEnImproved(currentPrompt);

      // 3) Gera para os três formatos: quadrado, 9:16, 16:9
      const formats = [
        { label: 'Quadrado (1:1)', ratio: 'square', width: 800, height: 800 },
        { label: 'Vertical (9:16)', ratio: '9:16', width: 800, height: 1422 },
        { label: 'Horizontal (16:9)', ratio: '16:9', width: 1422, height: 800 }
      ];

      const results = await Promise.all(
        formats.map(async (f) => {
          const url = await fluxWorker.generateImage(translated, f.ratio);
          if (!url) throw new Error(`Falha ao gerar formato ${f.label}`);
          return {
            id: Math.random().toString(36).substring(2, 9),
            label: f.label,
            ratio: f.ratio,
            url,
            promptUsed: translated
          };
        })
      );

      setImages(results);
      // 5) Registrar contagem de imagens no plano (uma contagem por imagem gerada)
      onImageGeneratedCountUpdate(results.length);
    } catch (err) {
      setError(err.message || 'Erro ao gerar imagens. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVariation = async (imgItem) => {
    if (!fluxWorker || !fluxWorker.generateImage) {
      setError('Serviço de geração não disponível.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Reexecuta com prompt levemente modificado (adiciona descritor de variação)
      const variedPrompt = `${imgItem.promptUsed}, slight variation, different composition, unique details`;
      const newUrl = await fluxWorker.generateImage(variedPrompt, imgItem.ratio);

      if (!newUrl) {
        setError('A variação não retornou uma imagem válida.');
        return;
      }

      setImages(prev => prev.map(item => item.id === imgItem.id ? { ...item, url: newUrl, promptUsed: variedPrompt } : item));
      onImageGeneratedCountUpdate(1);
    } catch (err) {
      setError('Erro ao criar variação. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url, label) => {
    if (!url) {
      setError('Não há imagem para baixar.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `imagem-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="chat-image-generator-wrapper inline-block my-2">
      {/* Botão principal 'Criar imagem' */}
      <button
        onClick={handleOpenModal}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow transition flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Criar imagem"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Criar imagem
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full p-6 relative max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Criador de Imagens por IA (Flux)</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold"
                aria-label="Fechar"
              >
                &times;
              </button>
            </div>

            <div className="py-4 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descreva a imagem desejada (ex: Um carro vermelho esportivo):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: Carro vermelho na estrada..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => handleGenerate()}
                    disabled={loading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow transition disabled:opacity-50"
                  >
                    {loading ? 'Gerando...' : 'Gerar 3 Formatos'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                  <p className="text-sm text-gray-500">Traduzindo prompt e gerando imagens nos 3 formatos...</p>
                </div>
              )}

              {/* Exibição dos resultados */}
              {!loading && images.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {images.map((img) => (
                    <div key={img.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col justify-between bg-gray-50 dark:bg-gray-800">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">{img.label}</span>
                        </div>
                        <div className="relative w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded overflow-hidden mb-3 flex items-center justify-center">
                          <img src={img.url} alt={img.label} className="object-cover w-full h-full" loading="lazy" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(img.url, img.label)}
                          className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded shadow transition text-center"
                        >
                          Baixar
                        </button>
                        <button
                          onClick={() => handleVariation(img)}
                          className="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded shadow transition text-center"
                        >
                          Fazer variação
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:text-white text-gray-800 font-medium rounded-lg transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
