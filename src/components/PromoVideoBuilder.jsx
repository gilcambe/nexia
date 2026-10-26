import React, { useState } from 'react';

const PromoVideoBuilder = () => {
  const [prompt, setPrompt] = useState('');
  const [arquivos, setArquivos] = useState([]);
  const [progresso, setProgresso] = useState(0);
  const [gerando, setGerando] = useState(false);
  const [urlDownload, setUrlDownload] = useState(null);
  const [erro, setErro] = useState(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setArquivos(files);
    setErro(null);
  };

  const handleGerar = async () => {
    // Validação
    if (!prompt.trim()) {
      setErro('Digite um prompt para descrever o vídeo');
      return;
    }
    
    if (arquivos.length === 0) {
      setErro('Por favor, selecione pelo menos uma foto ou vídeo');
      return;
    }

    setGerando(true);
    setProgresso(0);
    setUrlDownload(null);
    setErro(null);

    // Simulação de progresso
    try {
      const interval = setInterval(() => {
        setProgresso(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 500);

      // Esperar o progresso completar
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Criar URL de download simulada
      const blob = new Blob(['video content'], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setUrlDownload(url);
      setGerando(false);
    } catch (error) {
      setErro('Erro ao gerar vídeo. Tente novamente.');
      setGerando(false);
    }
  };

  return (
    <div className="promo-video-builder">
      <h2>Criar Vídeo Promocional</h2>
      
      <div className="form-group">
        <label htmlFor="prompt">Prompt do Vídeo:</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Descreva o vídeo que você quer criar..."
          rows={4}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="arquivos">Fotos e Vídeos:</label>
        <input
          type="file"
          id="arquivos"
          onChange={handleFileChange}
          multiple
          accept="image/*,video/*"
        />
        <div className="file-list">
          {arquivos.length > 0 && (
            <div>
              <p>{arquivos.length} arquivo(s) selecionado(s):</p>
              <ul>
                {arquivos.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {erro && (
        <div className="error-message">
          {erro}
        </div>
      )}
      
      <button
        onClick={handleGerar}
        disabled={gerando || !prompt.trim() || arquivos.length === 0}
        className="gerar-button"
      >
        {gerando ? 'Gerando...' : 'Gerar Vídeo'}
      </button>
      
      {gerando && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progresso}%` }}
            ></div>
          </div>
          <span>{progresso}%</span>
        </div>
      )}
      
      {urlDownload && (
        <div className="download-section">
          <h3>Vídeo Gerado!</h3>
          <a
            href={urlDownload}
            download="promo-video.mp4"
            className="download-button"
          >
            Baixar MP4
          </a>
        </div>
      )}
    </div>
  );
};

export default PromoVideoBuilder;