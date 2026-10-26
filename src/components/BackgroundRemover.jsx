import React, { useState, useRef } from 'react';
import { removeBackground } from '../utils/backgroundRemover';

/**
 * Componente BackgroundRemover
 * Permite ao usuário carregar uma imagem, selecionar a cor de fundo (branco, transparente ou customizado),
 * remover o fundo utilizando o utilitário removeBackground (TensorFlow.js / BodyPix offline),
 * visualizar o preview e baixar o resultado.
 */
export default function BackgroundRemover({ onProcessed }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);
  const [bgColor, setBgColor] = useState('transparent');
  const [customColor, setCustomColor] = useState('#ffffff');
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido.');
      return;
    }

    setError(null);
    setFile(selectedFile);
    setProcessedUrl(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target.result);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleRemoveBackground = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setProgressText('Carregando modelo de IA e processando imagem offline...');

    try {
      const effectiveBgColor = bgColor === 'custom' ? customColor : bgColor;
      const resultBlob = await removeBackground(file, effectiveBgColor);
      const url = URL.createObjectURL(resultBlob);
      setProcessedUrl(url);

      if (onProcessed && typeof onProcessed === 'function') {
        onProcessed(resultBlob, url);
      }
    } catch (err) {
      console.error('Erro ao remover fundo:', err);
      setError(err.message || 'Ocorreu um erro ao processar a imagem.');
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  const handleDownload = () => {
    if (!processedUrl) return;
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = `sem-fundo-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setProcessedUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto font-sans">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Removedor de Fundo Inteligente
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Funciona 100% no seu navegador com IA local (TensorFlow.js). Sem envio de dados para servidores.
          </p>
        </div>
        {file && (
          <button
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 underline transition"
          >
            Limpar / Nova Imagem
          </button>
        )}
      </div>

      {!file ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-8 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-800/50 group"
        >
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Clique para carregar uma foto ou arraste aqui
          </p>
          <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP (Qualquer resolução)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controles de Configuração de Fundo */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Cor do Fundo de Destino:
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setBgColor('transparent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  bgColor === 'transparent'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Transparente
              </button>
              <button
                type="button"
                onClick={() => setBgColor('white')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  bgColor === 'white'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Branco
              </button>
              <button
                type="button"
                onClick={() => setBgColor('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  bgColor === 'custom'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Customizado
              </button>

              {bgColor === 'custom' && (
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs text-slate-500 uppercase font-mono">{customColor}</span>
                </div>
              )}
            </div>
          </div>

          {/* Área de Previews */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/30 text-center">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Original</span>
              <div className="h-48 flex items-center justify-center overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
                {previewUrl && (
                  <img src={previewUrl} alt="Original" className="max-h-full max-w-full object-contain" />
                )}
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/30 text-center">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sem Fundo</span>
              <div className="h-48 flex items-center justify-center overflow-hidden rounded-lg bg-checkerboard dark:bg-slate-800 relative">
                {processedUrl ? (
                  <img src={processedUrl} alt="Processada" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    {loading ? 'Processando imagem...' : 'Aguardando remoção...'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full animate-pulse w-3/4 rounded-full"></div>
              </div>
              <p className="text-xs text-center text-slate-500 dark:text-slate-400 font-medium">
                {progressText}
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!processedUrl ? (
              <button
                type="button"
                onClick={handleRemoveBackground}
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Remover Fundo
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar Imagem Sem Fundo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
